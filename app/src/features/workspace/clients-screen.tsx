"use client";

import { AddressBook } from "@phosphor-icons/react/dist/csr/AddressBook";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { useState } from "react";
import type { FormEvent } from "react";

import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";
import type { Client, WorkspaceSource } from "./types";
import { useWorkspaceCollection } from "./workspace-provider";

const loadClients = (source: WorkspaceSource) => source.listClients();

export function ClientsScreen() {
  const { source, items, loading, error, refresh } = useWorkspaceCollection<Client>(loadClients);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = items.filter((item) => (item.name + " " + item.phone + " " + item.email).toLocaleLowerCase("es-AR").includes(query.toLocaleLowerCase("es-AR")));
  const selected = items.find((item) => item.id === selectedId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      const created = await source.createClient({ name, phone, email, notes });
      setName(""); setPhone(""); setEmail(""); setNotes(""); setQuery("");
      setSelectedId(created.id);
      setNotice("Cliente agregado");
      refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el cliente.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Turnero / Clientes" title="Cada cliente, más cerca." description="Encontrá sus datos de contacto y mantené la información importante a mano." icon={<AddressBook size={15} weight="duotone" />} tone="blue" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Directorio de clientes" detail={`${items.length} ${items.length === 1 ? "cliente" : "clientes"} registrados`}>
        <label htmlFor="client-search" className="sr-only">Buscar clientes</label>
        <div className="relative mb-5"><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="client-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o contacto" className={inputClass + " pl-10"} /></div>
        <CollectionState loading={loading} error={error} empty={visible.length === 0} onRetry={refresh} />
        {!loading && !error && visible.length > 0 ? <ul className="space-y-2">{visible.map((item) => <li key={item.id}><button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className="flex w-full items-center gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3 text-left transition-colors hover:border-[#BFD4E8] hover:bg-[#F7FAFF] focus-visible:outline-2 focus-visible:outline-[#5D86D5] aria-pressed:border-[#9FC0EE] aria-pressed:bg-[#F0F5FF]"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0FF] text-xs font-bold text-[#526B9B]">{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{item.name}</strong><span className="mt-0.5 block truncate text-xs text-[#667078]">{item.phone || item.email}</span></span></button></li>)}</ul> : null}
      </SectionCard>
      <div className="space-y-5">
        {selected ? <SectionCard title="Ficha de cliente"><div className="flex items-center gap-3 border-b border-[#EEF1EF] pb-4"><span className="flex size-11 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#5D86D5]"><User size={21} /></span><div><p className="text-sm font-bold text-[#182026]">{selected.name}</p><p className="text-xs text-[#667078]">Contacto</p></div></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Teléfono</dt><dd className="mt-1 text-[#182026]">{selected.phone || "Sin registrar"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Correo</dt><dd className="mt-1 break-all text-[#182026]">{selected.email || "Sin registrar"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Notas</dt><dd className="mt-1 text-[#182026]">{selected.notes || "Sin notas"}</dd></div></dl></SectionCard> : null}
        <SectionCard id="nuevo-cliente" title="Nuevo cliente" detail="Guardá sus datos de contacto."><form onSubmit={submit} className="space-y-4"><FormField label="Nombre" htmlFor="client-name"><input id="client-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nombre y apellido" className={inputClass} /></FormField><FormField label="Teléfono" htmlFor="client-phone"><input id="client-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono de contacto" className={inputClass} /></FormField><FormField label="Correo" htmlFor="client-email"><input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" className={inputClass} /></FormField><FormField label="Notas" htmlFor="client-notes"><textarea id="client-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Opcional" className={inputClass + " h-auto min-h-24 py-3"} /></FormField><p className="text-xs leading-5 text-[#7C8A88]">Ingresá al menos un teléfono o correo.</p>{formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}<button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando..." : "Agregar cliente"}</button></form></SectionCard>
      </div>
    </div>
  </div>;
}
