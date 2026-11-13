import { useQuery } from "@tanstack/react-query";
import { BellRing, CalendarClock, Crown, MessageCircle, Trophy } from "lucide-react";
import { Empty } from "@/components/common";
import { apiGet } from "@/lib/api";
import { brl, dateLabel, waLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InsightsOut } from "@/lib/types";

const waBtn = "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#064E3B] px-3 py-1.5 text-xs font-semibold text-[#6EE7B7] transition-colors duration-150 hover:bg-[#065F46]";

export default function Relationship({ shopName }: { shopName: string }) {
  const q = useQuery({ queryKey: ["admin", "insights"], queryFn: () => apiGet<InsightsOut>("/admin/insights") });
  if (q.isLoading || !q.data) return <div className="h-40 animate-pulse rounded-2xl bg-panel" />;
  const { reminders, expiring, ranking, tomorrow } = q.data;
  const first = (n: string) => n.split(" ")[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <section className="rounded-2xl border border-line bg-panel p-5" data-testid="reminders-section">
        <p className="overline flex items-center gap-1.5"><BellRing className="size-3.5" /> Lembretes de amanhã</p>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel(tomorrow)} • {reminders.length} horário(s) agendado(s)</p>
        <div className="mt-4 space-y-2">
          {reminders.length === 0 && <Empty icon={<CalendarClock />} text="Nenhum horário para amanhã." testId="reminders-empty" />}
          {reminders.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-elev px-3 py-2.5" data-testid={`reminder-${a.id}`}>
              <span className="font-mono text-sm font-semibold text-gold-soft">{a.start}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{a.client_name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.service_names.join(" + ")} • {a.barber_name}</p>
              </div>
              {a.client_phone ? (
                <a target="_blank" rel="noreferrer" className={waBtn} data-testid={`reminder-wa-${a.id}`}
                  href={waLink(a.client_phone, `Olá ${first(a.client_name)}! Lembrete da ${shopName}: seu horário é amanhã (${dateLabel(a.date)}) às ${a.start} com ${a.barber_name} — ${a.service_names.join(" + ")}. Confirma presença? 💈`)}>
                  <MessageCircle className="size-3.5" /> Lembrar
                </a>
              ) : <span className="text-xs text-muted-foreground">sem telefone</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5" data-testid="expiring-section">
        <p className="overline flex items-center gap-1.5"><Crown className="size-3.5" /> Mensalidades vencendo na semana</p>
        <p className="mt-1 text-sm text-muted-foreground">Assinaturas ativas com ciclo terminando nos próximos 7 dias.</p>
        <div className="mt-4 space-y-2">
          {expiring.length === 0 && <Empty icon={<Crown />} text="Nenhuma mensalidade vence esta semana." testId="expiring-empty" />}
          {expiring.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-elev px-3 py-2.5" data-testid={`expiring-${s.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{s.client_name}{s.dependent_name && ` (dep.: ${s.dependent_name})`}</p>
                <p className="text-xs text-muted-foreground">{s.plan_name} • {brl(s.price)} • vence {dateLabel(s.cycle_end)}</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.billing === "recorrente" ? "bg-[#2A2310] text-gold-soft" : "bg-zinc-800 text-zinc-300")}>
                {s.billing === "recorrente" ? "Recorrente" : "Única"}
              </span>
              {s.client_phone && (
                <a target="_blank" rel="noreferrer" className={waBtn} data-testid={`expiring-wa-${s.id}`}
                  href={waLink(s.client_phone, s.billing === "recorrente"
                    ? `Olá ${first(s.client_name)}! Sua mensalidade do ${s.plan_name} na ${shopName} (${brl(s.price)}) vence em ${dateLabel(s.cycle_end)}. O pagamento pode ser feito no balcão via Pix ou cartão. Obrigado! 💈`
                    : `Olá ${first(s.client_name)}! Seu ${s.plan_name} na ${shopName} termina em ${dateLabel(s.cycle_end)}. Quer renovar ou passar para a adesão recorrente? 💈`)}>
                  <MessageCircle className="size-3.5" /> Avisar
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2" data-testid="ranking-section">
        <p className="overline flex items-center gap-1.5"><Trophy className="size-3.5" /> Ranking de clientes fiéis</p>
        <p className="mt-1 text-sm text-muted-foreground">Quem mais volta e quanto já gastou (atendimentos concluídos).</p>
        {ranking.length === 0 ? (
          <div className="mt-4"><Empty icon={<Trophy />} text="O ranking aparece após os primeiros atendimentos concluídos." testId="ranking-empty" /></div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" data-testid="ranking-table">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-2">#</th><th>Cliente</th><th>Visitas</th><th>Total gasto</th><th>Última visita</th><th /></tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.key} className="border-t border-line" data-testid={`ranking-row-${i + 1}`}>
                    <td className="py-2.5 pr-2">
                      <span className={cn("grid size-7 place-items-center rounded-full font-heading text-xs font-bold", i === 0 ? "bg-gold text-ink" : i < 3 ? "bg-[#2A2310] text-gold-soft" : "bg-elev text-zinc-400")}>{i + 1}</span>
                    </td>
                    <td className="font-medium text-white">{r.name}{!r.registered && <span className="ml-1.5 text-[11px] text-muted-foreground">(encaixe)</span>}</td>
                    <td className="font-mono">{r.visits}</td>
                    <td className="font-mono text-gold-soft">{brl(r.spent)}</td>
                    <td className="text-muted-foreground">{dateLabel(r.last_visit)}</td>
                    <td className="text-right">
                      {r.phone && (
                        <a target="_blank" rel="noreferrer" className={waBtn} data-testid={`ranking-wa-${i + 1}`}
                          href={waLink(r.phone, `Olá ${first(r.name)}! Você é um dos clientes mais fiéis da ${shopName} — obrigado pela preferência! Temos um mimo esperando por você no próximo corte. 💈`)}>
                          <MessageCircle className="size-3.5" /> Agradecer
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
