import type { ReactNode } from "react";

const tones = {
  mint: { badge: "border-[#DDF6E8] bg-[#EFFBF4] text-[#35645D]", glow: "bg-[#DDF6E8]/70" },
  blue: { badge: "border-[#E8F0FF] bg-[#F0F5FF] text-[#526B9B]", glow: "bg-[#E8F0FF]/80" },
  lavender: { badge: "border-[#F0ECFF] bg-[#F6F3FF] text-[#7564AF]", glow: "bg-[#F0ECFF]/80" },
  amber: { badge: "border-[#FFF1E2] bg-[#FFF7EE] text-[#996B3D]", glow: "bg-[#FFF1E2]/80" },
} as const;

export function SectionIntro({ label, title, description, icon, tone }: { label: string; title: string; description: string; icon: ReactNode; tone: keyof typeof tones }) {
  return <header className="relative overflow-hidden rounded-[28px] border border-[#E4E9E7] bg-white px-6 py-8 shadow-[0_20px_50px_-38px_rgba(24,32,38,.24)] sm:px-9 sm:py-9"><div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" /><div aria-hidden="true" className={"absolute -right-12 -top-24 size-64 rounded-full blur-3xl " + tones[tone].glow} /><div className="relative"><p className={"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] " + tones[tone].badge}>{icon}{label}</p><h1 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-[#182026] sm:text-[2.65rem]">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#667078]">{description}</p></div></header>;
}

export function SectionCard({ title, detail, children, id }: { title: string; detail?: string; children: ReactNode; id?: string }) {
  return <section id={id} className="rounded-[24px] border border-[#E4E9E7] bg-white p-5 shadow-[0_18px_46px_-38px_rgba(24,32,38,.24)] sm:p-6"><div className="mb-5"><h2 className="text-lg font-bold tracking-tight text-[#182026]">{title}</h2>{detail ? <p className="mt-1 text-sm leading-6 text-[#667078]">{detail}</p> : null}</div>{children}</section>;
}

export function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={htmlFor} className="block text-xs font-bold text-[#43505A]">{label}</label>{children}</div>;
}

export const inputClass = "h-11 w-full rounded-xl border border-[#DDE5E2] bg-white px-3.5 text-sm text-[#182026] outline-none placeholder:text-[#9AA7A5] focus:border-[#438C78] focus:ring-2 focus:ring-[#DDF6E8]";
export const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#182026] px-5 text-sm font-bold text-white transition-colors hover:bg-[#2A3742] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#438C78] disabled:cursor-not-allowed disabled:opacity-50";

export function CollectionState({ loading, error, empty, onRetry }: { loading: boolean; error: string | null; empty: boolean; onRetry: () => void }) {
  if (loading) return <p role="status" className="rounded-xl bg-[#F8FAF9] px-4 py-8 text-center text-sm text-[#667078]">Cargando…</p>;
  if (error) return <div role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-4 py-6 text-sm text-[#A04439]"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 font-bold underline">Reintentar</button></div>;
  if (empty) return <p className="rounded-xl border border-dashed border-[#DDE5E2] bg-[#FAFCFB] px-4 py-9 text-center text-sm text-[#667078]">No hay resultados para mostrar.</p>;
  return null;
}
