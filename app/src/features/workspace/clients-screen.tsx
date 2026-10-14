"use client";

import { AddressBook } from "@phosphor-icons/react/dist/csr/AddressBook";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAccess } from "@/features/access/access-provider";
import { findCustomerCandidates, listCustomers, readCustomer, addCustomer, saveCustomer } from "@/features/customers/customer-adapter";
import type { CustomerDTO, CustomerPageDTO, CustomerSummaryDTO } from "@/lib/api/contracts";
import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";

type CapturedContext = { organizationId: string; userId: string };
const PAGE_SIZE = 25;

export function ClientsScreen() {
  const { snapshot, preflight } = useAccess();
  const organizationId = snapshot?.activeOrganizationId ?? null;
  const userId = snapshot?.user.id ?? null;
  const role = snapshot?.memberships.find((member) => member.organization.id === organizationId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const contextRef = useRef<CapturedContext | null>(null);
  const preflightRef = useRef(preflight);

  const [page, setPage] = useState<CustomerPageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomerDTO | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<CustomerDTO | null>(null);
  const [candidates, setCandidates] = useState<CustomerSummaryDTO[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    contextRef.current = organizationId && userId ? { organizationId, userId } : null;
    preflightRef.current = preflight;
  }, [organizationId, userId, preflight]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(queryInput.trim()); setOffset(0); setLoading(true); setError(null); }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const refresh = useCallback(() => { setLoading(true); setError(null); if (selectedId) setSelectedLoading(true); setRevision((value) => value + 1); }, [selectedId]);
  const isCurrent = (captured: CapturedContext) => contextRef.current?.organizationId === captured.organizationId && contextRef.current.userId === captured.userId;

  useEffect(() => {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!captured) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(captured)) return;
        const result = await listCustomers(captured.organizationId, { limit: PAGE_SIZE, offset, status, ...(query ? { q: query } : {}) }, controller.signal);
        if (!active || !isCurrent(captured)) return;
        setPage(result);
      } catch (reason) {
        if (!active || controller.signal.aborted || !isCurrent(captured)) return;
        setError(reason instanceof Error ? reason.message : "No se pudieron cargar los clientes.");
      } finally {
        if (active && isCurrent(captured)) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, offset, status, query, revision]);

  useEffect(() => {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!captured || !selectedId) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(captured)) return;
        const result = await readCustomer(captured.organizationId, selectedId, controller.signal);
        if (!active || !isCurrent(captured)) return;
        setSelected(result);
      } catch (reason) {
        if (!active || controller.signal.aborted || !isCurrent(captured)) return;
        setSelectedError(reason instanceof Error ? reason.message : "No se pudo cargar la ficha.");
      } finally {
        if (active && isCurrent(captured)) setSelectedLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, selectedId, revision]);

  useEffect(() => {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    const phoneValue = phone.trim();
    const emailValue = email.trim();
    if (!captured || (!phoneValue && !emailValue)) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await preflightRef.current();
          if (!active || !isCurrent(captured)) return;
          const result = await findCustomerCandidates(captured.organizationId, {
            ...(phoneValue ? { phone: phoneValue } : {}),
            ...(emailValue ? { email: emailValue } : {}),
            ...(editing ? { excludeId: editing.id } : {}),
          }, controller.signal);
          if (active && isCurrent(captured)) setCandidates(result.items);
        } catch { if (active) setCandidates([]); }
      })();
    }, 300);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [organizationId, userId, phone, email, editing]);

  function startEditing(customer: CustomerDTO) {
    setEditing(customer);
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setEmail(customer.email ?? "");
    setNotes(customer.notes ?? "");
    setFormError(null);
    setNotice(null);
    const form = document.getElementById("nuevo-cliente");
    if (typeof form?.scrollIntoView === "function") form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditing(null); setName(""); setPhone(""); setEmail(""); setNotes(""); setCandidates([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const captured = organizationId && userId ? { organizationId, userId } : null;
    if (!captured) return;
    setBusy(true); setFormError(null); setNotice(null);
    try {
      await preflightRef.current();
      if (!isCurrent(captured)) return;
      const input = {
        name,
        phone: phone.trim() || null,
        email: email.trim() || null,
        ...(canManage ? { notes: notes.trim() || null } : {}),
      };
      const saved = editing
        ? await saveCustomer(captured.organizationId, editing.id, input, editing.version)
        : await addCustomer(captured.organizationId, input);
      if (!isCurrent(captured)) return;
      resetForm();
      setQueryInput(""); setQuery(""); setStatus("all"); setOffset(0); setLoading(true); setError(null);
      setSelectedId(saved.id);
      setSelected(saved); setSelectedLoading(false);
      setNotice(editing ? "Cambios guardados" : "Cliente agregado");
      setRevision((value) => value + 1);
    } catch (reason) {
      if (!isCurrent(captured)) return;
      setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el cliente.");
    } finally { if (isCurrent(captured)) setBusy(false); }
  }

  async function toggleActive(customer: CustomerDTO) {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    if (!captured || !canManage) return;
    setBusy(true); setSelectedError(null); setNotice(null);
    try {
      await preflightRef.current();
      if (!isCurrent(captured)) return;
      const updated = await saveCustomer(captured.organizationId, customer.id, { active: !customer.active }, customer.version);
      if (!isCurrent(captured)) return;
      setSelected(updated); setNotice(updated.active ? "Cliente reactivado" : "Cliente archivado");
      setStatus("all"); setLoading(true); setError(null); setRevision((value) => value + 1);
    } catch (reason) {
      if (!isCurrent(captured)) return;
      setSelectedError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado.");
    } finally { if (isCurrent(captured)) setBusy(false); }
  }

  const items = page?.items ?? [];
  const selectedForForm = selected;

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Turnero / Clientes" title="Cada cliente, más cerca." description="Encontrá sus datos de contacto y mantené la información importante a mano." icon={<AddressBook size={15} weight="duotone" />} tone="blue" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Directorio de clientes" detail={`${items.length} ${items.length === 1 ? "cliente" : "clientes"} en esta página`}>
        <label htmlFor="client-search" className="sr-only">Buscar clientes</label>
        <div className="relative mb-3"><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="client-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por nombre o contacto" className={inputClass + " pl-10"} /></div>
        <label htmlFor="client-status" className="sr-only">Estado de clientes</label>
        <select id="client-status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setOffset(0); setLoading(true); setError(null); }} className={inputClass + " mb-5"}>
          <option value="active">Activos</option><option value="inactive">Archivados</option><option value="all">Todos</option>
        </select>
        <CollectionState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={refresh} />
        {!loading && !error && items.length > 0 ? <ul className="space-y-2">{items.map((item) => <li key={item.id}><button type="button" onClick={() => { setSelectedId(item.id); setSelected(null); setSelectedLoading(true); setSelectedError(null); }} aria-pressed={selectedId === item.id} className="flex w-full items-center gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3 text-left transition-colors hover:border-[#BFD4E8] hover:bg-[#F7FAFF] focus-visible:outline-2 focus-visible:outline-[#5D86D5] aria-pressed:border-[#9FC0EE] aria-pressed:bg-[#F0F5FF]"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0FF] text-xs font-bold text-[#526B9B]">{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{item.name}</strong><span className="mt-0.5 block truncate text-xs text-[#667078]">{item.phone || item.email || "Sin contacto"}</span></span>{!item.active ? <span className="ml-auto text-xs text-[#7C8A88]">Archivado</span> : null}</button></li>)}</ul> : null}
        {page ? <nav aria-label="Páginas de clientes" className="mt-4 flex items-center justify-between"><button type="button" disabled={offset === 0 || loading} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#526B9B] disabled:opacity-40">Anterior</button><span className="text-xs text-[#7C8A88]">{Math.floor(offset / PAGE_SIZE) + 1}</span><button type="button" disabled={!page.pageInfo.hasMore || loading} onClick={() => { setOffset(page.pageInfo.nextOffset ?? offset); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#526B9B] disabled:opacity-40">Siguiente</button></nav> : null}
        {page?.pageInfo.windowLimitReached ? <p className="mt-2 text-xs text-[#7C8A88]">Acotá la búsqueda para ver más resultados.</p> : null}
      </SectionCard>
      <div className="space-y-5">
        {selectedLoading ? <SectionCard title="Ficha de cliente"><p role="status" className="text-sm text-[#667078]">Cargando ficha…</p></SectionCard> : null}
        {selectedError ? <SectionCard title="Ficha de cliente"><p role="alert" className="text-sm text-[#A04439]">{selectedError}</p><button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 text-sm font-bold underline">Reintentar</button></SectionCard> : null}
        {selectedForForm ? <SectionCard title="Ficha de cliente"><div className="flex items-center gap-3 border-b border-[#EEF1EF] pb-4"><span className="flex size-11 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#5D86D5]"><User size={21} /></span><div><p className="text-sm font-bold text-[#182026]">{selectedForForm.name}</p><p className="text-xs text-[#667078]">{selectedForForm.active ? "Activo" : "Archivado"}</p></div></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Teléfono</dt><dd className="mt-1 text-[#182026]">{selectedForForm.phone || "Sin registrar"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Correo</dt><dd className="mt-1 break-all text-[#182026]">{selectedForForm.email || "Sin registrar"}</dd></div>{canManage && selectedForForm.notes !== undefined ? <div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Notas</dt><dd className="mt-1 text-[#182026]">{selectedForForm.notes || "Sin notas"}</dd></div> : null}</dl><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startEditing(selectedForForm)} className={actionClass}>Editar</button>{canManage ? <button type="button" disabled={busy} onClick={() => void toggleActive(selectedForForm)} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A] disabled:opacity-50">{selectedForForm.active ? "Archivar" : "Reactivar"}</button> : null}</div></SectionCard> : null}
        <SectionCard id="nuevo-cliente" title={editing ? "Editar cliente" : "Nuevo cliente"} detail="El teléfono y el correo son opcionales."><form onSubmit={submit} className="space-y-4"><FormField label="Nombre" htmlFor="client-name"><input id="client-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nombre y apellido" className={inputClass} /></FormField><FormField label="Teléfono" htmlFor="client-phone"><input id="client-phone" type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); if (!event.target.value.trim() && !email.trim()) setCandidates([]); }} placeholder="Teléfono de contacto" className={inputClass} /></FormField><FormField label="Correo" htmlFor="client-email"><input id="client-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (!phone.trim() && !event.target.value.trim()) setCandidates([]); }} placeholder="Correo electrónico" className={inputClass} /></FormField>{canManage ? <FormField label="Notas internas" htmlFor="client-notes"><textarea id="client-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Opcional" className={inputClass + " h-auto min-h-24 py-3"} /></FormField> : null}{candidates.length > 0 ? <div className="rounded-xl border border-[#FFF1E2] bg-[#FFF7EE] px-3 py-3 text-sm text-[#805B35]"><p className="font-semibold">Posibles coincidencias; podés continuar si son personas distintas.</p><ul className="mt-2 list-inside list-disc">{candidates.map((candidate) => <li key={candidate.id}>{candidate.name}</li>)}</ul></div> : null}{formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}<div className="flex gap-2"><button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando…" : editing ? "Guardar cambios" : "Agregar cliente"}</button>{editing ? <button type="button" disabled={busy} onClick={resetForm} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A]">Cancelar</button> : null}</div></form></SectionCard>
      </div>
    </div>
  </div>;
}
