import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, CreditCard, Crown, Loader2, QrCode, Ticket, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, BrandMark, Stars } from "@/components/common";
import SlotPicker from "@/components/SlotPicker";
import { apiGet, apiPost } from "@/lib/api";
import { brl, dateLabel, errMsg, PAYMENT_LABEL, pyWeekday } from "@/lib/format";
import { useMe, useShop } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Appointment, ClientDashboard, PaymentMethod } from "@/lib/types";

const STEPS = ["Serviços", "Barbeiro", "Horário", "Pagamento"];

export default function Booking() {
  const { slug = "" } = useParams();
  const nav = useNavigate();
  const me = useMe();
  const { data } = useShop(slug);
  const isClient = me.data?.role === "client";
  const dash = useQuery({
    queryKey: ["dashboard", slug],
    queryFn: () => apiGet<ClientDashboard>(`/client/shops/${slug}/dashboard`),
    enabled: isClient,
  });
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [couponId, setCouponId] = useState("");

  const services = useMemo(() => data?.services.filter((s) => serviceIds.includes(s.id)) ?? [], [data, serviceIds]);
  const duration = services.reduce((a, s) => a + s.duration, 0);
  const price = services.reduce((a, s) => a + s.price, 0);
  const barber = data?.barbers.find((b) => b.id === barberId);
  const activeSubs = dash.data?.subscriptions.filter((s) => s.status === "ativa") ?? [];
  const usableSub = activeSubs.find((s) => s.credits_left > 0 && (!s.weekdays.length || (date && s.weekdays.includes(pyWeekday(date)))));
  const coupon = dash.data?.coupons.find((c) => c.id === couponId);
  const discount = method === "plano" ? price : coupon ? Math.min(price, coupon.kind === "valor" ? coupon.value : (price * coupon.value) / 100) : 0;

  const book = useMutation({
    mutationFn: () =>
      apiPost<Appointment>(`/client/shops/${slug}/appointments`, {
        service_ids: serviceIds, barber_id: barberId, date, start: time, payment_method: method,
        subscription_id: method === "plano" ? usableSub?.id : undefined,
        coupon_id: method !== "plano" && couponId ? couponId : undefined,
      }),
    onSuccess: () => {
      toast.success("Agendamento confirmado!");
      queryClient.invalidateQueries({ queryKey: ["dashboard", slug] });
      nav(`/b/${slug}/cliente`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (me.isLoading) return null;
  if (!me.data) return <Navigate to={`/entrar?shop=${slug}&next=/b/${slug}/agendar`} replace />;
  if (!isClient)
    return <p className="p-8 text-muted-foreground">Agendamento online disponível apenas para contas de cliente. <Link to="/" className="text-gold">Voltar</Link></p>;

  const canNext = [serviceIds.length > 0, !!barberId, !!date && !!time, !!method][step];
  const pay: { m: PaymentMethod; icon: typeof QrCode; sub?: string }[] = [
    { m: "pix", icon: QrCode, sub: "Pague no balcão via Pix" },
    { m: "credito", icon: CreditCard },
    { m: "debito", icon: Wallet },
  ];
  if (usableSub) pay.push({ m: "plano", icon: Crown, sub: `${usableSub.plan_name} • restam ${usableSub.credits_left} de ${usableSub.credits_total}` });

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <button data-testid="wizard-back-button" onClick={() => (step ? setStep(step - 1) : nav(`/b/${slug}`))} className="flex items-center gap-1 text-sm text-zinc-300 hover:text-gold">
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <BrandMark to={`/b/${slug}`} />
        </div>
        <div className="mx-auto flex max-w-2xl gap-1.5 px-5 pb-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1" data-testid={`wizard-step-${i + 1}`}>
              <div className={cn("h-1 rounded-full transition-colors duration-300", i <= step ? "bg-gold" : "bg-line")} />
              <p className={cn("mt-1.5 text-[11px]", i === step ? "font-semibold text-gold" : "text-muted-foreground")}>{i + 1}. {s}</p>
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <>
                <h1 className="text-2xl font-bold text-white">Escolha o(s) serviço(s)</h1>
                <div className="mt-5 space-y-2.5">
                  {data?.services.map((s) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <button key={s.id} data-testid={`service-option-${s.id}`}
                        onClick={() => setServiceIds(on ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])}
                        className={cn("flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors duration-150", on ? "border-gold bg-[#2A2310]" : "border-line bg-panel hover:border-gold/40")}>
                        <span className={cn("grid size-6 place-items-center rounded-md border", on ? "border-gold bg-gold text-ink" : "border-zinc-600")}>{on && <Check className="size-4" />}</span>
                        <div className="flex-1">
                          <p className="font-medium text-white">{s.name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> {s.duration} min</p>
                        </div>
                        <span className="font-mono font-semibold text-gold-soft">{brl(s.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="text-2xl font-bold text-white">Escolha o barbeiro</h1>
                <div className="mt-5 space-y-2.5">
                  {data?.barbers.map((b) => (
                    <button key={b.id} data-testid={`barber-option-${b.id}`} onClick={() => { setBarberId(b.id); setDate(""); setTime(""); }}
                      className={cn("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-150", barberId === b.id ? "border-gold bg-[#2A2310]" : "border-line bg-panel hover:border-gold/40")}>
                      <Avatar name={b.name} url={b.photo_url} className="size-14" />
                      <div className="flex-1">
                        <p className="font-heading text-lg font-semibold text-white">{b.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stars value={b.rating} /> {b.rating_count ? `${b.rating} • ${b.rating_count} avaliações` : "Sem avaliações ainda"}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {b.specialties.map((sp) => <span key={sp} className="rounded-full bg-elev px-2 py-0.5 text-[11px] text-gold-soft">{sp}</span>)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 2 && barber && (
              <>
                <h1 className="text-2xl font-bold text-white">Data e horário</h1>
                <p className="mb-5 mt-1 text-sm text-muted-foreground">Com {barber.name} • duração total {duration} min</p>
                <SlotPicker slug={slug} barberId={barber.id} workDays={barber.work_days} duration={duration} date={date} time={time}
                  onChange={(d, t) => { setDate(d); setTime(t); }} />
              </>
            )}
            {step === 3 && (
              <>
                <h1 className="text-2xl font-bold text-white">Pagamento e confirmação</h1>
                <div className="mt-5 grid gap-2.5">
                  {pay.map((p) => (
                    <button key={p.m} data-testid={`payment-option-${p.m}`} onClick={() => setMethod(p.m)}
                      className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors duration-150", method === p.m ? "border-gold bg-[#2A2310]" : "border-line bg-panel hover:border-gold/40")}>
                      <p.icon className="size-5 text-gold" />
                      <div className="flex-1"><p className="font-medium text-white">{p.m === "plano" ? "Usar Saldo do Plano" : PAYMENT_LABEL[p.m]}</p>{p.sub && <p className="text-xs text-muted-foreground">{p.sub}</p>}</div>
                      {method === p.m && <Check className="size-5 text-gold" />}
                    </button>
                  ))}
                </div>
                {method && method !== "plano" && (dash.data?.coupons.length ?? 0) > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white"><Ticket className="size-4 text-gold" /> Aplicar desconto</p>
                    <div className="flex flex-wrap gap-2">
                      {dash.data?.coupons.map((c) => (
                        <button key={c.id} data-testid={`coupon-option-${c.id}`} onClick={() => setCouponId(couponId === c.id ? "" : c.id)}
                          className={cn("rounded-xl border px-3 py-2 text-xs", couponId === c.id ? "border-gold bg-gold text-ink" : "border-line bg-elev text-zinc-200")}>
                          {c.kind === "valor" ? brl(c.value) : `${c.value}% OFF`} • {c.origin}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="card-black mt-6 space-y-2 p-5 text-sm" data-testid="booking-summary">
                  <p className="overline">Resumo</p>
                  <p className="text-white">{services.map((s) => s.name).join(" + ")}</p>
                  <p className="text-muted-foreground">Com {barber?.name} • {date && dateLabel(date)} às {time}</p>
                  {discount > 0 && <p className="text-emerald-400">Desconto: −{brl(discount)}</p>}
                  <p className="font-heading text-2xl font-bold text-gold-soft">{brl(price - discount)}</p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/90 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <div className="flex-1 text-sm">
            <p className="text-muted-foreground">{serviceIds.length} serviço(s) • {duration} min</p>
            <p className="font-heading text-lg font-bold text-white">{brl(price - discount)}</p>
          </div>
          {step < 3 ? (
            <Button data-testid="wizard-next-button" disabled={!canNext} onClick={() => setStep(step + 1)} className="h-12 px-7 text-base">Continuar →</Button>
          ) : (
            <Button data-testid="confirm-booking-button" disabled={!canNext || book.isPending} onClick={() => book.mutate()} className="h-12 px-7 text-base gold-glow">
              {book.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
