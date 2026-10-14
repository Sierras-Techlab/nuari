"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAccess } from "@/features/access/access-provider";
import { addStaff, listStaff, listStaffServices, readStaff, saveStaff } from "@/features/staff/staff-adapter";
import type { StaffDTO, StaffPageDTO, StaffServicePageDTO, StaffSummaryDTO } from "@/lib/api/contracts";
import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "@/features/workspace/section-ui";

type CapturedContext = { organizationId: string; userId: string };
const PAGE_SIZE = 25;

export function ProfessionalsScreen() {
  const { snapshot } = useAccess();
  const contextKey = snapshot ? `${snapshot.user.id}:${snapshot.activeOrganizationId ?? "none"}` : "no-context";
  return <ProfessionalsWorkspace key={contextKey} />;
}

function ProfessionalsWorkspace() {
  const { snapshot, preflight } = useAccess();
  const organizationId = snapshot?.activeOrganizationId ?? null;
  const userId = snapshot?.user.id ?? null;
  const role = snapshot?.memberships.find((member) => member.organization.id === organizationId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const contextRef = useRef<CapturedContext | null>(null);
  const preflightRef = useRef(preflight);
  const [page, setPage] = useState<StaffPageDTO | null>(null);
  const [services, setServices] = useState<StaffServicePageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffDTO | null>(null);
  const [editing, setEditing] = useState<StaffDTO | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  const refresh = useCallback(() => { setLoading(true); setError(null); if (selectedId && canManage) setDetailLoading(true); setRevision((value) => value + 1); }, [selectedId, canManage]);
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
        const result = await listStaff(captured.organizationId, { limit: PAGE_SIZE, offset, status, ...(query ? { q: query } : {}) }, controller.signal);
        if (!active || !isCurrent(captured)) return;
        setPage(result);
      } catch (reason) {
        if (!active || controller.signal.aborted || !isCurrent(captured)) return;
        setError(reason instanceof Error ? reason.message : "No se pudieron cargar los profesionales.");
      } finally { if (active && isCurrent(captured)) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, offset, status, query, revision]);

  useEffect(() => {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!captured || !selectedId || !canManage) {
      return () => { active = false; controller.abort(); };
    }
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(captured)) return;
        const [staff, staffServices] = await Promise.all([
          readStaff(captured.organizationId, selectedId, controller.signal),
          listStaffServices(captured.organizationId, selectedId, { limit: PAGE_SIZE, offset: 0, status: "all" }, controller.signal),
        ]);
        if (!active || !isCurrent(captured)) return;
        setSelected(staff); setServices(staffServices);
      } catch (reason) {
        if (!active || controller.signal.aborted || !isCurrent(captured)) return;
        setDetailError(reason instanceof Error ? reason.message : "No se pudo cargar la ficha profesional.");
      } finally { if (active && isCurrent(captured)) setDetailLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, selectedId, canManage, revision]);

  function clearForm() { setEditing(null); setName(""); setEmail(""); setPhone(""); setFormError(null); }
  function startEditing(staff: StaffDTO) { setEditing(staff); setName(staff.name); setEmail(staff.email ?? ""); setPhone(staff.phone ?? ""); setFormError(null); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const captured = organizationId && userId ? { organizationId, userId } : null;
    if (!captured || !canManage || busy) return;
    setBusy(true); setFormError(null); setNotice(null);
    try {
      await preflightRef.current();
      if (!isCurrent(captured)) return;
      const input = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null };
      if (editing) {
        const updated = await saveStaff(captured.organizationId, editing.id, input, editing.version);
        if (!isCurrent(captured)) return;
        setSelected(updated); setNotice("Cambios guardados");
      } else {
        const created = await addStaff(captured.organizationId, input);
        if (!isCurrent(captured)) return;
        setNotice("Profesional agregado"); setSelectedId(created.id); setOffset(0); setStatus("active");
      }
      clearForm(); setLoading(true); setRevision((value) => value + 1);
    } catch (reason) {
      if (isCurrent(captured)) setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el profesional.");
    } finally { setBusy(false); }
  }

  async function toggleActive(staff: StaffDTO) {
    const captured = organizationId && userId ? { organizationId, userId } : null;
    if (!captured || !canManage || busy) return;
    setBusy(true); setFormError(null); setNotice(null);
    try {
      await preflightRef.current();
      if (!isCurrent(captured)) return;
      const updated = await saveStaff(captured.organizationId, staff.id, { active: !staff.active }, staff.version);
      if (!isCurrent(captured)) return;
      setSelected(updated); setNotice(updated.active ? "Profesional reactivado" : "Profesional archivado");
      if (editing?.id === staff.id) clearForm();
      setLoading(true); setRevision((value) => value + 1);
    } catch (reason) { if (isCurrent(captured)) setDetailError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    <SectionIntro label="Personas · operación" title="Profesionales" description="Administrá al personal que presta servicios en tu negocio. Las cuentas y los permisos de acceso se gestionan por separado en Equipo." icon={<User size={16} />} tone="lavender" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Directorio de profesionales" detail={`${page?.items.length ?? 0} ${page?.items.length === 1 ? "profesional" : "profesionales"} en esta página`}>
        <label htmlFor="staff-search" className="sr-only">Buscar profesionales</label>
        <div className="relative mb-3"><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="staff-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por nombre" className={inputClass + " pl-10"} /></div>
        <label htmlFor="staff-status" className="sr-only">Estado de profesionales</label>
        <select id="staff-status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setOffset(0); setLoading(true); setError(null); }} className={inputClass + " mb-5"}><option value="active">Activos</option><option value="inactive">Archivados</option><option value="all">Todos</option></select>
        <CollectionState loading={loading} error={error} empty={!loading && !error && (page?.items.length ?? 0) === 0} onRetry={refresh} />
        {!loading && !error && (page?.items.length ?? 0) > 0 ? <ul className="space-y-2">{page?.items.map((staff: StaffSummaryDTO) => <li key={staff.id}>{canManage ? <button type="button" onClick={() => { setSelectedId(staff.id); setSelected(null); setDetailLoading(true); setDetailError(null); }} aria-pressed={selectedId === staff.id} className="flex w-full items-center gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3 text-left transition-colors hover:border-[#D6C8EB] hover:bg-[#FBF9FF] focus-visible:outline-2 focus-visible:outline-[#7564AF] aria-pressed:border-[#D6C8EB] aria-pressed:bg-[#F6F3FF]"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F0ECFF] text-xs font-bold text-[#7564AF]">{staff.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{staff.name}</strong><span className="mt-0.5 block text-xs text-[#667078]">Profesional operativo</span></span>{!staff.active ? <span className="ml-auto text-xs text-[#7C8A88]">Archivado</span> : null}</button> : <div className="flex items-center gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F0ECFF] text-xs font-bold text-[#7564AF]">{staff.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{staff.name}</strong><span className="mt-0.5 block text-xs text-[#667078]">Profesional operativo</span></span>{!staff.active ? <span className="ml-auto text-xs text-[#7C8A88]">Archivado</span> : null}</div>}</li>)}</ul> : null}
        {page ? <nav aria-label="Páginas de profesionales" className="mt-4 flex items-center justify-between"><button type="button" disabled={offset === 0 || loading} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#7564AF] disabled:opacity-40">Anterior</button><span className="text-xs text-[#7C8A88]">{Math.floor(offset / PAGE_SIZE) + 1}</span><button type="button" disabled={!page.pageInfo.hasMore || loading} onClick={() => { setOffset(page.pageInfo.nextOffset ?? offset); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#7564AF] disabled:opacity-40">Siguiente</button></nav> : null}
        {page?.pageInfo.windowLimitReached ? <p className="mt-2 text-xs text-[#7C8A88]">Acotá la búsqueda para ver más resultados.</p> : null}
      </SectionCard>
      <div className="space-y-5">
        {canManage && selectedId ? <SectionCard title="Ficha profesional">
          {detailLoading ? <p role="status" className="text-sm text-[#667078]">Cargando ficha…</p> : null}
          {detailError ? <div><p role="alert" className="text-sm text-[#A04439]">{detailError}</p><button type="button" onClick={refresh} className="mt-3 text-sm font-bold underline">Reintentar</button></div> : null}
          {selected ? <><div className="flex items-center gap-3 border-b border-[#EEF1EF] pb-4"><span className="flex size-11 items-center justify-center rounded-xl bg-[#F0ECFF] text-[#7564AF]"><User size={21} /></span><div><p className="text-sm font-bold text-[#182026]">{selected.name}</p><p className="text-xs text-[#667078]">{selected.active ? "Activo" : "Archivado"}</p></div></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Teléfono</dt><dd className="mt-1 text-[#182026]">{selected.phone || "Sin registrar"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Correo</dt><dd className="mt-1 break-all text-[#182026]">{selected.email || "Sin registrar"}</dd></div></dl><div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Servicios habilitados</h3>{services?.items.length ? <ul className="mt-2 space-y-2">{services.items.map((link) => <li key={link.serviceId} className="flex items-center justify-between rounded-lg bg-[#FAFCFB] px-3 py-2 text-sm"><span>{link.service.name}</span><span className="text-xs text-[#7C8A88]">{link.service.active ? "Activo" : "Inactivo"}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#667078]">No tiene servicios habilitados.</p>}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startEditing(selected)} className={actionClass}>Editar</button><button type="button" disabled={busy} onClick={() => void toggleActive(selected)} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A] disabled:opacity-50">{selected.active ? "Archivar" : "Reactivar"}</button></div></> : null}
        </SectionCard> : null}
        {canManage ? <SectionCard id="nuevo-profesional" title={editing ? "Editar profesional" : "Nuevo profesional"} detail="Los contactos son opcionales. La cuenta de acceso se administra por separado en Equipo."><form onSubmit={submit} className="space-y-4"><FormField label="Nombre" htmlFor="staff-name"><input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nombre y apellido" className={inputClass} /></FormField><FormField label="Correo" htmlFor="staff-email"><input id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo de contacto" className={inputClass} /></FormField><FormField label="Teléfono" htmlFor="staff-phone"><input id="staff-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono de contacto" className={inputClass} /></FormField>{formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}<div className="flex gap-2"><button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando…" : editing ? "Guardar cambios" : "Agregar profesional"}</button>{editing ? <button type="button" disabled={busy} onClick={clearForm} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A]">Cancelar</button> : null}</div></form></SectionCard> : <SectionCard title="Acceso al equipo" detail="Equipo administra las cuentas, invitaciones y permisos de acceso."><p className="text-sm leading-6 text-[#667078]">El directorio de profesionales muestra sólo nombres y estados. Los datos de contacto y la gestión de fichas están disponibles para OWNER y ADMIN.</p></SectionCard>}
      </div>
    </div>
  </div>;
}
