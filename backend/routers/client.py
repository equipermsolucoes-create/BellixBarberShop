from fastapi import APIRouter, Depends, HTTPException

from lib.auth import client_user
from lib.core import (appt_dt, compute_slots, ensure_member, get_shop_by_slug, new_id, now_br, now_iso,
                      parse_date, refresh_subscription)
from lib.db import db
from models.schemas import (Appointment, BookingIn, ClientDashboard, Coupon, Member, RescheduleIn, ReviewIn,
                            SubRequestIn, SubscribeIn, Subscription)

router = APIRouter(prefix="/client")


async def _subs(shop_id: str, client_id: str) -> list[dict]:
    subs = await db.subscriptions.find({"shop_id": shop_id, "client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [await refresh_subscription(s) for s in subs]


@router.get("/shops/{slug}/dashboard", response_model=ClientDashboard)
async def dashboard(slug: str, user: dict = Depends(client_user)):
    shop = await get_shop_by_slug(slug, require_active=False)
    sid = shop["id"]
    member = await ensure_member(sid, user)
    appts = await db.appointments.find({"shop_id": sid, "client_id": user["id"]}, {"_id": 0}).sort([("date", -1), ("start", -1)]).to_list(300)
    upcoming = sorted([a for a in appts if a["status"] == "agendado"], key=lambda a: (a["date"], a["start"]))
    history = [a for a in appts if a["status"] != "agendado"]
    return ClientDashboard(
        member=Member(**member),
        referrals_count=await db.members.count_documents({"shop_id": sid, "referred_by": user["id"]}),
        referrals_rewarded=await db.members.count_documents({"shop_id": sid, "referred_by": user["id"], "referral_rewarded": True}),
        loyalty_target=shop.get("loyalty_target", 10),
        subscriptions=[Subscription(**s) for s in await _subs(sid, user["id"])],
        coupons=[Coupon(**c) for c in await db.coupons.find({"shop_id": sid, "client_id": user["id"], "used": False}, {"_id": 0}).to_list(50)],
        upcoming=[Appointment(**a) for a in upcoming],
        history=[Appointment(**a) for a in history],
    )


@router.post("/shops/{slug}/appointments", response_model=Appointment)
async def book(slug: str, body: BookingIn, user: dict = Depends(client_user)):
    shop = await get_shop_by_slug(slug)
    sid = shop["id"]
    await ensure_member(sid, user)
    services = await db.services.find({"shop_id": sid, "id": {"$in": body.service_ids}, "active": True}, {"_id": 0}).to_list(50)
    if len(services) != len(set(body.service_ids)):
        raise HTTPException(400, "Serviço inválido")
    barber = await db.barbers.find_one({"id": body.barber_id, "shop_id": sid, "active": True}, {"_id": 0})
    if not barber:
        raise HTTPException(400, "Barbeiro inválido")
    duration = sum(s["duration"] for s in services)
    price = round(sum(s["price"] for s in services), 2)
    if body.start not in await compute_slots(sid, barber, body.date, duration):
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
    discount, sub_id, coupon_id = 0.0, None, None
    if body.payment_method == "plano":
        subs = [s for s in await _subs(sid, user["id"]) if s["status"] == "ativa"]
        sub = next((s for s in subs if s["id"] == body.subscription_id), subs[0] if subs else None)
        if not sub:
            raise HTTPException(400, "Você não possui assinatura ativa nesta barbearia")
        pending = await db.appointments.count_documents({"subscription_id": sub["id"], "status": "agendado"})
        if sub["credits_left"] - pending < 1:
            raise HTTPException(400, "Saldo do plano insuficiente")
        if sub.get("weekdays") and parse_date(body.date).weekday() not in sub["weekdays"]:
            raise HTTPException(400, "Seu plano não é válido neste dia da semana")
        sub_id, discount = sub["id"], price
    elif body.coupon_id:
        c = await db.coupons.find_one({"id": body.coupon_id, "shop_id": sid, "client_id": user["id"], "used": False})
        if not c:
            raise HTTPException(400, "Cupom inválido")
        discount = round(min(price, c["value"] if c["kind"] == "valor" else price * c["value"] / 100), 2)
        coupon_id = c["id"]
        await db.coupons.update_one({"id": c["id"]}, {"$set": {"used": True}})
    end_min = int(body.start[:2]) * 60 + int(body.start[3:]) + duration
    appt = {
        "id": new_id(), "shop_id": sid, "client_id": user["id"], "client_name": user["name"], "client_phone": user.get("phone", ""),
        "barber_id": barber["id"], "barber_name": barber["name"], "service_ids": [s["id"] for s in services],
        "service_names": [s["name"] for s in services], "date": body.date, "start": body.start,
        "end": f"{end_min // 60:02d}:{end_min % 60:02d}", "duration": duration, "price": price, "discount": discount,
        "products": [], "products_total": 0, "total": round(price - discount, 2), "payment_method": body.payment_method,
        "status": "agendado", "walk_in": False, "subscription_id": sub_id, "coupon_id": coupon_id, "rated": False,
        "created_at": now_iso(),
    }
    await db.appointments.insert_one(dict(appt))
    return Appointment(**appt)


async def _own_appt(appt_id: str, user: dict) -> tuple[dict, dict]:
    a = await db.appointments.find_one({"id": appt_id, "client_id": user["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Agendamento não encontrado")
    shop = await db.shops.find_one({"id": a["shop_id"]}, {"_id": 0})
    return a, shop


def _check_deadline(a: dict, shop: dict):
    if a["status"] != "agendado":
        raise HTTPException(400, "Agendamento não está ativo")
    hours = shop.get("cancel_min_hours", 2)
    if (appt_dt(a["date"], a["start"]) - now_br()).total_seconds() < hours * 3600:
        raise HTTPException(400, f"Alterações só são permitidas até {hours}h antes do horário")


@router.post("/appointments/{appt_id}/cancel", response_model=Appointment)
async def cancel(appt_id: str, user: dict = Depends(client_user)):
    a, shop = await _own_appt(appt_id, user)
    _check_deadline(a, shop)
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "cancelado"}})
    if a.get("coupon_id"):
        await db.coupons.update_one({"id": a["coupon_id"]}, {"$set": {"used": False}})
    a["status"] = "cancelado"
    return Appointment(**a)


@router.post("/appointments/{appt_id}/reschedule", response_model=Appointment)
async def reschedule(appt_id: str, body: RescheduleIn, user: dict = Depends(client_user)):
    a, shop = await _own_appt(appt_id, user)
    _check_deadline(a, shop)
    barber = await db.barbers.find_one({"id": a["barber_id"]}, {"_id": 0})
    if not barber or body.start not in await compute_slots(a["shop_id"], barber, body.date, a["duration"], exclude_id=appt_id):
        raise HTTPException(409, "Horário indisponível")
    end_min = int(body.start[:2]) * 60 + int(body.start[3:]) + a["duration"]
    upd = {"date": body.date, "start": body.start, "end": f"{end_min // 60:02d}:{end_min % 60:02d}"}
    await db.appointments.update_one({"id": appt_id}, {"$set": upd})
    a.update(upd)
    return Appointment(**a)


@router.post("/appointments/{appt_id}/review", response_model=Appointment)
async def review(appt_id: str, body: ReviewIn, user: dict = Depends(client_user)):
    a, _ = await _own_appt(appt_id, user)
    if a["status"] != "concluido" or a.get("rated"):
        raise HTTPException(400, "Só é possível avaliar atendimentos concluídos (uma vez)")
    await db.reviews.insert_one({"id": new_id(), "shop_id": a["shop_id"], "appointment_id": a["id"], "barber_id": a["barber_id"],
                                 "client_id": user["id"], "client_name": user["name"], "rating": body.rating,
                                 "comment": body.comment.strip(), "created_at": now_iso()})
    await db.appointments.update_one({"id": appt_id}, {"$set": {"rated": True}})
    a["rated"] = True
    return Appointment(**a)


@router.post("/shops/{slug}/subscriptions", response_model=Subscription)
async def subscribe(slug: str, body: SubscribeIn, user: dict = Depends(client_user)):
    shop = await get_shop_by_slug(slug)
    plan = await db.plans.find_one({"id": body.plan_id, "shop_id": shop["id"], "active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Plano não encontrado")
    if await db.subscriptions.find_one({"shop_id": shop["id"], "client_id": user["id"], "plan_id": plan["id"], "status": {"$in": ["pendente", "ativa"]}}):
        raise HTTPException(400, "Você já possui este plano (ativo ou aguardando ativação)")
    await ensure_member(shop["id"], user)
    sub = {"id": new_id(), "shop_id": shop["id"], "client_id": user["id"], "client_name": user["name"], "client_phone": user.get("phone", ""),
           "plan_id": plan["id"], "plan_name": plan["name"], "price": plan["price"], "credits_total": plan["credits"],
           "credits_left": 0, "weekdays": plan.get("weekdays", []), "billing": body.billing, "status": "pendente",
           "cycle_start": "", "cycle_end": "", "dependent_name": body.dependent_name.strip(), "request": None, "created_at": now_iso()}
    await db.subscriptions.insert_one(dict(sub))
    return Subscription(**sub)


@router.post("/subscriptions/{sub_id}/request", response_model=Subscription)
async def sub_request(sub_id: str, body: SubRequestIn, user: dict = Depends(client_user)):
    sub = await db.subscriptions.find_one({"id": sub_id, "client_id": user["id"]}, {"_id": 0})
    if not sub or sub["status"] not in ("pendente", "ativa"):
        raise HTTPException(404, "Assinatura não encontrada")
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"request": body.request}})
    sub["request"] = body.request
    return Subscription(**sub)
