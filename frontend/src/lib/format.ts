import { ApiError } from "./api";
import type { FileOut, PaymentMethod } from "./types";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]; // index = python weekday (0 = segunda)

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  plano: "Saldo do Plano",
};

export function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const pyWeekday = (iso: string) => (parseISO(iso).getDay() + 6) % 7;

export function dateLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function errMsg(e: unknown, fallback = "Algo deu errado"): string {
  if (e instanceof ApiError) {
    const b = e.body as { detail?: unknown } | null;
    if (b && typeof b.detail === "string") return b.detail;
    if (b && Array.isArray(b.detail)) return "Verifique os campos preenchidos";
  }
  return fallback;
}

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Resize a phone photo client-side (max 1280px JPEG) and upload it. */
export async function uploadImage(file: File): Promise<FileOut> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
  const fd = new FormData();
  fd.append("file", blob, "foto.jpg");
  const r = await fetch("/api/admin/files", { method: "POST", body: fd });
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null));
  return (await r.json()) as FileOut;
}
