import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Images, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, ImageUpload } from "@/components/common";
import { apiDelete, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { useShop } from "@/lib/hooks";
import { queryClient } from "@/lib/queryClient";
import type { UserOut } from "@/lib/types";

export default function Gallery({ me }: { me: UserOut }) {
  const slug = me.shop_slug ?? "";
  const shop = useShop(slug);
  const [caption, setCaption] = useState("");
  useQuery({ queryKey: ["noop"], queryFn: () => null, enabled: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shop", slug] });
  const add = useMutation({
    mutationFn: (url: string) => apiPost("/admin/gallery", { url, caption }),
    onSuccess: () => { setCaption(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => apiDelete(`/admin/gallery/${id}`), onSuccess: () => { toast.success("Foto removida"); refresh(); }, onError: (e) => toast.error(errMsg(e)) });

  return (
    <div className="space-y-5">
      <div className="card-black flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="overline">Vitrine de cortes</p>
          <p className="mt-1 text-sm text-muted-foreground">Tire a foto ao final do corte e publique direto na página da barbearia.</p>
        </div>
        <Input data-testid="gallery-caption-input" placeholder="Legenda (opcional)" value={caption} onChange={(e) => setCaption(e.target.value)} className="sm:w-56" />
        <ImageUpload testId="gallery-upload-button" label="Tirar / enviar foto" onUploaded={(url) => add.mutate(url)} />
      </div>
      {shop.data?.gallery.length === 0 && <Empty icon={<Images />} text="Nenhuma foto publicada ainda." testId="gallery-empty" />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="admin-gallery-grid">
        {shop.data?.gallery.map((g) => (
          <figure key={g.id} className="group relative overflow-hidden rounded-2xl border border-line bg-panel">
            <img src={g.url} alt={g.caption || "Corte"} className="aspect-[4/5] w-full object-cover" />
            {g.caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{g.caption}</figcaption>}
            {me.role === "admin" && (
              <Button size="icon-sm" variant="destructive" data-testid={`gallery-delete-${g.id}`} onClick={() => del.mutate(g.id)} className="absolute right-2 top-2">
                <Trash2 className="size-4" />
              </Button>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
