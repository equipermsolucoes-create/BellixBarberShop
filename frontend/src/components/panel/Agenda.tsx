import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, ChevronLeft, ChevronRight, Lock, MessageCircle, Minus, Plus, Receipt, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, Empty, StatusBadge } from "@/components/common";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { addDays, brl, dateLabel, errMsg, PAYMENT_LABEL, waLink } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { AgendaOut, Appointment, Barber, PaymentMethod, Product, Service, UserOut } from "@/lib/types";

const METHODS: PaymentMethod[] = ["pix", "credito", "debito", "plano"];

function MethodPicker({ value, onChange, testPrefix, allowPlan = true }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; testPrefix: string; allowPlan?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {METHODS.filter((m) => allowPlan || m !== "plano").map((m) => (
        <button key={m} type="button" data-testid={`${testPrefix}-${m}`} onClick={() => onChange(m)}
          className={cn("rounded-xl border px-3 py-2.5 text-sm transition-colors", value === m ? "border-gold bg-[#2A2310] text-gold-soft" : "border-line bg-elev text-zinc-300")}>
          {PAYMENT_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

export default function Agenda({ me }: { me: UserOut }) {
  const today = useToday();
  const [date, setDate] = useState("");
  const day = date || today.data || "";
  const [barberFilter, setBarberFilter] = useState("");
  const agenda = useQuery({
    queryKey: ["agenda", day, barberFilter],
    queryFn: () => apiGet<AgendaOut>(`/admin/agenda?date=${day}${barberFilter ? `&barber_id=${barberFilter}` : ""}`),
    enabled: !!day,
  });
  const services = useQuery({ queryKey: ["admin", "services"], queryFn: () => apiGet<Service[]>("/admin/services") });
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: () => apiGet<Product[]>("/admin/products") });

  const [walkOpen, setWalkOpen] = useState(false);
  const [walk, setWalk] = useState({ client_name: "", client_phone: "", service_ids: [] as string[], barber_id: "", start: "", payment_method: "pix" as PaymentMethod });
  const [blockOpen, setBlockOpen] = useState(false);
  const [block, setBlock] = useState({ barber_id: "", date: "", start: "", end: "", reason: "", fullDay: false });
  const [comanda, setComanda] = useState<Appointment | null>(null);
  const [cMethod, setCMethod] = useState<PaymentMethod>("pix");
  const [cItems, setCItems] = useState<Record<string, number>>({});

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["agenda"] }); queryClient.invalidateQueries({ queryKey: ["finance"] }); };
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const allBarbers = useQuery({ queryKey: ["admin", "barbers"], queryFn: () => apiGet<Barber[]>("/admin/barbers"), enabled: me.role === "admin" });
  const barbers = (me.role === "admin" ? allBarbers.data : agenda.data?.barbers) ?? agenda.data?.barbers ?? [];
  const defaultBarber = me.role === "barber" ? me.barber_id ?? "" : barberFilter || barbers[0]?.id || "";

  const walkM = useMutation({
    mutationFn: () => apiPost("/admin/appointments", { ...walk, barber_id: walk.barber_id || defaultBarber, date: day }),
    onSuccess: () => { toast.success("Encaixe lançado!"); setWalkOpen(false); refresh(); },
    onError: onErr,
  });
  const blockM = useMutation({
    mutationFn: () => apiPost("/admin/blocks", {
      barber_id: block.barber_id || defaultBarber, date: block.date || day, reason: block.reason,
      start: block.fullDay ? "" : block.start, end: block.fullDay ? "" : block.end,
    }),
    onSuccess: () => { toast.success("Horário bloqueado"); setBlockOpen(false); refresh(); },
    onError: onErr,
  });
  const delBlock = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/blocks/${id}`), onSuccess: () => { toast.success("Bloqueio removido"); refresh(); }, onError: onErr });
  const cancelM = useMutation({ mutationFn: (id: string) => apiPost(`/admin/appointments/${id}/cancel`), onSuccess: () => { toast.success("Agendamento cancelado"); refresh(); }, onError: onErr });
  const completeM = useMutation({
    mutationFn: () => apiPost(`/admin/appointments/${comanda?.id}/complete`, {
      payment_method: cMethod, products: Object.entries(cItems).filter(([, q]) => q > 0).map(([product_id, qty]) => ({ product_id, qty })),
    }),
    onSuccess: () => { toast.success("Comanda fechada com sucesso!"); setComanda(null); refresh(); queryClient.invalidateQueries({ queryKey: ["admin", "products"] }); },
    onError: onErr,
  });

  const productsTotal = Object.entries(cItems).reduce((a, [id, q]) => a + (products.data?.find((p) => p.id === id)?.price ?? 0) * q, 0);
  const servicesDue = comanda ? (cMethod === "plano" ? 0 : comanda.price - (comanda.payment_method === "plano" ? 0 : comanda.discount)) : 0;
  const appts = agenda.data?.appointments ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1">
          <Button size="icon-sm" variant="ghost" data-testid="agenda-prev-day" onClick={() => setDate(addDays(day, -1))}><ChevronLeft className="size-4" /></Button>
          <Input type="date" data-testid="agenda-date-input" value={day} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 border-0 bg-transparent font-mono" />
          <Button size="icon-sm" variant="ghost" data-testid="agenda-next-day" onClick={() => setDate(addDays(day, 1))}><ChevronRight className="size-4" /></Button>
        </div>
        <p className="font-heading font-semibold capitalize text-white">{day && dateLabel(day)}</p>
        <div className="ml-auto flex gap-2">
          <Button data-testid="new-walkin-button" onClick={() => { setWalk({ client_name: "", client_phone: "", service_ids: [], barber_id: defaultBarber, start: "", payment_method: "pix" }); setWalkOpen(true); }}>
            <UserPlus className="size-4" /> Novo Encaixe
          </Button>
          <Button variant="outline" data-testid="new-block-button" onClick={() => { setBlock({ barber_id: defaultBarber, date: day, start: "", end: "", reason: "", fullDay: false }); setBlockOpen(true); }}>
            <Lock className="size-4" /> Bloquear
          </Button>
        </div>
      </div>

      {me.role === "admin" && barbers.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button data-testid="agenda-filter-all" onClick={() => setBarberFilter("")} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm", !barberFilter ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>Todos</button>
          {barbers.map((b) => (
            <button key={b.id} data-testid={`agenda-filter-${b.id}`} onClick={() => setBarberFilter(b.id)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm", barberFilter === b.id ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>{b.name}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[["Agendados", appts.filter((a) => a.status === "agendado").length], ["Concluídos", appts.filter((a) => a.status === "concluido").length],
          ["Faturado", brl(appts.filter((a) => a.status === "concluido").reduce((x, a) => x + a.total, 0))]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-panel p-3.5"><p className="text-xs text-muted-foreground">{l}</p><p className="font-heading text-xl font-bold text-white">{v}</p></div>
        ))}
      </div>

      {agenda.data?.blocks.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-xl border border-dashed border-red-900 bg-red-950/30 px-4 py-2.5 text-sm" data-testid={`block-row-${b.id}`}>
          <Ban className="size-4 text-red-400" />
          <span className="flex-1 text-red-200">{b.start ? `${b.start}–${b.end}` : "Dia inteiro"} • {barbers.find((x) => x.id === b.barber_id)?.name} {b.reason && `• ${b.reason}`}</span>
          <Button size="icon-sm" variant="ghost" data-testid={`delete-block-${b.id}`} onClick={() => delBlock.mutate(b.id)}><X className="size-4" /></Button>
        </div>
      ))}

      <div className="space-y-2.5" data-testid="agenda-list">
        {agenda.isLoading && <div className="h-24 animate-pulse rounded-2xl bg-panel" />}
        {!agenda.isLoading && appts.length === 0 && <Empty icon={<Receipt />} text="Nenhum agendamento neste dia." testId="agenda-empty" />}
        {appts.map((a) => (
          <div key={a.id} data-testid={`agenda-item-${a.id}`} className={cn("flex gap-3 rounded-2xl border bg-panel p-4", a.status === "cancelado" ? "border-line opacity-50" : "border-line hover:border-gold/40")}>
            <div className="w-14 shrink-0 text-center">
              <p className="font-mono text-lg font-bold text-gold-soft">{a.start}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{a.end}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading font-semibold text-white">{a.client_name}</p>
                <StatusBadge status={a.status} />
                {a.walk_in && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">Encaixe</span>}
              </div>
              <p className="text-sm text-zinc-300">{a.service_names.join(" + ")}</p>
              <p className="text-xs text-muted-foreground">{a.barber_name} • {PAYMENT_LABEL[a.payment_method]} • {brl(a.total)}</p>
              {a.status === "agendado" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" data-testid={`complete-button-${a.id}`} onClick={() => { setComanda(a); setCMethod(a.payment_method); setCItems({}); }}>
                    <Receipt className="size-4" /> Concluir
                  </Button>
                  {a.client_phone && (
                    <a data-testid={`reminder-button-${a.id}`} target="_blank" rel="noreferrer"
                      href={waLink(a.client_phone, `Olá ${a.client_name.split(" ")[0]}! Passando para confirmar seu horário em ${dateLabel(a.date)} às ${a.start} (${a.service_names.join(" + ")}) com ${a.barber_name}. Podemos confirmar? 💈`)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#128C7E] px-2.5 text-[0.8rem] font-medium text-white hover:bg-[#0f7a6e]">
                      <MessageCircle className="size-3.5" /> Lembrete
                    </a>
                  )}
                  <Button size="sm" variant="ghost" data-testid={`agenda-cancel-${a.id}`} onClick={() => cancelM.mutate(a.id)}>Cancelar</Button>
                </div>
              )}
              {a.products.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Produtos: {a.products.map((p) => `${p.qty}x ${p.name}`).join(", ")}</p>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={walkOpen} onOpenChange={setWalkOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Encaixe / Agendamento Manual</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Nome do cliente</Label><Input data-testid="walkin-name-input" value={walk.client_name} onChange={(e) => setWalk({ ...walk, client_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input data-testid="walkin-phone-input" inputMode="tel" value={walk.client_phone} onChange={(e) => setWalk({ ...walk, client_phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Horário</Label><Input data-testid="walkin-time-input" type="time" value={walk.start} onChange={(e) => setWalk({ ...walk, start: e.target.value })} /></div>
          </div>
          {me.role === "admin" && (
            <div className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <button key={b.id} data-testid={`walkin-barber-${b.id}`} onClick={() => setWalk({ ...walk, barber_id: b.id })}
                  className={cn("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm", walk.barber_id === b.id ? "border-gold bg-[#2A2310]" : "border-line")}>
                  <Avatar name={b.name} url={b.photo_url} className="size-7 text-[10px]" />{b.name}
                </button>
              ))}
            </div>
          )}
          <Label>Serviços</Label>
          <div className="flex flex-wrap gap-2">
            {services.data?.filter((s) => s.active).map((s) => {
              const on = walk.service_ids.includes(s.id);
              return (
                <button key={s.id} data-testid={`walkin-service-${s.id}`} onClick={() => setWalk({ ...walk, service_ids: on ? walk.service_ids.filter((x) => x !== s.id) : [...walk.service_ids, s.id] })}
                  className={cn("rounded-full border px-3 py-1.5 text-xs", on ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>{s.name}</button>
              );
            })}
          </div>
          <Label>Forma de pagamento prevista</Label>
          <MethodPicker value={walk.payment_method} onChange={(m) => setWalk({ ...walk, payment_method: m })} testPrefix="walkin-method" allowPlan={false} />
          <Button data-testid="walkin-submit-button" disabled={!walk.client_name || !walk.start || !walk.service_ids.length || walkM.isPending} onClick={() => walkM.mutate()}>Lançar encaixe</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bloquear Horário / Folga</DialogTitle></DialogHeader>
          {me.role === "admin" && (
            <div className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <button key={b.id} data-testid={`block-barber-${b.id}`} onClick={() => setBlock({ ...block, barber_id: b.id })}
                  className={cn("rounded-full border px-3 py-1.5 text-sm", block.barber_id === b.id ? "border-gold bg-[#2A2310] text-gold-soft" : "border-line")}>{b.name}</button>
              ))}
            </div>
          )}
          <div className="space-y-1.5"><Label>Data</Label><Input data-testid="block-date-input" type="date" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="block-fullday-checkbox" checked={block.fullDay} onChange={(e) => setBlock({ ...block, fullDay: e.target.checked })} className="accent-[#D4AF37]" /> Dia inteiro (folga)</label>
          {!block.fullDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Início</Label><Input data-testid="block-start-input" type="time" value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fim</Label><Input data-testid="block-end-input" type="time" value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} /></div>
            </div>
          )}
          <div className="space-y-1.5"><Label>Motivo</Label><Input data-testid="block-reason-input" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} /></div>
          <Button data-testid="block-submit-button" disabled={blockM.isPending || (!block.fullDay && (!block.start || !block.end))} onClick={() => blockM.mutate()}>Bloquear</Button>
        </DialogContent>
      </Dialog>

      <Sheet open={!!comanda} onOpenChange={(o) => !o && setComanda(null)}>
        <SheetContent className="w-full overflow-y-auto bg-panel sm:max-w-md">
          <SheetHeader><SheetTitle>Fechar comanda</SheetTitle></SheetHeader>
          {comanda && (
            <div className="space-y-5 px-4 pb-6">
              <div className="card-black p-4">
                <p className="font-heading font-semibold text-white">{comanda.client_name}</p>
                <p className="text-sm text-zinc-300">{comanda.service_names.join(" + ")}</p>
                <p className="font-mono text-sm text-gold-soft">{brl(comanda.price)}</p>
              </div>
              <div>
                <p className="overline mb-2">Produtos consumidos</p>
                <div className="space-y-2">
                  {products.data?.filter((p) => p.active).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-elev px-3 py-2">
                      <div className="flex-1"><p className="text-sm text-white">{p.name}</p><p className="text-xs text-muted-foreground">{brl(p.price)} • estoque {p.stock}</p></div>
                      <Button size="icon-sm" variant="outline" data-testid={`comanda-minus-${p.id}`} onClick={() => setCItems({ ...cItems, [p.id]: Math.max(0, (cItems[p.id] ?? 0) - 1) })}><Minus className="size-3" /></Button>
                      <span className="w-5 text-center font-mono" data-testid={`comanda-qty-${p.id}`}>{cItems[p.id] ?? 0}</span>
                      <Button size="icon-sm" variant="outline" data-testid={`comanda-plus-${p.id}`} disabled={(cItems[p.id] ?? 0) >= p.stock} onClick={() => setCItems({ ...cItems, [p.id]: (cItems[p.id] ?? 0) + 1 })}><Plus className="size-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="overline mb-2">Forma de pagamento no caixa</p>
                <MethodPicker value={cMethod} onChange={setCMethod} testPrefix="comanda-method" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {cMethod === "plano" ? "1 crédito será descontado do saldo do plano do cliente." : comanda.client_id ? "O cliente ganhará 1 selo no cartão fidelidade." : "Cliente avulso sem cadastro."}
                </p>
              </div>
              <div className="space-y-1 rounded-xl border border-line p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Serviços</span><span>{brl(servicesDue)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Produtos</span><span>{brl(productsTotal)}</span></div>
                <div className="flex justify-between pt-2 font-heading text-lg font-bold text-gold-soft"><span>Total</span><span data-testid="comanda-total">{brl(servicesDue + productsTotal)}</span></div>
              </div>
              <Button className="h-12 w-full text-base" data-testid="comanda-submit-button" disabled={completeM.isPending} onClick={() => completeM.mutate()}>
                Concluir atendimento
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

