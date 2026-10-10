"use client";

import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { useState } from "react";
import type { FormEvent } from "react";

import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";
import type { Service, WorkspaceSource } from "./types";
import { useWorkspaceCollection } from "./workspace-provider";

const loadServices = (source: WorkspaceSource) => source.listServices();

export function ServicesScreen() {
  const { source, items, loading, error, refresh } = useWorkspaceCollection<Service>(loadServices);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("40");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = items.filter((item) => (item.name + " " + item.description).toLocaleLowerCase("es-AR").includes(query.toLocaleLowerCase("es-AR")));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      await source.createService({ name, durationMinutes: Number(duration), description });
      setName("");
      setDuration("40");
      setDescription("");
      setQuery("");
      setNotice("Servicio agregado");
      refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el servicio.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Turnero / Servicios" title="Servicios a tu manera." description="Definí qué ofrece tu equipo y cuánto tiempo necesita cada cita." icon={<SquaresFour size={15} weight="duotone" />} tone="mint" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Catálogo de servicios" detail={`${items.length} ${items.length === 1 ? "servicio" : "servicios"} en tu catálogo`}>
        <label htmlFor="service-search" className="sr-only">Buscar servicios</label>
        <div className="relative mb-5"><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="service-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar servicios" className={inputClass + " pl-10"} /></div>
        <CollectionState loading={loading} error={error} empty={visible.length === 0} onRetry={refresh} />
        {!loading && !error && visible.length > 0 ? <ul className="divide-y divide-[#EEF1EF]">{visible.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#DDF6E8] text-[#438C78]"><SquaresFour size={19} weight="duotone" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#182026]">{item.name}</p><p className="mt-1 truncate text-xs text-[#667078]">{item.description || "Sin descripción"}</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F6F5] px-3 py-1.5 text-xs font-semibold text-[#536068]"><Clock size={14} /> {item.durationMinutes} min</span></li>)}</ul> : null}
      </SectionCard>
      <SectionCard id="nuevo-servicio" title="Nuevo servicio" detail="Agregá una opción al catálogo.">
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Nombre" htmlFor="service-name"><input id="service-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del servicio" required className={inputClass} /></FormField>
          <FormField label="Duración en minutos" htmlFor="service-duration"><input id="service-duration" type="number" min="5" max="480" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} required className={inputClass} /></FormField>
          <FormField label="Descripción" htmlFor="service-description"><textarea id="service-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Opcional" className={inputClass + " h-auto min-h-24 py-3"} /></FormField>
          {formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}
          <button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando..." : "Agregar servicio"}</button>
        </form>
      </SectionCard>
    </div>
  </div>;
}
