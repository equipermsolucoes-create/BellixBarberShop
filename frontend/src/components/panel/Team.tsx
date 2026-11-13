import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, ImageUpload, Stars } from "@/components/common";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg, WEEKDAYS } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Barber, BarberIn } from "@/lib/types";

const EMPTY: BarberIn = { name: "", photo_url: null, specialties: [], work_days: [0, 1, 2, 3, 4, 5], start: "09:00", end: "19:00", lunch_start: "12:00", lunch_end: "13:00", commission: 50, active: true, email: "", password: "" };

export default function Team() {
  const list = useQuery({ queryKey: ["admin", "barbers"], queryFn: () => apiGet<Barber[]>("/admin/barbers") });
  const [editing, setEditing] = useState<Barber | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BarberIn>(EMPTY);
  const [spec, setSpec] = useState("");
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["admin", "barbers"] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, specialties: spec.split(",").map((s) => s.trim()).filter(Boolean), email: form.email || null, password: form.password || null };
      return editing ? apiPut(`/admin/barbers/${editing.id}`, body) : apiPost("/admin/barbers", body);
    },
    onSuccess: () => { toast.success("Barbeiro salvo!"); setOpen(false); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/barbers/${id}`), onSuccess: () => { toast.success("Barbeiro desativado"); refresh(); }, onError: (e) => toast.error(errMsg(e)) });

  const openForm = (b: Barber | null) => {
    setEditing(b);
    setForm(b ? { ...b, email: "", password: "" } : EMPTY);
    setSpec(b?.specialties.join(", ") ?? "");
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Equipe, expediente e comissões individuais.</p>
        <Button data-testid="add-barber-button" onClick={() => openForm(null)}><Plus className="size-4" /> Novo barbeiro</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.data?.map((b) => (
          <div key={b.id} className={cn("flex gap-4 rounded-2xl border border-line bg-panel p-4", !b.active && "opacity-50")} data-testid={`barber-row-${b.id}`}>
            <Avatar name={b.name} url={b.photo_url} className="size-14" />
            <div className="min-w-0 flex-1">
              <p className="font-heading font-semibold text-white">{b.name} {!b.active && <span className="text-xs">(inativo)</span>}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stars value={b.rating} size={12} /> {b.rating_count} aval.</div>
              <p className="mt-1 text-xs text-muted-foreground">{b.work_days.map((d) => WEEKDAYS[d]).join(", ")} • {b.start}–{b.end}{b.lunch_start && ` • almoço ${b.lunch_start}–${b.lunch_end}`}</p>
              <p className="text-xs text-gold-soft">Comissão {b.commission}%</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon-sm" variant="ghost" data-testid={`edit-barber-${b.id}`} onClick={() => openForm(b)}><Pencil className="size-4" /></Button>
              {b.active && <Button size="icon-sm" variant="ghost" data-testid={`delete-barber-${b.id}`} onClick={() => confirm("Desativar este barbeiro?") && del.mutate(b.id)}><Trash2 className="size-4" /></Button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar barbeiro" : "Novo barbeiro"}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={form.name || "?"} url={form.photo_url} className="size-16" />
            <ImageUpload testId="barber-photo-upload" label="Foto" onUploaded={(url) => setForm({ ...form, photo_url: url })} />
          </div>
          <div className="space-y-1.5"><Label>Nome</Label><Input data-testid="barber-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Especialidades (separadas por vírgula)</Label><Input data-testid="barber-specialties-input" value={spec} onChange={(e) => setSpec(e.target.value)} /></div>
          <Label>Dias de trabalho</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w, i) => {
              const on = form.work_days.includes(i);
              return (
                <button key={w} type="button" data-testid={`barber-day-${i}`} onClick={() => setForm({ ...form, work_days: on ? form.work_days.filter((d) => d !== i) : [...form.work_days, i].sort() })}
                  className={cn("h-9 w-11 rounded-lg border text-xs", on ? "border-gold bg-gold text-ink" : "border-line text-zinc-300")}>{w}</button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início</Label><Input data-testid="barber-start-input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input data-testid="barber-end-input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Almoço início</Label><Input data-testid="barber-lunch-start-input" type="time" value={form.lunch_start} onChange={(e) => setForm({ ...form, lunch_start: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Almoço fim</Label><Input data-testid="barber-lunch-end-input" type="time" value={form.lunch_end} onChange={(e) => setForm({ ...form, lunch_end: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Comissão (%)</Label><Input data-testid="barber-commission-input" type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: Number(e.target.value) })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.active} data-testid="barber-active-checkbox" onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" /> Ativo</label>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs text-muted-foreground">Acesso ao painel do barbeiro (opcional{editing ? "; deixe em branco para manter" : ""})</p>
            <div className="grid grid-cols-2 gap-3">
              <Input data-testid="barber-email-input" placeholder="E-mail" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input data-testid="barber-password-input" placeholder="Senha" type="password" value={form.password ?? ""} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <Button data-testid="barber-save-button" disabled={save.isPending || form.name.length < 2} onClick={() => save.mutate()}>Salvar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
