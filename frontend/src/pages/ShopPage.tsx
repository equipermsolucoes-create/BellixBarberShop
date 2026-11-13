import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarPlus, Clock, Crown, MapPin, MessageCircle, Scissors, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, BrandMark, Stars } from "@/components/common";
import Chatbot from "@/components/Chatbot";
import { brl, waLink, WEEKDAYS } from "@/lib/format";
import { useMe, useShop } from "@/lib/hooks";

export default function ShopPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useShop(slug);
  const { data: me } = useMe();
  const shop = data?.shop;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <BrandMark />
          {me?.role === "client" ? (
            <Link to={`/b/${slug}/cliente`} data-testid="client-area-link" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <UserRound className="size-4" /> Minha área
            </Link>
          ) : !me ? (
            <Link to={`/entrar?shop=${slug}&next=/b/${slug}/cliente`} data-testid="shop-login-link" className={buttonVariants({ variant: "outline", size: "sm" })}>Entrar</Link>
          ) : null}
        </div>
      </header>

      {isError && <p className="mx-auto max-w-5xl px-5 py-16 text-muted-foreground" data-testid="shop-not-found">Barbearia não encontrada ou indisponível no momento.</p>}
      {isLoading && <div className="mx-auto mt-8 h-48 max-w-5xl animate-pulse rounded-2xl bg-panel" />}

      {shop && data && (
        <main className="mx-auto max-w-5xl px-5">
          {!shop.active && (
            <div data-testid="shop-suspended-banner" className="mt-5 rounded-xl border border-red-900 bg-red-950/60 p-4 text-sm text-red-200">
              Esta barbearia está temporariamente indisponível para agendamentos online.
            </div>
          )}
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-black mt-6 overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar name={shop.name} url={shop.logo_url} className="size-20 rounded-2xl text-2xl" />
              <div className="flex-1">
                <p className="overline">Barbearia</p>
                <h1 data-testid="shop-name" className="mt-1 text-3xl font-bold text-white sm:text-4xl">{shop.name}</h1>
                <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {shop.address && (
                    <a href={shop.maps_url || "#"} target="_blank" rel="noreferrer" data-testid="shop-address" className="flex items-center gap-2 hover:text-gold">
                      <MapPin className="size-4 text-gold" /> {shop.address}
                    </a>
                  )}
                  {shop.hours_text && <span className="flex items-center gap-2"><Clock className="size-4 text-gold" /> {shop.hours_text}</span>}
                  {shop.whatsapp && (
                    <a href={waLink(shop.whatsapp, `Olá ${shop.name}!`)} target="_blank" rel="noreferrer" data-testid="shop-whatsapp" className="flex items-center gap-2 hover:text-gold">
                      <MessageCircle className="size-4 text-gold" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
            {shop.active && (
              <Link to={`/b/${slug}/agendar`} data-testid="book-now-button"
                className={buttonVariants({ size: "lg", className: "mt-6 h-14 w-full text-base gold-glow sm:w-auto sm:px-10" })}>
                <CalendarPlus className="size-5" /> Agendar Horário
              </Link>
            )}
          </motion.section>

          {data.gallery.length > 0 && (
            <section className="mt-10">
              <p className="overline mb-3">Vitrine de cortes</p>
              <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2" data-testid="shop-gallery">
                {data.gallery.map((g) => (
                  <figure key={g.id} className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-panel">
                    <img src={g.url} alt={g.caption || "Corte"} className="aspect-[4/5] w-full object-cover" loading="lazy" />
                    {g.caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{g.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
            <div>
              <p className="overline mb-3">Serviços</p>
              <div className="divide-y divide-line rounded-2xl border border-line bg-panel" data-testid="shop-services">
                {data.services.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                    <Scissors className="size-4 shrink-0 text-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-gold-soft">{brl(s.price)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="overline mb-3">Nossa equipe</p>
              <div className="space-y-2.5" data-testid="shop-barbers">
                {data.barbers.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3.5">
                    <Avatar name={b.name} url={b.photo_url} />
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-white">{b.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Stars value={b.rating} size={12} /> {b.rating_count ? `${b.rating} (${b.rating_count})` : "Novo"}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{b.specialties.join(" • ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {data.plans.length > 0 && (
            <section className="mt-10">
              <div className="mb-3 flex items-end justify-between">
                <p className="overline">Clube de assinatura</p>
                <Link to={`/b/${slug}/cliente?tab=planos`} data-testid="see-plans-link" className="text-sm text-gold hover:underline">Assinar →</Link>
              </div>
              <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
                {data.plans.map((p) => (
                  <div key={p.id} className="card-black w-64 shrink-0 snap-start p-5">
                    <Crown className="size-5 text-gold" />
                    <p className="mt-2 font-heading font-semibold text-white">{p.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    <p className="mt-3 font-heading text-2xl font-bold text-gold-soft">{brl(p.price)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                    {p.weekdays.length > 0 && <p className="mt-1 text-[11px] text-amber-300">Válido: {p.weekdays.map((d) => WEEKDAYS[d]).join(", ")}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.reviews.length > 0 && (
            <section className="mt-10">
              <p className="overline mb-3">Avaliações</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-line bg-panel p-4">
                    <div className="flex items-center justify-between"><p className="font-medium text-white">{r.client_name}</p><Stars value={r.rating} /></div>
                    {r.comment && <p className="mt-2 text-sm text-muted-foreground">“{r.comment}”</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      )}
      {data && <Chatbot data={data} userName={me?.name} />}
    </div>
  );
}
