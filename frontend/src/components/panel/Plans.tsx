import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Empty, StatusBadge } from "@/components/common";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { brl, errMsg, waLink, WEEKDAYS } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Plan, PlanIn, Subscription } from "@/lib/types";

const EMPTY: PlanIn = { name: "", description: "", price: 0, credits: 4, weekdays: [], allows_dependent: false, active: true };

export default function Plans() {
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => apiGet<Plan[]>("/admin/plans") });
  const subs = useQuery({ queryKey: ["admin", "subscriptions"], queryFn: () => apiGet<Subscription[]>("/admin/subscriptions") });
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanIn>(EMPTY);
  const [adjust, setAdjust] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"todas" | Subscription["status"]>("todas");
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const refreshSubs = () => queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });

  const save = useMutation({
    mutationFn: () => (editing ? apiPut(`/admin/plans/${editing.id}`, form) : apiPost("/admin/plans", form)),
    onSuccess: () => { toast.success("Plano salvo!"); setOpen(false); queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }); },
    onError: onErr,
  });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/plans/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plans"] }), onError: onErr });
  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) => apiPost(`/admin/subscriptions/${id}/${action}`, body),
    onSuccess: () => { toast.success("Assinatura atualizada"); refreshSubs(); },
    onError: onErr,
  });

  const list = (subs.data ?? []).filter((s) => filter === "todas" || s.status === filter);
  const requests = (subs.data ?? []).filter((s) => s.request).length;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="overline">Planos mensais</p>
          <Button data-testid="add-plan-button" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }}><Plus className="size-4" /> Novo plano</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.data?.map((p) => (
            <div key={p.id} className="card-black p-4" data-testid={`admin-plan-${p.id}`}>
              <div className="flex items-start justify-between">
                <Crown className="size-5 text-gold" />
                <div className="flex">
                  <Button size="icon-sm" variant="ghost" data-testid={`edit-plan-${p.id}`} onClick={() => { setEditing(p); setForm(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" data-testid={`delete-plan-${p.id}`} onClick={() => confirm("Remover plano?") && del.mutate(p.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <p className="mt-2 font-heading font-semibold text-white">{p.name} {!p.active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
              <p className="text-xs text-muted-foreground">{p.credits} serviços/mês{p.weekdays.length ? ` • ${p.weekdays.map((d) => WEEKDAYS[d]).join(", ")}` : ""}{p.allows_dependent ? " • c/ dependente" : ""}</p>
              <p className="mt-2 font-heading text-xl font-bold text-gold-soft">{brl(p.price)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="overline mr-auto">Assinantes {requests > 0 && <span className="ml-2 rounded-full bg-amber-900 px-2 py-0.5 text-amber-200">{requests} solicitação(ões)</span>}</p>
          {(["todas", "pendente", "ativa", "cancelada", "expirada"] as const).map((f) => (
            <button key={f} data-testid={`subs-filter-${f}`} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs capitalize", filter === f ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>{f}</button>
          ))}
        </div>
        {list.length === 0 && <Empty icon={<Crown />} text="Nenhuma assinatura." testId="subs-empty" />}
        <div className="space-y-2.5">
          {list.map((s) => (
            <div key={s.id} className="rounded-2xl border border-line bg-panel p-4" data-testid={`sub-row-${s.id}`}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="mr-auto">
                  <p className="font-heading font-semibold text-white">{s.client_name} <span className="text-sm font-normal text-muted-foreground">• {s.plan_name}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {s.billing === "recorrente" ? "Recorrente" : "Única"} • {brl(s.price)}
                    {s.status === "ativa" && ` • saldo ${s.credits_left}/${s.credits_total} • ciclo até ${s.cycle_end}`}
                    {s.dependent_name && ` • dependente: ${s.dependent_name}`}
                  </p>
                  {s.request && <p className="mt-1 text-xs font-semibold text-amber-300">Cliente solicitou: {s.request === "cancelar" ? "cancelamento" : "mudar para recorrente"}</p>}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {s.status !== "ativa" && <Button size="sm" data-testid={`sub-activate-${s.id}`} onClick={() => act.mutate({ id: s.id, action: "activate" })}>Ativar</Button>}
                {s.status === "ativa" && <Button size="sm" variant="outline" data-testid={`sub-renew-${s.id}`} onClick={() => act.mutate({ id: s.id, action: "activate" })}>Renovar ciclo</Button>}
                {s.status !== "cancelada" && (
                  <Button size="sm" variant="outline" data-testid={`sub-billing-${s.id}`} onClick={() => act.mutate({ id: s.id, action: "billing", body: { billing: s.billing === "unica" ? "recorrente" : "unica" } })}>
                    {s.billing === "unica" ? "Incluir no recorrente" : "Tornar única"}
                  </Button>
                )}
                {s.status === "ativa" && (
                  <span className="flex items-center gap-1">
                    <Input type="number" min={0} className="h-7 w-16" data-testid={`sub-adjust-input-${s.id}`} value={adjust[s.id] ?? s.credits_left} onChange={(e) => setAdjust({ ...adjust, [s.id]: Number(e.target.value) })} />
                    <Button size="sm" variant="ghost" data-testid={`sub-adjust-${s.id}`} onClick={() => act.mutate({ id: s.id, action: "adjust", body: { credits_left: adjust[s.id] ?? s.credits_left } })}>Ajustar saldo</Button>
                  </span>
                )}
                {s.status !== "cancelada" && <Button size="sm" variant="ghost" className="text-red-400" data-testid={`sub-cancel-${s.id}`} onClick={() => confirm("Cancelar assinatura?") && act.mutate({ id: s.id, action: "cancel" })}>Cancelar</Button>}
                {s.client_phone && (
                  <a href={waLink(s.client_phone, `Olá ${s.client_name.split(" ")[0]}! Sobre sua assinatura ${s.plan_name}...`)} target="_blank" rel="noreferrer" data-testid={`sub-whatsapp-${s.id}`} className="ml-auto text-[#25D366]"><MessageCircle className="size-5" /></a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Nome</Label><Input data-testid="plan-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea data-testid="plan-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Preço mensal (R$)</Label><Input data-testid="plan-price-input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Serviços por mês</Label><Input data-testid="plan-credits-input" type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} /></div>
          </div>
          <Label>Dias válidos (vazio = todos)</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w, i) => {
              const on = form.weekdays.includes(i);
              return <button key={w} type="button" data-testid={`plan-day-${i}`} onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((d) => d !== i) : [...form.weekdays, i].sort() })}
                className={cn("h-9 w-11 rounded-lg border text-xs", on ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>{w}</button>;
            })}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="plan-dependent-checkbox" checked={form.allows_dependent} onChange={(e) => setForm({ ...form, allows_dependent: e.target.checked })} className="accent-[#D4AF37]" /> Permite dependente</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="plan-active-checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" /> Ativo</label>
          <Button data-testid="plan-save-button" disabled={save.isPending || form.name.length < 2} onClick={() => save.mutate()}>Salvar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
