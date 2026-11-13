import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { brl, waLink, WEEKDAYS } from "@/lib/format";
import type { ShopPublic } from "@/lib/types";

interface Msg { from: "bot" | "user"; text: string; link?: { href: string; label: string } }

const TOPICS = [
  { key: "endereco", label: "📍 Endereço" },
  { key: "horario", label: "🕒 Horário" },
  { key: "servicos", label: "✂️ Serviços e preços" },
  { key: "pagamento", label: "💳 Pagamento" },
  { key: "clube", label: "👑 Clube de assinatura" },
  { key: "cancelamento", label: "↩️ Cancelamento" },
] as const;
type TopicKey = (typeof TOPICS)[number]["key"];

function answer(data: ShopPublic, key: TopicKey): Msg {
  const s = data.shop;
  switch (key) {
    case "endereco":
      return { from: "bot", text: `Estamos em: ${s.address || "endereço não informado"}.`, link: s.maps_url ? { href: s.maps_url, label: "Abrir no Google Maps" } : undefined };
    case "horario": {
      const days = data.barbers.length ? [...new Set(data.barbers.flatMap((b) => b.work_days))].sort().map((d) => WEEKDAYS[d]).join(", ") : "";
      return { from: "bot", text: `${s.hours_text || "Consulte nossos horários"}${days ? `\nDias de atendimento: ${days}.` : ""}` };
    }
    case "servicos":
      return { from: "bot", text: data.services.map((x) => `• ${x.name} — ${brl(x.price)} (${x.duration} min)`).join("\n") || "Nenhum serviço cadastrado." };
    case "pagamento":
      return { from: "bot", text: "Aceitamos Pix, Cartão de Crédito e Cartão de Débito. Assinantes podem usar o saldo do plano. Você escolhe a forma no agendamento e paga no balcão." };
    case "clube":
      return {
        from: "bot",
        text: data.plans.length
          ? `Nossos planos mensais:\n${data.plans.map((p) => `• ${p.name} — ${brl(p.price)}/mês (${p.credits} serviços)`).join("\n")}\nVocê pode aderir com pagamento único ou recorrente. A cada atendimento concluído usando o plano, 1 crédito é descontado do seu saldo.`
          : "Em breve teremos planos de assinatura!",
      };
    case "cancelamento":
      return { from: "bot", text: `Você pode cancelar ou reagendar pelo app em "Meus Agendamentos" até ${s.cancel_min_hours}h antes do horário marcado.` };
  }
}

const KEYWORDS: [RegExp, TopicKey][] = [
  [/endere|onde|local|mapa|fica/i, "endereco"],
  [/hor[aá]rio|abre|fecha|funciona/i, "horario"],
  [/servi|pre[cç]o|valor|corte|barba|quanto/i, "servicos"],
  [/pag|pix|cart|cr[eé]dito|d[eé]bito/i, "pagamento"],
  [/plano|clube|assinat/i, "clube"],
  [/cancel|reagend|desmarc/i, "cancelamento"],
];

export default function Chatbot({ data, userName }: { data: ShopPublic; userName?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lastTopic, setLastTopic] = useState("dúvida geral");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: `Olá${userName ? `, ${userName.split(" ")[0]}` : ""}! 👋 Sou o assistente da ${data.shop.name}. Como posso ajudar?` },
  ]);

  const ask = (key: TopicKey, label: string) => {
    setLastTopic(label.replace(/^\S+\s/, ""));
    setMsgs((m) => [...m, { from: "user", text: label }, answer(data, key)]);
  };

  const send = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    const hit = KEYWORDS.find(([re]) => re.test(q));
    setLastTopic(q);
    setMsgs((m) => [
      ...m,
      { from: "user", text: q },
      hit ? answer(data, hit[1]) : { from: "bot", text: "Não encontrei essa resposta 🤔. Toque em \"Falar no WhatsApp\" para falar com nossa equipe." },
    ]);
  };

  const wa = waLink(data.shop.whatsapp, `Olá! Meu nome é ${userName ?? "(cliente)"} e tenho uma dúvida sobre: ${lastTopic}.`);

  return (
    <>
      <button
        data-testid="chatbot-toggle"
        aria-label="Abrir atendimento"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-gold text-ink shadow-lg gold-glow transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            data-testid="chatbot-panel"
            className="fixed bottom-24 right-3 left-3 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl sm:left-auto sm:w-96"
          >
            <div className="flex items-center gap-3 border-b border-line bg-elev px-4 py-3">
              <span className="grid size-9 place-items-center rounded-full bg-[#2A2310] text-gold"><Bot className="size-5" /></span>
              <div>
                <p className="font-heading font-semibold text-white">Assistente {data.shop.name}</p>
                <p className="text-xs text-emerald-400">● Online agora</p>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4" data-testid="chatbot-messages">
              {msgs.map((m, i) => (
                <div key={i} className={m.from === "user" ? "flex justify-end" : "flex"}>
                  <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.from === "user" ? "bg-gold text-ink" : "bg-elev text-zinc-200"}`}>
                    {m.text}
                    {m.link && (
                      <a href={m.link.href} target="_blank" rel="noreferrer" className="mt-1.5 block font-semibold text-gold underline" data-testid="chatbot-maps-link">
                        {m.link.label}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-t border-line px-3 py-2">
              {TOPICS.map((t) => (
                <button key={t.key} data-testid={`chatbot-topic-${t.key}`} onClick={() => ask(t.key, t.label)}
                  className="shrink-0 rounded-full border border-line bg-elev px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-gold/60">
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-line p-3">
              <input
                data-testid="chatbot-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Digite sua dúvida..."
                className="h-10 flex-1 rounded-xl border border-input bg-ink px-3 text-sm outline-none focus:border-gold"
              />
              <button data-testid="chatbot-send" onClick={send} aria-label="Enviar" className="grid size-10 place-items-center rounded-xl bg-gold text-ink">
                <Send className="size-4" />
              </button>
            </div>
            <a href={wa} target="_blank" rel="noreferrer" data-testid="chatbot-whatsapp-button"
              className="flex items-center justify-center gap-2 bg-[#128C7E] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0f7a6e]">
              <MessageCircle className="size-4" /> Falar no WhatsApp
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
