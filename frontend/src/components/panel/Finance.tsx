import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Empty } from "@/components/common";
import { apiGet } from "@/lib/api";
import { brl, PAYMENT_LABEL } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { FinanceOut } from "@/lib/types";

export default function Finance() {
  const today = useToday();
  const [period, setPeriod] = useState<"day" | "month">("month");
  const [date, setDate] = useState("");
  const ref = date || today.data || "";
  const fin = useQuery({ queryKey: ["finance", period, ref], queryFn: () => apiGet<FinanceOut>(`/admin/finance?period=${period}&date=${ref}`), enabled: !!ref });
  const f = fin.data;
  const qs = `period=${period}&date=${ref}`;
  const cards: [string, string, string][] = f ? [
    ["Pix", brl(f.totals.pix), "pix"], ["Crédito", brl(f.totals.credito), "credito"], ["Débito", brl(f.totals.debito), "debito"],
    ["Assinaturas", brl(f.totals.assinaturas), "assinaturas"], ["Produtos", brl(f.totals.produtos), "produtos"],
    ["Atend. via plano", String(f.totals.plano_atendimentos), "plano"],
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">
          {(["day", "month"] as const).map((p) => (
            <button key={p} data-testid={`finance-period-${p}`} onClick={() => setPeriod(p)} className={cn("rounded-lg px-4 py-1.5 text-sm", period === p ? "bg-gold text-ink" : "text-zinc-300")}>
              {p === "day" ? "Diário" : "Mensal"}
            </button>
          ))}
        </div>
        <Input type="date" data-testid="finance-date-input" value={ref} onChange={(e) => setDate(e.target.value)} className="w-44 font-mono" />
        <div className="ml-auto flex gap-2">
          <a href={`/api/admin/finance/export.xlsx?${qs}`} data-testid="export-excel-button" className={buttonVariants({ variant: "outline" })}><FileSpreadsheet className="size-4" /> Excel</a>
          <a href={`/api/admin/finance/export.pdf?${qs}`} data-testid="export-pdf-button" className={buttonVariants({ variant: "outline" })}><FileText className="size-4" /> PDF</a>
        </div>
      </div>

      {f && (
        <>
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
            <div className="card-black p-5 gold-glow">
              <p className="overline">Faturamento bruto</p>
              <p className="mt-2 font-heading text-4xl font-bold text-white" data-testid="finance-gross">{brl(f.gross)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.start === f.end ? f.start : `${f.start} → ${f.end}`}</p>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-5"><p className="text-xs text-muted-foreground">Atendimentos</p><p className="mt-2 font-heading text-3xl font-bold text-white" data-testid="finance-count">{f.atendimentos}</p></div>
            <div className="rounded-2xl border border-line bg-panel p-5"><p className="text-xs text-muted-foreground">Ticket médio</p><p className="mt-2 font-heading text-3xl font-bold text-white">{brl(f.ticket_medio)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map(([l, v, k]) => (
              <div key={k} className="rounded-2xl border border-line bg-panel p-4" data-testid={`finance-card-${k}`}>
                <p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-heading text-lg font-bold text-gold-soft">{v}</p>
              </div>
            ))}
          </div>

          {f.daily.length > 1 && (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="overline mb-3">Faturamento por dia</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={f.daily}>
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} stroke="#71717A" fontSize={11} />
                    <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 12 }} />
                    <Bar dataKey="total" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="overline mb-3">Comissões por barbeiro</p>
              {f.commissions.length ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Barbeiro</TableHead><TableHead>Atend.</TableHead><TableHead>Base</TableHead><TableHead>Comissão</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {f.commissions.map((c) => (
                      <TableRow key={c.barber_id} data-testid={`commission-row-${c.barber_id}`}>
                        <TableCell>{c.barber_name}</TableCell><TableCell>{c.atendimentos}</TableCell><TableCell>{brl(c.base)}</TableCell>
                        <TableCell className="text-gold-soft">{brl(c.commission)} <span className="text-xs text-muted-foreground">({c.commission_pct}%)</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Empty icon={<Download />} text="Sem atendimentos concluídos no período." />}
            </div>
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="overline mb-3">Dashboard de cortes</p>
              <div className="space-y-2">
                {f.services.map((s) => {
                  const max = f.services[0]?.count || 1;
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm"><span className="truncate text-zinc-200">{s.name}</span><span className="font-mono text-gold-soft">{s.count}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-gold" style={{ width: `${(s.count / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
                {!f.services.length && <p className="text-sm text-muted-foreground">Nenhum serviço realizado.</p>}
              </div>
            </div>
          </div>

          {f.appointments.length > 0 && (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="overline mb-3">Atendimentos concluídos</p>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Barbeiro</TableHead><TableHead>Pagamento</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {f.appointments.map((a) => (
                    <TableRow key={a.id}><TableCell className="font-mono text-xs">{a.date} {a.start}</TableCell><TableCell>{a.client_name}</TableCell><TableCell>{a.barber_name}</TableCell><TableCell>{PAYMENT_LABEL[a.payment_method]}</TableCell><TableCell>{brl(a.total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
