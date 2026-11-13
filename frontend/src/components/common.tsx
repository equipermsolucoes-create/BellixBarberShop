import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Camera, Loader2, Scissors, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { errMsg, initials, uploadImage } from "@/lib/format";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} data-testid="brand-home-link" className="flex items-center gap-2 group">
      <span className="grid size-9 place-items-center rounded-xl bg-gold text-ink transition-transform duration-300 group-hover:rotate-[-12deg]">
        <Scissors className="size-4.5" strokeWidth={2.4} />
      </span>
      <span className="font-heading text-lg font-bold tracking-tight">
        Bellix<span className="text-gold">BarberShop</span>
      </span>
    </Link>
  );
}

export function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  return url ? (
    <img src={url} alt={name} className={cn("size-12 rounded-full object-cover border border-gold/40", className)} />
  ) : (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full border border-gold/40 bg-[#2A2310] font-heading font-bold text-gold-soft",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-gold text-gold" : "text-zinc-600"} />
      ))}
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} estrelas`}
          data-testid={`star-pick-${i}`}
          onClick={() => onChange(i)}
          className="transition-transform duration-150 hover:scale-110 active:scale-95"
        >
          <Star className={cn("size-8", i <= value ? "fill-gold text-gold" : "text-zinc-600")} />
        </button>
      ))}
    </div>
  );
}

export function ImageUpload({
  onUploaded,
  label = "Enviar foto",
  testId,
  className,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  testId: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid={`${testId}-input`}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const r = await uploadImage(f);
            onUploaded(r.url);
            toast.success("Foto enviada!");
          } catch (err) {
            toast.error(errMsg(err, "Falha ao enviar a foto"));
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        data-testid={testId}
        disabled={busy}
        onClick={() => ref.current?.click()}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-gold/50 px-4 py-3 text-sm font-medium text-gold transition-colors duration-200 hover:bg-gold/10 disabled:opacity-60",
          className,
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {busy ? "Enviando..." : label}
      </button>
    </>
  );
}

export function SectionTitle({ over, title, action }: { over?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {over && <p className="overline mb-1">{over}</p>}
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, text, testId }: { icon: ReactNode; text: string; testId?: string }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted-foreground">
      <span className="text-gold/70">{icon}</span>
      {text}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    agendado: "bg-[#2A2310] text-gold-soft",
    concluido: "bg-[#064E3B] text-[#6EE7B7]",
    cancelado: "bg-red-950 text-red-300",
    pendente: "bg-amber-950 text-amber-300",
    ativa: "bg-[#064E3B] text-[#6EE7B7]",
    cancelada: "bg-red-950 text-red-300",
    expirada: "bg-zinc-800 text-zinc-300",
  };
  const label: Record<string, string> = {
    agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado", pendente: "Aguardando ativação",
    ativa: "Ativa", cancelada: "Cancelada", expirada: "Expirada",
  };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", map[status])}>{label[status] ?? status}</span>;
}
