import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, ImageUpload } from "@/components/common";
import { apiGet, apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Shop, ShopUpdate } from "@/lib/types";

export default function Settings() {
  const shop = useQuery({ queryKey: ["admin", "shop"], queryFn: () => apiGet<Shop>("/admin/shop") });
  const [form, setForm] = useState<ShopUpdate | null>(null);
  useEffect(() => {
    if (shop.data && !form) {
      const { id: _i, active: _a, saas_plan: _s, created_at: _c, ...rest } = shop.data;
      setForm(rest);
    }
  }, [shop.data, form]);
  const save = useMutation({
    mutationFn: () => apiPut<Shop>("/admin/shop", form),
    onSuccess: () => { toast.success("Configurações salvas!"); queryClient.invalidateQueries(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!form) return <div className="h-40 animate-pulse rounded-2xl bg-panel" />;
  const set = <K extends keyof ShopUpdate>(k: K, v: ShopUpdate[K]) => setForm({ ...form, [k]: v });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <p className="overline flex items-center gap-1.5"><Store className="size-3.5" /> Dados da loja</p>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gold/30 bg-[#2A2310]/40 p-4" data-testid="identity-block">
          <Avatar name={form.name || "?"} url={form.logo_url} className="size-20 rounded-2xl text-2xl" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-semibold text-white" data-testid="identity-preview-name">{form.name || "Nome da barbearia"}</p>
            <p className="text-xs text-muted-foreground">Logo e nome aparecem na sua página pública, no painel e no app instalado.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ImageUpload testId="logo-upload-button" label={form.logo_url ? "Trocar logo" : "Enviar logo"} onUploaded={(url) => { set("logo_url", url); toast.success("Logo carregada — clique em Salvar"); }} />
              {form.logo_url && <Button variant="ghost" size="sm" data-testid="logo-remove-button" onClick={() => set("logo_url", null)}>Remover</Button>}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Nome da barbearia</Label><Input data-testid="settings-name-input" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Link (slug)</Label>
            <div className="flex items-center rounded-lg border border-input pl-2 text-sm text-muted-foreground">/b/<Input data-testid="settings-slug-input" className="border-0" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label><Input data-testid="settings-address-input" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Link do Google Maps</Label><Input data-testid="settings-maps-input" value={form.maps_url} onChange={(e) => set("maps_url", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>WhatsApp de atendimento</Label><Input data-testid="settings-whatsapp-input" inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Horário de funcionamento</Label><Input data-testid="settings-hours-input" value={form.hours_text} onChange={(e) => set("hours_text", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Antecedência mínima p/ cancelar (horas)</Label><Input data-testid="settings-cancel-hours-input" type="number" min={0} value={form.cancel_min_hours} onChange={(e) => set("cancel_min_hours", Number(e.target.value))} /></div>
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <p className="overline flex items-center gap-1.5"><Gift className="size-3.5" /> Indicação e fidelidade</p>
        <Label>Recompensa por indicação</Label>
        <div className="flex gap-2">
          {(["valor", "percent"] as const).map((t) => (
            <button key={t} data-testid={`referral-type-${t}`} onClick={() => set("referral_reward_type", t)}
              className={cn("flex-1 rounded-xl border py-2 text-sm", form.referral_reward_type === t ? "border-gold bg-[#2A2310] text-gold-soft" : "border-line")}>
              {t === "valor" ? "Valor (R$)" : "Porcentagem (%)"}
            </button>
          ))}
        </div>
        <div className="space-y-1.5"><Label>{form.referral_reward_type === "valor" ? "Desconto em R$" : "Desconto em %"}</Label>
          <Input data-testid="settings-referral-value-input" type="number" value={form.referral_reward_value} onChange={(e) => set("referral_reward_value", Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Serviços avulsos para ganhar 1 corte grátis</Label>
          <Input data-testid="settings-loyalty-input" type="number" min={1} value={form.loyalty_target} onChange={(e) => set("loyalty_target", Number(e.target.value))} /></div>
        <Button className="h-11 w-full" data-testid="settings-save-button" disabled={save.isPending} onClick={() => save.mutate()}>Salvar configurações</Button>
      </section>
    </div>
  );
}
