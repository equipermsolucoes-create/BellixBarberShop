import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CalendarCheck, DollarSign, ExternalLink, LogOut, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, BrandMark } from "@/components/common";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { SaasPlan, SuperMetrics, SuperShop } from "@/lib/types";

const EMPTY = { name: "", slug: "", whatsapp: "", admin_name: "", admin_email: "", admin_password: "", saas_plan: "Básico" };

export default function Super() {
  const me = useMe();
  const ok = me.data?.role === "superadmin";
  const shops = useQuery({ queryKey: ["super", "shops"], queryFn: () => apiGet<SuperShop[]>("/super/shops"), enabled: ok });
  const metrics = useQuery({ queryKey: ["super", "metrics"], queryFn: () => apiGet<SuperMetrics>("/super/metrics"), enabled: ok });
  const plans = useQuery({ queryKey: ["super", "plans"], queryFn: () => apiGet<SaasPlan[]>("/super/saas-plans"), enabled: ok });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [np, setNp] = useState({ name: "", price: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["super"] });
  const onErr = (e: unknown) => toast.error(errMsg(e));

  const create = useMutation({ mutationFn: () => apiPost("/super/shops", form), onSuccess: () => { toast.success("Barbearia criada!"); setOpen(false); setForm(EMPTY); refresh(); }, onError: onErr });
  const patch = useMutation({
    mutationFn: ({ id, active, saas_plan }: { id: string; active: boolean; saas_plan?: string }) => apiPatch(`/super/shops/${id}`, { active, saas_plan }),
    onSuccess: () => { toast.success("Barbearia atualizada"); refresh(); }, onError: onErr,
  });
  const addPlan = useMutation({ mutationFn: () => apiPost("/super/saas-plans", np), onSuccess: () => { setNp({ name: "", price: 0 }); refresh(); }, onError: onErr });
  const delPlan = useMutation({ mutationFn: (id: string) => apiDelete(`/super/saas-plans/${id}`), onSuccess: refresh, onError: onErr });

  if (me.isLoading) return null;
  if (!ok) return <Navigate to="/entrar" replace />;
  const m = metrics.data;

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3">
          <BrandMark to="/super" />
          <span className="rounded-full bg-[#2A2310] px-2.5 py-0.5 text-xs font-semibold text-gold-soft">Super Admin</span>
          <button data-testid="super-logout-button" onClick={() => endSession("/entrar")} className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-gold"><LogOut className="size-4" /> Sair</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl animate-fade-up px-5 pt-8">
        <p className="overline">Gestão da plataforma</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold text-white">Barbearias</h1>
          <Button data-testid="new-shop-button" onClick={() => setOpen(true)} className="h-11"><Plus className="size-4" /> Nova barbearia</Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="card-black col-span-2 p-5 gold-glow lg:col-span-1">
            <DollarSign className="size-5 text-gold" /><p className="mt-2 text-xs text-muted-foreground">MRR da plataforma</p>
            <p className="font-heading text-3xl font-bold text-white" data-testid="metric-mrr">{brl(m?.mrr ?? 0)}</p>
          </div>
          {[[Building2, "Barbearias ativas", m ? `${m.active_shops} / ${m.total_shops}` : "–", "metric-active"], [CalendarCheck, "Agendamentos", m?.total_appointments ?? "–", "metric-appointments"],
            [Users, "Clientes", m?.total_clients ?? "–", "metric-clients"]].map(([Icon, l, v, id]) => {
            const I = Icon as typeof Users;
            return (
              <div key={id as string} className="rounded-2xl border border-line bg-panel p-5">
                <I className="size-5 text-gold" /><p className="mt-2 text-xs text-muted-foreground">{l as string}</p>
                <p className="font-heading text-2xl font-bold text-white" data-testid={id as string}>{v as string}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-2.5" data-testid="super-shop-list">
          {shops.data?.map(({ shop, admin_email, appointments, barbers }) => (
            <div key={shop.id} className={cn("flex flex-wrap items-center gap-4 rounded-2xl border bg-panel p-4", shop.active ? "border-line" : "border-red-900/70")} data-testid={`super-shop-${shop.slug}`}>
              <Avatar name={shop.name} url={shop.logo_url} className="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold text-white">{shop.name}</p>
                <p className="text-xs text-muted-foreground">/b/{shop.slug} • {admin_email} • {barbers} barbeiro(s) • {appointments} agendamentos</p>
              </div>
              <select data-testid={`super-plan-select-${shop.slug}`} value={shop.saas_plan} onChange={(e) => patch.mutate({ id: shop.id, active: shop.active, saas_plan: e.target.value })}
                className="h-9 rounded-lg border border-input bg-elev px-2 text-sm">
                {plans.data?.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", shop.active ? "bg-[#064E3B] text-[#6EE7B7]" : "bg-red-950 text-red-300")}>{shop.active ? "Ativa" : "Suspensa"}</span>
              <Button size="sm" variant={shop.active ? "outline" : "default"} data-testid={`super-toggle-${shop.slug}`} onClick={() => patch.mutate({ id: shop.id, active: !shop.active })}>
                {shop.active ? "Suspender" : "Ativar"}
              </Button>
              <Link to={`/b/${shop.slug}`} target="_blank" className="text-muted-foreground hover:text-gold" data-testid={`super-open-${shop.slug}`}><ExternalLink className="size-4" /></Link>
            </div>
          ))}
        </div>

        <section className="mt-10 max-w-xl rounded-2xl border border-line bg-panel p-5">
          <p className="overline mb-3">Planos do SaaS</p>
          <div className="space-y-2">
            {plans.data?.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-elev px-3 py-2 text-sm" data-testid={`saas-plan-${p.id}`}>
                <span className="text-white">{p.name}</span>
                <span className="flex items-center gap-2 text-gold-soft">{brl(p.price)}/mês
                  <Button size="icon-xs" variant="ghost" data-testid={`saas-plan-delete-${p.id}`} onClick={() => delPlan.mutate(p.id)}><Trash2 className="size-3" /></Button></span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input data-testid="saas-plan-name-input" placeholder="Nome" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
            <Input data-testid="saas-plan-price-input" type="number" placeholder="Preço" className="w-28" value={np.price} onChange={(e) => setNp({ ...np, price: Number(e.target.value) })} />
            <Button data-testid="saas-plan-add-button" disabled={np.name.length < 2} onClick={() => addPlan.mutate()}>Adicionar</Button>
          </div>
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova barbearia</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Nome da barbearia</Label><Input data-testid="new-shop-name-input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></div>
          <div className="space-y-1.5"><Label>Slug (link)</Label><Input data-testid="new-shop-slug-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input data-testid="new-shop-whatsapp-input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Nome do administrador</Label><Input data-testid="new-shop-admin-name-input" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>E-mail do admin</Label><Input data-testid="new-shop-admin-email-input" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Senha do admin</Label><Input data-testid="new-shop-admin-password-input" type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Plano SaaS</Label>
            <select data-testid="new-shop-plan-select" value={form.saas_plan} onChange={(e) => setForm({ ...form, saas_plan: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-elev px-2 text-sm">
              {plans.data?.map((p) => <option key={p.id} value={p.name}>{p.name} — {brl(p.price)}</option>)}
            </select></div>
          <Button data-testid="new-shop-submit-button" disabled={create.isPending} onClick={() => create.mutate()}>Criar barbearia</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
