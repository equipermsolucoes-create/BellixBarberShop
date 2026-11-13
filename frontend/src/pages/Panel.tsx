import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Crown, ExternalLink, Images, LogOut, Package, Scissors, Settings as SettingsIcon, TrendingUp, Users } from "lucide-react";
import { BrandMark } from "@/components/common";
import Agenda from "@/components/panel/Agenda";
import Finance from "@/components/panel/Finance";
import Catalog from "@/components/panel/Catalog";
import Team from "@/components/panel/Team";
import Plans from "@/components/panel/Plans";
import Gallery from "@/components/panel/Gallery";
import Settings from "@/components/panel/Settings";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Shop } from "@/lib/types";

const TABS = [
  { k: "agenda", l: "Agenda", icon: CalendarDays, barber: true },
  { k: "financeiro", l: "Financeiro", icon: TrendingUp },
  { k: "servicos", l: "Serviços", icon: Scissors },
  { k: "produtos", l: "Produtos", icon: Package },
  { k: "equipe", l: "Equipe", icon: Users },
  { k: "planos", l: "Planos", icon: Crown },
  { k: "galeria", l: "Galeria", icon: Images, barber: true },
  { k: "config", l: "Configurações", icon: SettingsIcon },
];

export default function Panel() {
  const me = useMe();
  const [tab, setTab] = useState("agenda");
  const shop = useQuery({ queryKey: ["admin", "shop"], queryFn: () => apiGet<Shop>("/admin/shop"), enabled: !!me.data && me.data.role !== "client" && me.data.role !== "superadmin" });
  if (me.isLoading) return null;
  if (!me.data) return <Navigate to="/entrar" replace />;
  if (me.data.role === "superadmin") return <Navigate to="/super" replace />;
  if (me.data.role === "client") return <Navigate to="/" replace />;
  const user = me.data;
  const tabs = TABS.filter((t) => user.role === "admin" || t.barber);

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3">
          <BrandMark to="/painel" />
          <span className="hidden h-6 w-px bg-line sm:block" />
          <p className="hidden truncate font-heading font-semibold text-gold-soft sm:block" data-testid="panel-shop-name">{shop.data?.name}</p>
          <div className="ml-auto flex items-center gap-3">
            {shop.data && (
              <Link to={`/b/${shop.data.slug}`} target="_blank" data-testid="panel-public-link" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold">
                <ExternalLink className="size-4" /> <span className="hidden sm:inline">Ver página</span>
              </Link>
            )}
            <span className="hidden text-sm text-zinc-300 md:inline">{user.name} • {user.role === "admin" ? "Administrador" : "Barbeiro"}</span>
            <button data-testid="panel-logout-button" onClick={() => endSession("/entrar")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold"><LogOut className="size-4" /> Sair</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-2">
          {tabs.map((t) => (
            <button key={t.k} data-testid={`panel-tab-${t.k}`} onClick={() => setTab(t.k)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition-colors duration-150", tab === t.k ? "bg-gold font-semibold text-ink" : "text-zinc-300 hover:bg-elev")}>
              <t.icon className="size-4" /> {t.l}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl animate-fade-up px-5 pt-6" key={tab}>
        <h1 className="mb-5 text-2xl font-bold text-white">{tabs.find((t) => t.k === tab)?.l}</h1>
        {tab === "agenda" && <Agenda me={user} />}
        {tab === "financeiro" && <Finance />}
        {tab === "servicos" && <Catalog kind="services" />}
        {tab === "produtos" && <Catalog kind="products" />}
        {tab === "equipe" && <Team />}
        {tab === "planos" && <Plans />}
        {tab === "galeria" && <Gallery me={user} />}
        {tab === "config" && <Settings />}
      </main>
    </div>
  );
}
