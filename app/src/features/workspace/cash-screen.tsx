"use client";

import { ArrowDownLeft } from "@phosphor-icons/react/dist/csr/ArrowDownLeft";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Wallet } from "@phosphor-icons/react/dist/csr/Wallet";
import { useState } from "react";
import type { FormEvent } from "react";

import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";
import type { CashMovement, WorkspaceSource } from "./types";
import { useWorkspaceCollection } from "./workspace-provider";

const loadMovements = (source: WorkspaceSource) => source.listCashMovements();
const formatAmount = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);

function parseAmountCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function CashScreen() {
  const { source, items, loading, error, refresh } = useWorkspaceCollection<CashMovement>(loadMovements);
  const [date, setDate] = useState(localToday);
  const [movementDate, setMovementDate] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [kind, setKind] = useState<"in" | "out">("in");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dayItems = items.filter((item) => item.date === date);
  const visible = dayItems.filter((item) => kindFilter === "all" || item.kind === kindFilter);
  const totalIn = dayItems.filter((item) => item.kind === "in").reduce((sum, item) => sum + item.amountCents, 0);
  const totalOut = dayItems.filter((item) => item.kind === "out").reduce((sum, item) => sum + item.amountCents, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setFormError(null); setNotice(null);
    try {
      await source.createCashMovement({ date: movementDate, kind, concept, amountCents: parseAmountCents(amount) });
      setDate(movementDate); setMovementDate(""); setConcept(""); setAmount(""); setKindFilter("all");
      setNotice("Movimiento registrado"); refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudo registrar el movimiento.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Gestión / Caja" title="Movimientos en orden." description="Registrá entradas y salidas manuales y consultá lo ocurrido en cada jornada." icon={<Wallet size={15} weight="duotone" />} tone="amber" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <section aria-label="Resumen de movimientos" className="grid gap-3 sm:grid-cols-3"><Summary label="Entradas registradas" amount={formatAmount(totalIn)} tone="mint" /><Summary label="Salidas registradas" amount={formatAmount(totalOut)} tone="amber" /><Summary label="Movimientos" amount={String(dayItems.length).padStart(2, "0")} tone="blue" /></section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Registro de caja" detail="Movimientos manuales de la fecha seleccionada."><div className="mb-5 flex flex-wrap gap-3"><FormField label="Fecha" htmlFor="cash-filter-date"><input id="cash-filter-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></FormField><FormField label="Tipo" htmlFor="cash-filter-kind"><select id="cash-filter-kind" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className={inputClass}><option value="all">Todos</option><option value="in">Entradas</option><option value="out">Salidas</option></select></FormField></div><CollectionState loading={loading} error={error} empty={visible.length === 0} onRetry={refresh} />{!loading && !error && visible.length > 0 ? <ul className="divide-y divide-[#EEF1EF]">{visible.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className={"flex size-10 shrink-0 items-center justify-center rounded-xl " + (item.kind === "in" ? "bg-[#DDF6E8] text-[#438C78]" : "bg-[#FFF1E2] text-[#B87B46]")}>{item.kind === "in" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{item.concept}</strong><span className="mt-0.5 block text-xs text-[#667078]">{item.kind === "in" ? "Entrada" : "Salida"} · {item.date}</span></span></div><strong className={"shrink-0 text-sm " + (item.kind === "in" ? "text-[#438C78]" : "text-[#A66C3B]")}>{item.kind === "in" ? "+" : "−"}{formatAmount(item.amountCents)}</strong></li>)}</ul> : null}</SectionCard>
      <SectionCard id="nuevo-movimiento" title="Nuevo movimiento" detail="Registrá una entrada o salida manual."><form onSubmit={submit} className="space-y-4"><FormField label="Fecha del movimiento" htmlFor="cash-movement-date"><input id="cash-movement-date" type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} required className={inputClass} /></FormField><FormField label="Tipo" htmlFor="cash-kind"><select id="cash-kind" value={kind} onChange={(event) => setKind(event.target.value as "in" | "out")} className={inputClass}><option value="in">Entrada</option><option value="out">Salida</option></select></FormField><FormField label="Concepto" htmlFor="cash-concept"><input id="cash-concept" value={concept} onChange={(event) => setConcept(event.target.value)} required placeholder="Motivo del movimiento" className={inputClass} /></FormField><FormField label="Importe (ARS)" htmlFor="cash-amount"><input id="cash-amount" type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="0,00" className={inputClass} /></FormField><p className="text-xs leading-5 text-[#7C8A88]">Este registro manual es independiente de ventas y pagos.</p>{formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}<button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando..." : "Registrar movimiento"}</button></form></SectionCard>
    </div>
  </div>;
}

function Summary({ label, amount, tone }: { label: string; amount: string; tone: "mint" | "amber" | "blue" }) {
  const toneClass = { mint: "bg-[#DDF6E8] text-[#438C78]", amber: "bg-[#FFF1E2] text-[#B87B46]", blue: "bg-[#E8F0FF] text-[#5D86D5]" }[tone];
  return <div className="rounded-2xl border border-[#E4E9E7] bg-white p-4"><span className={"inline-flex size-8 items-center justify-center rounded-lg " + toneClass}><Wallet size={17} /></span><p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#7C8A88]">{label}</p><p className="mt-1 text-xl font-bold tracking-tight text-[#182026]">{amount}</p></div>;
}
