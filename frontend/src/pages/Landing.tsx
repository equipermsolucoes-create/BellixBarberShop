import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, CalendarCheck, Crown, Gift, LayoutDashboard, MessageCircle, Scissors, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, BrandMark } from "@/components/common";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { Shop } from "@/lib/types";

const FEATURES = [
  { icon: CalendarCheck, t: "Agendamento em 4 passos", d: "Serviço, barbeiro, horário e pagamento. Sem conflito de agenda." },
  { icon: Crown, t: "Clube de assinaturas", d: "Planos mensais com saldo de cortes em tempo real." },
  { icon: Gift, t: "Indique e ganhe", d: "Cupons automáticos e cartão fidelidade digital." },
  { icon: LayoutDashboard, t: "Gestão completa", d: "Agenda, comanda, estoque, comissões e relatórios." },
  { icon: MessageCircle, t: "Chatbot + WhatsApp", d: "Atendimento instantâneo com transbordo humano." },
  { icon: ShieldCheck, t: "Multi-barbearia", d: "Cada loja com link próprio e dados isolados." },
];

export function panelPath(role: string | undefined, slug?: string | null) {
  if (role === "superadmin") return "/super";
  if (role === "admin" || role === "barber") return "/painel";
  return slug ? `/b/${slug}/cliente` : "/";
}

export default function Landing() {
  const { data: me } = useMe();
  const shops = useQuery({ queryKey: ["public-shops"], queryFn: () => apiGet<Shop[]>("/public/shops") });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <BrandMark />
          {me ? (
            <Link to={panelPath(me.role)} data-testid="header-panel-link" className={buttonVariants({ size: "sm" })}>
              {me.role === "client" ? "Minha conta" : "Meu painel"}
            </Link>
          ) : (
            <Link to="/entrar" data-testid="header-login-link" className={buttonVariants({ variant: "outline", size: "sm" })}>Entrar</Link>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-[#2A2310] px-3 py-1 text-xs font-semibold text-gold-soft">
            <Scissors className="size-3.5" /> Plataforma para barbearias
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] text-white sm:text-6xl">
            Sua barbearia,<br /><span className="gold-text animate-shine">agenda cheia.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Agendamento online, clube de assinaturas, fidelidade, indicações e gestão financeira — tudo no celular, com a identidade da sua loja.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#barbearias" data-testid="hero-book-button" className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
              Agendar agora <ArrowRight className="size-4" />
            </a>
            <Link to="/entrar" data-testid="hero-login-button" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}>
              Acessar painel
            </Link>
          </div>
        </motion.div>

        <div id="barbearias" className="card-black p-5 gold-glow">
          <p className="overline">Barbearias na plataforma</p>
          <div className="mt-4 space-y-2.5" data-testid="shop-list">
            {shops.isError && <p className="text-sm text-muted-foreground">Não foi possível carregar as barbearias.</p>}
            {shops.isLoading && [0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-elev" />)}
            {shops.data?.map((s) => (
              <Link key={s.id} to={`/b/${s.slug}`} data-testid={`shop-card-${s.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-line bg-panel/70 p-3 transition-colors duration-200 hover:border-gold/60">
                <Avatar name={s.name} url={s.logo_url} className="size-11 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading font-semibold text-white">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">/b/{s.slug}</p>
                </div>
                <ArrowRight className="size-4 text-gold transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.t} className={`rounded-2xl border border-line bg-panel p-5 transition-colors duration-200 hover:border-gold/40 ${i === 0 ? "lg:col-span-2" : ""}`}>
              <f.icon className="size-6 text-gold" />
              <h3 className="mt-3 font-semibold text-white">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
