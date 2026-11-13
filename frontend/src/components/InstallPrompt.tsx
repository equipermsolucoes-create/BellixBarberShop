import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "bellix-install-dismissed";

export default function InstallPrompt({ name }: { name: string }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    if (standalone || localStorage.getItem(KEY)) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = isIos ? window.setTimeout(() => setShow(true), 2500) : undefined;
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); if (t) window.clearTimeout(t); };
  }, [isIos, standalone]);

  const close = () => { localStorage.setItem(KEY, "1"); setShow(false); };
  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md animate-fade-up rounded-2xl border border-gold/40 bg-panel/95 p-4 shadow-2xl backdrop-blur-xl" data-testid="install-prompt">
      <button onClick={close} data-testid="install-dismiss-button" className="absolute right-3 top-3 text-muted-foreground hover:text-white" aria-label="Fechar"><X className="size-4" /></button>
      <div className="flex items-start gap-3 pr-6">
        <img src="/icon-192.png" alt="" className="size-11 rounded-xl" />
        <div className="min-w-0">
          <p className="font-heading font-semibold text-white">Instale o app da {name}</p>
          {evt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Agende em 1 toque direto da tela inicial do celular.</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground" data-testid="install-ios-hint">
              No iPhone, toque em <Share className="inline size-3.5 text-gold" /> Compartilhar e depois em <b className="text-zinc-200">“Adicionar à Tela de Início”</b>.
            </p>
          )}
        </div>
      </div>
      {evt && (
        <Button className="mt-3 h-10 w-full" data-testid="install-app-button"
          onClick={async () => { await evt.prompt(); await evt.userChoice; close(); }}>
          <Download className="size-4" /> Instalar app
        </Button>
      )}
    </div>
  );
}
