import io
from collections import defaultdict
from datetime import date as Date, timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from lib.auth import admin_user
from lib.core import add_month, now_br, parse_date
from lib.db import db
from models.schemas import Appointment, BarberCommission, DayPoint, FinanceOut, MethodTotals, ServiceCount

router = APIRouter(prefix="/admin/finance")

METHOD_LABEL = {"pix": "Pix", "credito": "Crédito", "debito": "Débito", "plano": "Plano"}


def _range(period: str, ref: str | None) -> tuple[str, str]:
    d = parse_date(ref) if ref else now_br().date()
    if period == "month":
        start = Date(d.year, d.month, 1)
        return start.isoformat(), (add_month(start) - timedelta(days=1)).isoformat()
    return d.isoformat(), d.isoformat()


async def build_finance(shop_id: str, period: str, ref: str | None) -> FinanceOut:
    start, end = _range(period, ref)
    appts = await db.appointments.find({"shop_id": shop_id, "status": "concluido", "date": {"$gte": start, "$lte": end}},
                                       {"_id": 0}).sort([("date", 1), ("start", 1)]).to_list(5000)
    barbers = {b["id"]: b for b in await db.barbers.find({"shop_id": shop_id}, {"_id": 0}).to_list(200)}
    t = MethodTotals()
    comm: dict[str, dict] = {}
    svc: dict[str, int] = defaultdict(int)
    daily: dict[str, list] = defaultdict(lambda: [0.0, 0])
    for a in appts:
        services_paid = a["total"] - a.get("products_total", 0)
        if a["payment_method"] == "plano":
            t.plano_atendimentos += 1
        else:
            setattr(t, a["payment_method"], round(getattr(t, a["payment_method"]) + services_paid, 2))
        t.produtos = round(t.produtos + a.get("products_total", 0), 2)
        b = barbers.get(a["barber_id"], {"name": a["barber_name"], "commission": 0})
        c = comm.setdefault(a["barber_id"], {"barber_name": b["name"], "pct": b.get("commission", 0), "n": 0, "base": 0.0})
        c["n"] += 1
        c["base"] += a["price"] if a["payment_method"] == "plano" else a["price"] - a.get("discount", 0)
        for n in a["service_names"]:
            svc[n] += 1
        daily[a["date"]][0] += a["total"]
        daily[a["date"]][1] += 1
    async for p in db.sub_payments.find({"shop_id": shop_id, "date": {"$gte": start, "$lte": end}}):
        t.assinaturas = round(t.assinaturas + p["amount"], 2)
    gross = round(t.pix + t.credito + t.debito + t.assinaturas + t.produtos, 2)
    return FinanceOut(
        start=start, end=end, totals=t, gross=gross, atendimentos=len(appts),
        ticket_medio=round(sum(a["total"] for a in appts) / len(appts), 2) if appts else 0,
        commissions=[BarberCommission(barber_id=k, barber_name=v["barber_name"], atendimentos=v["n"], base=round(v["base"], 2),
                                      commission_pct=v["pct"], commission=round(v["base"] * v["pct"] / 100, 2)) for k, v in comm.items()],
        services=sorted([ServiceCount(name=k, count=v) for k, v in svc.items()], key=lambda s: -s.count),
        daily=[DayPoint(date=k, total=round(v[0], 2), count=v[1]) for k, v in sorted(daily.items())],
        appointments=[Appointment(**a) for a in appts],
    )


@router.get("", response_model=FinanceOut)
async def finance(period: str = "day", date: str | None = None, user: dict = Depends(admin_user)):
    return await build_finance(user["shop_id"], period, date)


def _brl(v: float) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _summary_rows(f: FinanceOut) -> list[list[str]]:
    t = f.totals
    return [["Pix", _brl(t.pix)], ["Crédito", _brl(t.credito)], ["Débito", _brl(t.debito)], ["Assinaturas", _brl(t.assinaturas)],
            ["Venda de Produtos", _brl(t.produtos)], ["Atendimentos via Plano", str(t.plano_atendimentos)],
            ["Faturamento Bruto", _brl(f.gross)], ["Atendimentos", str(f.atendimentos)], ["Ticket Médio", _brl(f.ticket_medio)]]


@router.get("/export.xlsx")
async def export_xlsx(period: str = "day", date: str | None = None, user: dict = Depends(admin_user)):
    from openpyxl import Workbook
    f = await build_finance(user["shop_id"], period, date)
    wb = Workbook()
    ws = wb.active
    ws.title = "Resumo"
    ws.append([f"Relatório {f.start} a {f.end}"])
    for r in _summary_rows(f):
        ws.append(r)
    ws.append([])
    ws.append(["Barbeiro", "Atendimentos", "Base (R$)", "Comissão %", "Comissão (R$)"])
    for c in f.commissions:
        ws.append([c.barber_name, c.atendimentos, c.base, c.commission_pct, c.commission])
    ws2 = wb.create_sheet("Atendimentos")
    ws2.append(["Data", "Hora", "Cliente", "Barbeiro", "Serviços", "Pagamento", "Produtos (R$)", "Total (R$)"])
    for a in f.appointments:
        ws2.append([a.date, a.start, a.client_name, a.barber_name, ", ".join(a.service_names), METHOD_LABEL[a.payment_method], a.products_total, a.total])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="relatorio_{f.start}_{f.end}.xlsx"'})


@router.get("/export.pdf")
async def export_pdf(period: str = "day", date: str | None = None, user: dict = Depends(admin_user)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    f = await build_finance(user["shop_id"], period, date)
    shop = await db.shops.find_one({"id": user["shop_id"]})
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="Relatório Financeiro")
    st = getSampleStyleSheet()
    style = TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D4AF37")), ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                        ("FONTSIZE", (0, 0), (-1, -1), 8)])
    els = [Paragraph(f"{shop['name']} — Relatório Financeiro", st["Title"]), Paragraph(f"Período: {f.start} a {f.end}", st["Normal"]), Spacer(1, 10)]
    els += [Table([["Categoria", "Valor"]] + _summary_rows(f), style=style), Spacer(1, 12), Paragraph("Comissões", st["Heading2"])]
    els.append(Table([["Barbeiro", "Atend.", "Base", "%", "Comissão"]] + [[c.barber_name, c.atendimentos, _brl(c.base), f"{c.commission_pct:g}%", _brl(c.commission)] for c in f.commissions], style=style))
    els += [Spacer(1, 12), Paragraph("Atendimentos", st["Heading2"])]
    rows = [[a.date, a.start, a.client_name[:22], a.barber_name[:14], ", ".join(a.service_names)[:38], METHOD_LABEL[a.payment_method], _brl(a.total)] for a in f.appointments]
    els.append(Table([["Data", "Hora", "Cliente", "Barbeiro", "Serviços", "Pgto", "Total"]] + rows, style=style, repeatRows=1))
    doc.build(els)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="relatorio_{f.start}_{f.end}.pdf"'})
