import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, Copy, Crown, Gift, History, Loader2, LogOut, Scissors, Share2, Star, Ticket, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark, Empty, StarPicker, StatusBadge } from "@/components/common";
import SlotPicker from "@/components/SlotPicker";
import { apiGet, apiPost } from "@/lib/api";
import { brl, dateLabel, errMsg, PAYMENT_LABEL, waLink, WEEKDAYS } from "@/lib/format";
import { useMe, useShop } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Appointment, ClientDashboard, Plan, Subscription } from "@/lib/types";

function SubCard({ s, onRequest }: { s: Subscription; onRequest: (s: Subscription, r: "cancelar" | "recorrente") => void }) {
  const pct = s.credits_total ? (s.credits_left / s.credits_total) * 100 : 0;
  return (
    <div className="card-black p-5" data-testid={`subscription-card-${s.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="overline">Assinatura {s.billing === "recorrente" ? "recorrente" : "única"}</p>
          <p className="mt-1 font-heading text-lg font-bold text-white">{s.plan_name}</p>
          {s.dependent_name && <p className="text-xs text-muted-foreground">Dependente: {s.dependent_name}</p>}
        </div>
        <StatusBadge status={s.status} />
      </div>
      {s.status === "ativa" && (
        <>
          <p className="mt-4 text-sm text-zinc-200" data-testid="subscription-balance">
            Restam <span className="font-heading text-2xl font-bold text-gold-soft">{s.credits_left}</span> de {s.credits_total} serviços este mês
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Ciclo: {s.cycle_start && dateLabel(s.cycle_start)} → {s.cycle_end && dateLabel(s.cycle_end)}</p>
          {s.weekdays.length > 0 && <p className="text-xs text-amber-300">Válido: {s.weekdays.map((d) => WEEKDAYS[d]).join(", ")}</p>}
        </>
      )}
      {s.status === "pendente" && <p className="mt-3 text-sm text-muted-foreground">Aguardando ativação pela barbearia após o pagamento.</p>}
      {s.request && <p className="mt-3 text-xs text-amber-300">Solicitação enviada: {s.request === "cancelar" ? "cancelamento" : "mudar para recorrente"}</p>}
      {(s.status === "ativa" || s.status === "pendente") && !s.request && (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.billing === "unica" && (
            <Button size="sm" variant="outline" data-testid={`sub-request-recurring-${s.id}`} onClick={() => onRequest(s, "recorrente")}>Tornar recorrente</Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`sub-request-cancel-${s.id}`} onClick={() => onRequest(s, "cancelar")}>Solicitar cancelamento</Button>
        </div>
      )}
    </div>
  );
}

function ApptCard({ a, actions }: { a: Appointment; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4" data-testid={`appointment-card-${a.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-semibold text-white">{dateLabel(a.date)} • {a.start}</p>
          <p className="text-sm text-zinc-300">{a.service_names.join(" + ")}</p>
          <p className="text-xs text-muted-foreground">Com {a.barber_name} • {PAYMENT_LABEL[a.payment_method]} • {brl(a.total)}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export default function ClientHub() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const me = useMe();
  const shop = useShop(slug);
  const isClient = me.data?.role === "client";
  const dash = useQuery({ queryKey: ["dashboard", slug], queryFn: () => apiGet<ClientDashboard>(`/client/shops/${slug}/dashboard`), enabled: isClient });
  const [tab, setTab] = useState(params.get("tab") ?? "inicio");
  const [reviewFor, setReviewFor] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [resched, setResched] = useState<Appointment | null>(null);
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("");
  const [subPlan, setSubPlan] = useState<Plan | null>(null);
  const [billing, setBilling] = useState<"unica" | "recorrente">("recorrente");
  const [dependent, setDependent] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dashboard", slug] });
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const cancel = useMutation({ mutationFn: (id: string) => apiPost(`/client/appointments/${id}/cancel`), onSuccess: () => { toast.success("Agendamento cancelado"); refresh(); }, onError: onErr });
  const review = useMutation({
    mutationFn: () => apiPost(`/client/appointments/${reviewFor?.id}/review`, { rating, comment }),
    onSuccess: () => { toast.success("Obrigado pela avaliação!"); setReviewFor(null); setComment(""); refresh(); queryClient.invalidateQueries({ queryKey: ["shop", slug] }); },
    onError: onErr,
  });
  const reschedule = useMutation({
    mutationFn: () => apiPost(`/client/appointments/${resched?.id}/reschedule`, { date: rDate, start: rTime }),
    onSuccess: () => { toast.success("Agendamento reagendado!"); setResched(null); refresh(); },
    onError: onErr,
  });
  const subscribe = useMutation({
    mutationFn: () => apiPost(`/client/shops/${slug}/subscriptions`, { plan_id: subPlan?.id, billing, dependent_name: dependent }),
    onSuccess: () => { toast.success("Adesão solicitada! A barbearia ativará após o pagamento."); setSubPlan(null); setDependent(""); refresh(); },
    onError: onErr,
  });
  const subRequest = useMutation({
    mutationFn: ({ s, r }: { s: Subscription; r: string }) => apiPost(`/client/subscriptions/${s.id}/request`, { request: r }),
    onSuccess: () => { toast.success("Solicitação enviada à barbearia"); refresh(); },
    onError: onErr,
  });

  if (me.isLoading) return null;
  if (!me.data) return <Navigate to={`/entrar?shop=${slug}&next=/b/${slug}/cliente`} replace />;
  if (!isClient) return <Navigate to="/painel" replace />;

  const d = dash.data;
  const s = shop.data?.shop;
  const activeSub = d?.subscriptions.find((x) => x.status === "ativa");
  const refLink = d ? `${window.location.origin}/entrar?shop=${slug}&ref=${d.member.referral_code}` : "";
  const rBarber = shop.data?.barbers.find((b) => b.id === resched?.barber_id);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <BrandMark to={`/b/${slug}`} />
          <button data-testid="logout-button" onClick={() => endSession(`/b/${slug}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold">
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <p className="overline">{s?.name}</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Olá, {me.data.name.split(" ")[0]}</h1>
        <Link to={`/b/${slug}/agendar`} data-testid="hub-book-button" className={buttonVariants({ size: "lg", className: "mt-5 h-12 w-full text-base sm:w-auto" })}>
          <CalendarPlus className="size-5" /> Novo agendamento
        </Link>

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inicio" data-testid="hub-tab-inicio">Início</TabsTrigger>
            <TabsTrigger value="agendamentos" data-testid="hub-tab-agendamentos">Agenda</TabsTrigger>
            <TabsTrigger value="planos" data-testid="hub-tab-planos">Planos</TabsTrigger>
            <TabsTrigger value="indique" data-testid="hub-tab-indique">Indique</TabsTrigger>
          </TabsList>

          <TabsContent value="inicio" className="mt-5 space-y-5">
            {dash.isLoading && <Loader2 className="size-6 animate-spin text-gold" />}
            {activeSub ? (
              <div className="card-black p-5 gold-glow" data-testid="home-plan-balance">
                <p className="overline flex items-center gap-1.5"><Crown className="size-3.5" /> {activeSub.plan_name}</p>
                <p className="mt-2 text-lg text-white">Restam <span className="font-heading text-3xl font-bold text-gold-soft">{activeSub.credits_left}</span> de {activeSub.credits_total} serviços este mês</p>
              </div>
            ) : (
              <button data-testid="home-plans-cta" onClick={() => setTab("planos")} className="card-black w-full p-5 text-left">
                <p className="overline">Clube de assinatura</p>
                <p className="mt-1 text-white">Economize com um plano mensal →</p>
              </button>
            )}
            {d && (
              <div className="rounded-2xl border border-line bg-panel p-5" data-testid="loyalty-card">
                <div className="flex items-center justify-between">
                  <p className="overline">Cartão fidelidade</p>
                  <span className="text-xs text-muted-foreground">{d.member.loyalty_stamps}/{d.loyalty_target}</span>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {Array.from({ length: d.loyalty_target }, (_, i) => (
                    <div key={i} data-testid={`loyalty-stamp-${i}`}
                      className={cn("grid aspect-square place-items-center rounded-full border-2", i < d.member.loyalty_stamps ? "animate-stamp border-gold bg-[#2A2310] text-gold" : "border-dashed border-zinc-700 text-zinc-700")}
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <Scissors className="size-4" />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">A cada {d.loyalty_target} serviços avulsos concluídos, ganhe 1 corte grátis.</p>
              </div>
            )}
            <div>
              <p className="overline mb-3">Próximos horários</p>
              {d?.upcoming.length ? <div className="space-y-2.5">{d.upcoming.slice(0, 2).map((a) => <ApptCard key={a.id} a={a} />)}</div>
                : <Empty icon={<CalendarDays />} text="Nenhum horário agendado." />}
            </div>
          </TabsContent>

          <TabsContent value="agendamentos" className="mt-5 space-y-6">
            <div>
              <p className="overline mb-3">Futuros</p>
              {d?.upcoming.length ? (
                <div className="space-y-2.5">
                  {d.upcoming.map((a) => (
                    <ApptCard key={a.id} a={a} actions={<>
                      <Button size="sm" variant="outline" data-testid={`reschedule-button-${a.id}`} onClick={() => { setResched(a); setRDate(""); setRTime(""); }}>Reagendar</Button>
                      <Button size="sm" variant="ghost" data-testid={`cancel-button-${a.id}`} disabled={cancel.isPending} onClick={() => cancel.mutate(a.id)}>Cancelar</Button>
                    </>} />
                  ))}
                  <p className="text-xs text-muted-foreground">Cancelamentos e reagendamentos até {s?.cancel_min_hours}h antes do horário.</p>
                </div>
              ) : <Empty icon={<CalendarDays />} text="Nenhum agendamento futuro." testId="no-upcoming" />}
            </div>
            <div>
              <p className="overline mb-3 flex items-center gap-1.5"><History className="size-3.5" /> Histórico</p>
              {d?.history.length ? (
                <div className="space-y-2.5">
                  {d.history.map((a) => (
                    <ApptCard key={a.id} a={a} actions={a.status === "concluido" && !a.rated ? (
                      <Button size="sm" data-testid={`review-button-${a.id}`} onClick={() => { setReviewFor(a); setRating(5); }}><Star className="size-4" /> Avaliar</Button>
                    ) : a.rated ? <span className="text-xs text-gold">✓ Avaliado</span> : undefined} />
                  ))}
                </div>
              ) : <Empty icon={<History />} text="Seu histórico aparecerá aqui." />}
            </div>
          </TabsContent>

          <TabsContent value="planos" className="mt-5 space-y-6">
            {d && d.subscriptions.length > 0 && (
              <div className="space-y-3">
                <p className="overline">Minhas assinaturas</p>
                {d.subscriptions.map((x) => <SubCard key={x.id} s={x} onRequest={(sub, r) => subRequest.mutate({ s: sub, r })} />)}
              </div>
            )}
            <div>
              <p className="overline mb-3">Planos disponíveis</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {shop.data?.plans.map((p) => (
                  <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-panel p-5" data-testid={`plan-card-${p.id}`}>
                    <Crown className="size-5 text-gold" />
                    <p className="mt-2 font-heading font-semibold text-white">{p.name}</p>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.description}</p>
                    <p className="mt-3 font-heading text-2xl font-bold text-gold-soft">{brl(p.price)}<span className="text-xs font-normal text-muted-foreground">/mês • {p.credits} serviços</span></p>
                    <Button className="mt-4 h-11" data-testid={`subscribe-button-${p.id}`} onClick={() => { setSubPlan(p); setBilling("recorrente"); }}>Quero assinar</Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="indique" className="mt-5 space-y-5">
            {d && (
              <>
                <div className="card-black p-5 gold-glow">
                  <p className="overline flex items-center gap-1.5"><Gift className="size-3.5" /> Indique e ganhe</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Seu amigo cria a conta com seu código e, no primeiro atendimento concluído, você ganha{" "}
                    <b className="text-gold-soft">{s?.referral_reward_type === "percent" ? `${s.referral_reward_value}% OFF` : brl(s?.referral_reward_value ?? 0)}</b> no próximo serviço.
                  </p>
                  <p className="mt-4 font-mono text-3xl font-bold tracking-widest text-white" data-testid="referral-code">{d.member.referral_code}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button data-testid="copy-referral-link" variant="outline" onClick={() => { navigator.clipboard?.writeText(refLink); toast.success("Link copiado!"); }}><Copy className="size-4" /> Copiar link</Button>
                    <a data-testid="share-referral-whatsapp" href={waLink("", `Agende na ${s?.name} com meu código ${d.member.referral_code}: ${refLink}`).replace("wa.me/55?", "wa.me/?")} target="_blank" rel="noreferrer" className={buttonVariants()}>
                      <Share2 className="size-4" /> Enviar no WhatsApp
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-line bg-panel p-4"><Users className="size-5 text-gold" /><p className="mt-2 font-heading text-2xl font-bold text-white" data-testid="referrals-count">{d.referrals_count}</p><p className="text-xs text-muted-foreground">amigos indicados</p></div>
                  <div className="rounded-2xl border border-line bg-panel p-4"><Gift className="size-5 text-gold" /><p className="mt-2 font-heading text-2xl font-bold text-white">{d.referrals_rewarded}</p><p className="text-xs text-muted-foreground">recompensas ganhas</p></div>
                </div>
                <div>
                  <p className="overline mb-3">Meus descontos disponíveis</p>
                  {d.coupons.length ? d.coupons.map((c) => (
                    <div key={c.id} className="mb-2 flex items-center gap-3 rounded-xl border border-gold/30 bg-[#2A2310] p-3" data-testid={`coupon-${c.id}`}>
                      <Ticket className="size-5 text-gold" />
                      <div className="flex-1"><p className="font-semibold text-gold-soft">{c.kind === "valor" ? brl(c.value) : `${c.value}% OFF`}</p><p className="text-xs text-zinc-300">{c.origin}</p></div>
                    </div>
                  )) : <Empty icon={<Ticket />} text="Nenhum desconto disponível ainda." />}
                  <p className="mt-2 text-xs text-muted-foreground">Aplique seus descontos no passo de pagamento do agendamento.</p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Avaliar atendimento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{reviewFor?.service_names.join(" + ")} com {reviewFor?.barber_name}</p>
          <StarPicker value={rating} onChange={setRating} />
          <Textarea data-testid="review-comment-input" placeholder="Conte como foi (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button data-testid="review-submit-button" disabled={review.isPending} onClick={() => review.mutate()}>Enviar avaliação</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resched} onOpenChange={(o) => !o && setResched(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reagendar</DialogTitle></DialogHeader>
          {resched && rBarber && (
            <SlotPicker slug={slug} barberId={rBarber.id} workDays={rBarber.work_days} duration={resched.duration} date={rDate} time={rTime}
              excludeId={resched.id} onChange={(dd, t) => { setRDate(dd); setRTime(t); }} />
          )}
          <Button data-testid="reschedule-confirm-button" disabled={!rDate || !rTime || reschedule.isPending} onClick={() => reschedule.mutate()}>Confirmar novo horário</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subPlan} onOpenChange={(o) => !o && setSubPlan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assinar {subPlan?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{subPlan && `${brl(subPlan.price)}/mês • ${subPlan.credits} serviços`}</p>
          <div className="grid gap-2">
            {(["recorrente", "unica"] as const).map((b) => (
              <button key={b} data-testid={`billing-option-${b}`} onClick={() => setBilling(b)}
                className={cn("rounded-xl border p-3 text-left text-sm", billing === b ? "border-gold bg-[#2A2310]" : "border-line bg-elev")}>
                <p className="font-semibold text-white">{b === "recorrente" ? "Adesão recorrente" : "Adesão única (1 mês)"}</p>
                <p className="text-xs text-muted-foreground">{b === "recorrente" ? "Renova automaticamente todo mês até você pedir o cancelamento." : "Vale por um ciclo de 30 dias; pode tornar recorrente depois."}</p>
              </button>
            ))}
          </div>
          {subPlan?.allows_dependent && (
            <div className="space-y-1.5"><Label>Nome do dependente</Label><Input data-testid="dependent-name-input" value={dependent} onChange={(e) => setDependent(e.target.value)} /></div>
          )}
          <Button data-testid="subscribe-confirm-button" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>Solicitar adesão</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
