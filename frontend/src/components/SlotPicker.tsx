import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api";
import { addDays, dateLabel, pyWeekday } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  barberId: string;
  workDays: number[];
  duration: number;
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  excludeId?: string;
}

export default function SlotPicker({ slug, barberId, workDays, duration, date, time, onChange, excludeId }: Props) {
  const today = useToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const days = useMemo(() => {
    if (!today.data) return [];
    return Array.from({ length: 21 }, (_, i) => addDays(today.data!, i)).filter((d) => workDays.includes(pyWeekday(d)));
  }, [today.data, workDays]);
  const visible = days.slice(weekOffset, weekOffset + 7);
  const slots = useQuery({
    queryKey: ["slots", slug, barberId, date, duration, excludeId],
    queryFn: () =>
      apiGet<string[]>(`/public/shops/${slug}/slots?barber_id=${barberId}&date=${date}&duration=${duration}${excludeId ? `&exclude_id=${excludeId}` : ""}`),
    enabled: !!date && !!barberId,
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Data</p>
          <div className="flex gap-1">
            <button data-testid="dates-prev" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => Math.max(0, w - 7))} className="rounded-lg px-2 py-1 text-xs text-gold disabled:opacity-30">‹ Anterior</button>
            <button data-testid="dates-next" disabled={weekOffset + 7 >= days.length} onClick={() => setWeekOffset((w) => w + 7)} className="rounded-lg px-2 py-1 text-xs text-gold disabled:opacity-30">Próximos ›</button>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Sem dias de atendimento disponíveis.</p>}
          {visible.map((d) => {
            const [wd, rest] = dateLabel(d).split(", ");
            return (
              <button key={d} data-testid={`date-chip-${d}`} onClick={() => onChange(d, "")}
                className={cn(
                  "flex min-w-[68px] flex-col items-center rounded-xl border px-3 py-2.5 transition-colors duration-150",
                  d === date ? "border-gold bg-gold text-ink" : "border-line bg-elev text-zinc-200 hover:border-gold/50",
                )}>
                <span className="text-[11px] uppercase">{wd?.replace(".", "")}</span>
                <span className="font-heading text-sm font-bold">{rest ?? d}</span>
              </button>
            );
          })}
        </div>
      </div>
      {date && (
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Horários disponíveis</p>
          {slots.isLoading ? (
            <Loader2 className="size-5 animate-spin text-gold" />
          ) : slots.data && slots.data.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="slot-grid">
              {slots.data.map((t) => (
                <button key={t} data-testid={`slot-${t}`} onClick={() => onChange(date, t)}
                  className={cn(
                    "h-12 rounded-xl border font-mono text-sm transition-colors duration-150",
                    t === time ? "border-gold bg-gold font-semibold text-ink gold-glow" : "border-line bg-elev text-zinc-200 hover:border-gold/50",
                  )}>
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="no-slots">Nenhum horário livre nesta data. Tente outro dia.</p>
          )}
        </div>
      )}
    </div>
  );
}
