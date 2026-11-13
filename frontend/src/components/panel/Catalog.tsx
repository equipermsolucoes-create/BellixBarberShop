import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty } from "@/components/common";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { brl, errMsg } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import type { Product, ProductIn, Service, ServiceIn } from "@/lib/types";

type Kind = "services" | "products";
type Item = Service | Product;
type Form = { name: string; price: number; active: boolean; duration: number; stock: number };

export default function Catalog({ kind }: { kind: Kind }) {
  const isSvc = kind === "services";
  const list = useQuery({ queryKey: ["admin", kind], queryFn: () => apiGet<Item[]>(`/admin/${kind}`) });
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ name: "", price: 0, active: true, duration: 30, stock: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", kind] });

  const save = useMutation({
    mutationFn: () => {
      const body: ServiceIn | ProductIn = isSvc
        ? { name: form.name, price: form.price, duration: form.duration, active: form.active }
        : { name: form.name, price: form.price, stock: form.stock, active: form.active };
      return editing ? apiPut(`/admin/${kind}/${editing.id}`, body) : apiPost(`/admin/${kind}`, body);
    },
    onSuccess: () => { toast.success("Salvo!"); setOpen(false); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/${kind}/${id}`), onSuccess: () => { toast.success("Removido"); refresh(); }, onError: (e) => toast.error(errMsg(e)) });

  const openForm = (it: Item | null) => {
    setEditing(it);
    setForm({
      name: it?.name ?? "", price: it?.price ?? 0, active: it?.active ?? true,
      duration: it && "duration" in it ? it.duration : 30, stock: it && "stock" in it ? it.stock : 0,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{isSvc ? "Edite preços, durações e adicione novos serviços." : "Produtos para venda/consumo e controle de estoque."}</p>
        <Button data-testid={`add-${kind}-button`} onClick={() => openForm(null)}><Plus className="size-4" /> Adicionar</Button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {list.data?.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-4" data-testid={`${kind}-row-${it.id}`}>
            {isSvc ? <Scissors className="size-4 text-gold" /> : <Package className="size-4 text-gold" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{it.name} {!it.active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
              <p className="text-xs text-muted-foreground">
                {brl(it.price)} • {"duration" in it ? `${it.duration} min` : <span className={(it as Product).stock < 5 ? "text-amber-300" : ""}>estoque {(it as Product).stock}</span>}
              </p>
            </div>
            <Button size="icon-sm" variant="ghost" data-testid={`edit-${kind}-${it.id}`} onClick={() => openForm(it)}><Pencil className="size-4" /></Button>
            <Button size="icon-sm" variant="ghost" data-testid={`delete-${kind}-${it.id}`} onClick={() => confirm("Remover este item?") && del.mutate(it.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
      {list.data?.length === 0 && <Empty icon={<Package />} text="Nada cadastrado ainda." />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} {isSvc ? "serviço" : "produto"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Nome</Label><Input data-testid="catalog-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Preço (R$)</Label><Input data-testid="catalog-price-input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
            {isSvc ? (
              <div className="space-y-1.5"><Label>Duração (min)</Label><Input data-testid="catalog-duration-input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></div>
            ) : (
              <div className="space-y-1.5"><Label>Estoque</Label><Input data-testid="catalog-stock-input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" data-testid="catalog-active-checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[#D4AF37]" /> Ativo</label>
          <Button data-testid="catalog-save-button" disabled={save.isPending || form.name.length < 2} onClick={() => save.mutate()}>Salvar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
