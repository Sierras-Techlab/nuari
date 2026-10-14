"use client";

import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useAccess } from "@/features/access/access-provider";
import {
  addService, addServiceCategory, assignStaffToService, listServiceCategories, listServiceStaff,
  listServices, listStaff, readService, saveService, saveServiceCategory, unassignStaffFromService,
} from "@/features/service-catalog/service-catalog-adapter";
import type { ServiceCategoryDTO, ServiceDTO, ServicePageDTO, StaffServiceDTO, StaffSummaryDTO } from "@/lib/api/contracts";
import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";

const PAGE_SIZE = 25;
type CatalogStatus = "active" | "inactive" | "all";
type StaffMode = ServiceDTO["staffSelectionMode"] | "";

export function ServicesScreen() {
  const { snapshot, preflight } = useAccess();
  const organizationId = snapshot?.activeOrganizationId ?? null;
  const userId = snapshot?.user.id ?? null;
  const role = snapshot?.memberships.find((member) => member.organization.id === organizationId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const contextRef = useRef<{ organizationId: string; userId: string } | null>(null);
  const preflightRef = useRef(preflight);
  const [page, setPage] = useState<ServicePageDTO | null>(null);
  const [categories, setCategories] = useState<ServiceCategoryDTO[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffSummaryDTO[]>([]);
  const [links, setLinks] = useState<StaffServiceDTO[]>([]);
  const [selected, setSelected] = useState<ServiceDTO | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [categoryRevision, setCategoryRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CatalogStatus>("active");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<ServiceDTO["staffSelectionMode"] | "">("");
  const [offset, setOffset] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("40");
  const [pricingType, setPricingType] = useState<ServiceDTO["pricingType"]>("ON_REQUEST");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectionMode, setSelectionMode] = useState<StaffMode>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editing, setEditing] = useState<ServiceDTO | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    contextRef.current = organizationId && userId ? { organizationId, userId } : null;
    preflightRef.current = preflight;
  }, [organizationId, userId, preflight]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim()); setOffset(0); setLoading(true); setError(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  function isCurrent(context: { organizationId: string; userId: string }) {
    return contextRef.current?.organizationId === context.organizationId && contextRef.current.userId === context.userId;
  }

  function refresh() { setLoading(true); setError(null); setRevision((value) => value + 1); }

  useEffect(() => {
    const context = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!context) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(context)) return;
        const result = await listServices(context.organizationId, {
          limit: PAGE_SIZE, offset, status, ...(query ? { q: query } : {}),
          ...(categoryFilter ? { categoryId: categoryFilter } : {}), ...(modeFilter ? { staffSelectionMode: modeFilter } : {}),
        }, controller.signal);
        if (active && isCurrent(context)) setPage(result);
      } catch (reason) {
        if (active && !controller.signal.aborted && isCurrent(context)) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los servicios.");
      } finally { if (active && isCurrent(context)) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, offset, status, query, categoryFilter, modeFilter, revision]);

  useEffect(() => {
    const context = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!context) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(context)) return;
        const result = await listServiceCategories(context.organizationId, { limit: 100, offset: 0, status: "all" }, controller.signal);
        if (active && isCurrent(context)) setCategories(result.items);
      } catch (reason) {
        if (active && !controller.signal.aborted && isCurrent(context)) setCategoryError(reason instanceof Error ? reason.message : "No se pudieron cargar las categorías.");
      } finally { if (active && isCurrent(context)) setCategoryLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, categoryRevision]);

  useEffect(() => {
    const context = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!context || !selectedId) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(context)) return;
        const [service, staffPage, linkPage] = await Promise.all([
          readService(context.organizationId, selectedId, controller.signal),
          listStaff(context.organizationId, { limit: 100, offset: 0, status: "active" }, controller.signal),
          listServiceStaff(context.organizationId, selectedId, { limit: 100, offset: 0, status: "all" }, controller.signal),
        ]);
        if (!active || !isCurrent(context)) return;
        setSelected(service); setStaffOptions(staffPage.items); setLinks(linkPage.items); setDetailError(null);
      } catch (reason) {
        if (active && !controller.signal.aborted && isCurrent(context)) setDetailError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle del servicio.");
      } finally { if (active && isCurrent(context)) setDetailLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, selectedId, detailRevision]);

  function startEditing(service: ServiceDTO) {
    setEditing(service); setName(service.name); setDescription(service.description ?? ""); setDuration(String(service.durationMinutes));
    setPricingType(service.pricingType); setPrice(service.price ?? ""); setCategoryId(service.categoryId ?? "");
    setSelectionMode(service.staffSelectionMode); setSortOrder(String(service.sortOrder)); setFormError(null); setNotice(null);
  }

  function resetForm() {
    setEditing(null); setName(""); setDescription(""); setDuration("40"); setPricingType("ON_REQUEST");
    setPrice(""); setCategoryId(""); setSelectionMode(""); setSortOrder("0"); setFormError(null);
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage) return;
    setBusy(true); setFormError(null); setNotice(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      const input = {
        name, description: description.trim() || null,
        durationMinutes: Number(duration), pricingType,
        price: pricingType === "ON_REQUEST" ? null : price,
        categoryId: categoryId || null,
        sortOrder: Number(sortOrder),
        ...(selectionMode ? { staffSelectionMode: selectionMode } : {}),
        modality: "IN_PERSON" as const,
      };
      const result = editing
        ? await saveService(context.organizationId, editing.id, input, editing.version)
        : selectionMode ? await addService(context.organizationId, { ...input, staffSelectionMode: selectionMode }) : null;
      if (!isCurrent(context)) return;
      if (!result) { setFormError("Elegí cómo se asignará el profesional para este servicio."); return; }
      resetForm(); setSelectedId(result.id); setSelected(result); setDetailLoading(true); setDetailError(null);
      setQueryInput(""); setQuery(""); setStatus("all"); setOffset(0); setLoading(true); setError(null);
      setNotice(editing ? "Cambios guardados" : "Servicio agregado"); setRevision((value) => value + 1);
    } catch (reason) {
      if (isCurrent(context)) setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el servicio.");
    } finally { if (isCurrent(context)) setBusy(false); }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage) return;
    setCategoryBusy(true); setCategoryError(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      await addServiceCategory(context.organizationId, { name: categoryName, sortOrder: 0 });
      if (!isCurrent(context)) return;
      setCategoryName(""); setCategoryRevision((value) => value + 1); setNotice("Categoría agregada");
    } catch (reason) {
      if (isCurrent(context)) setCategoryError(reason instanceof Error ? reason.message : "No se pudo guardar la categoría.");
    } finally { if (isCurrent(context)) setCategoryBusy(false); }
  }

  async function toggleCategory(category: ServiceCategoryDTO) {
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage) return;
    const name = window.prompt("Nombre de la categoría", category.name);
    if (name === null) return;
    setCategoryBusy(true); setCategoryError(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      await saveServiceCategory(context.organizationId, category.id, { name: name.trim() || category.name, active: category.active }, category.version);
      if (!isCurrent(context)) return;
      setCategoryRevision((value) => value + 1); setNotice("Categoría actualizada");
    } catch (reason) {
      if (isCurrent(context)) setCategoryError(reason instanceof Error ? reason.message : "No se pudo actualizar la categoría.");
    } finally { if (isCurrent(context)) setCategoryBusy(false); }
  }

  async function archiveCategory(category: ServiceCategoryDTO) {
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage) return;
    setCategoryBusy(true); setCategoryError(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      await saveServiceCategory(context.organizationId, category.id, { active: !category.active }, category.version);
      if (!isCurrent(context)) return;
      setCategoryRevision((value) => value + 1); setNotice(category.active ? "Categoría archivada" : "Categoría reactivada");
    } catch (reason) {
      if (isCurrent(context)) setCategoryError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado.");
    } finally { if (isCurrent(context)) setCategoryBusy(false); }
  }

  async function toggleServiceActive() {
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage || !selected) return;
    setBusy(true); setDetailError(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      const updated = await saveService(context.organizationId, selected.id, { active: !selected.active }, selected.version);
      if (!isCurrent(context)) return;
      setSelected(updated); setNotice(updated.active ? "Servicio reactivado" : "Servicio archivado");
      setLoading(true); setRevision((value) => value + 1); setDetailRevision((value) => value + 1);
    } catch (reason) {
      if (isCurrent(context)) setDetailError(reason instanceof Error ? reason.message : "No se pudo cambiar el estado del servicio.");
    } finally { if (isCurrent(context)) setBusy(false); }
  }

  async function changeAssociation(staffMemberId: string, add: boolean) {
    const context = organizationId && userId ? { organizationId, userId } : null;
    if (!context || !canManage || !selected) return;
    setBusy(true); setDetailError(null);
    try {
      await preflightRef.current();
      if (!isCurrent(context)) return;
      const result = add
        ? await assignStaffToService(context.organizationId, selected.id, staffMemberId, selected.version)
        : await unassignStaffFromService(context.organizationId, selected.id, staffMemberId, selected.version);
      if (!isCurrent(context)) return;
      setSelected((current) => current ? { ...current, version: result.serviceVersion } : current);
      setSelectedStaffId(""); setDetailRevision((value) => value + 1);
      setNotice(add ? "Profesional habilitado para el servicio" : "Habilitación quitada");
    } catch (reason) {
      if (isCurrent(context)) setDetailError(reason instanceof Error ? reason.message : "No se pudo actualizar la habilitación.");
    } finally { if (isCurrent(context)) setBusy(false); }
  }

  const items = page?.items ?? [];
  const activeLinks = links.filter((link) => link.staff.active);
  const linkedStaffIds = new Set(links.map((link) => link.staffMemberId));
  const eligibleOptions = staffOptions.filter((staff) => !linkedStaffIds.has(staff.id));

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Turnero / Servicios" title="Servicios a tu manera." description="Definí qué ofrece tu equipo, cuánto tiempo necesita y quién puede realizar cada servicio." icon={<SquaresFour size={15} weight="duotone" />} tone="mint" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="space-y-5">
        <SectionCard title="Catálogo de servicios" detail={`${items.length} ${items.length === 1 ? "servicio" : "servicios"} en esta página`}>
          <label htmlFor="service-search" className="sr-only">Buscar servicios</label>
          <div className="relative mb-3"><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="service-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar servicios" className={inputClass + " pl-10"} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="sr-only" htmlFor="service-status">Estado</label><select id="service-status" value={status} onChange={(event) => { setStatus(event.target.value as CatalogStatus); setOffset(0); setLoading(true); setError(null); }} className={inputClass}><option value="active">Activos</option><option value="inactive">Archivados</option><option value="all">Todos</option></select>
            <label className="sr-only" htmlFor="service-category-filter">Categoría</label><select id="service-category-filter" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setOffset(0); setLoading(true); setError(null); }} className={inputClass}><option value="">Todas las categorías</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <label className="sr-only" htmlFor="service-mode-filter">Asignación</label><select id="service-mode-filter" value={modeFilter} onChange={(event) => { setModeFilter(event.target.value as typeof modeFilter); setOffset(0); setLoading(true); setError(null); }} className={inputClass}><option value="">Todos los modos</option><option value="CUSTOMER_CHOICE">A elección del cliente</option><option value="AUTO_ASSIGN">Asignación automática</option><option value="NO_ASSIGNMENT">Sin profesional</option></select>
          </div>
          <div className="mt-5"><CollectionState loading={loading} error={error} empty={!loading && !error && items.length === 0} onRetry={refresh} /></div>
          {!loading && !error && items.length > 0 ? <ul className="mt-4 divide-y divide-[#EEF1EF]">{items.map((item) => <li key={item.id} className="py-3 first:pt-0 last:pb-0"><button type="button" onClick={() => { setSelectedId(item.id); setSelected(null); setLinks([]); setDetailLoading(true); setDetailError(null); }} aria-pressed={selectedId === item.id} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#FAFCFB] focus-visible:outline-2 focus-visible:outline-[#438C78] aria-pressed:bg-[#F0F5FF]"><span className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#DDF6E8] text-[#438C78]"><SquaresFour size={19} weight="duotone" /></span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{item.name}</strong><span className="mt-1 block truncate text-xs text-[#667078]">{item.description || "Sin descripción"}</span></span></span><span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F6F5] px-3 py-1.5 text-xs font-semibold text-[#536068]"><Clock size={14} /> {item.durationMinutes} min</span><span className="ml-auto text-xs font-semibold text-[#536068]">{item.pricingType === "ON_REQUEST" ? "Consultar" : item.price === "0.00" ? "Gratis" : `${item.pricingType === "FROM" ? "Desde " : ""}${item.price ?? ""} ${item.currency}`}</span>{!item.active ? <span className="text-xs text-[#7C8A88]">Archivado</span> : null}</button></li>)}</ul> : null}
          {page ? <nav aria-label="Páginas de servicios" className="mt-4 flex items-center justify-between"><button type="button" disabled={offset === 0 || loading} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#526B9B] disabled:opacity-40">Anterior</button><span className="text-xs text-[#7C8A88]">{Math.floor(offset / PAGE_SIZE) + 1}</span><button type="button" disabled={!page.pageInfo.hasMore || loading} onClick={() => { setOffset(page.pageInfo.nextOffset ?? offset); setLoading(true); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#526B9B] disabled:opacity-40">Siguiente</button></nav> : null}
          {page?.pageInfo.windowLimitReached ? <p className="mt-2 text-xs text-[#7C8A88]">Acotá la búsqueda para ver más resultados.</p> : null}
        </SectionCard>
        <SectionCard title="Categorías" detail="Organizá el catálogo sin cambiar las categorías guardadas en servicios.">
          {categoryLoading ? <p role="status" className="text-sm text-[#667078]">Cargando categorías…</p> : categoryError ? <p role="alert" className="text-sm text-[#A04439]">{categoryError}</p> : <ul className="mb-4 space-y-2">{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#FAFCFB] px-3 py-2"><span className="text-sm font-semibold text-[#182026]">{category.name}{!category.active ? <span className="ml-2 text-xs font-normal text-[#7C8A88]">Archivada</span> : null}</span>{canManage ? <span className="flex gap-2"><button type="button" disabled={categoryBusy} onClick={() => toggleCategory(category)} className="text-xs font-bold text-[#526B9B]">Renombrar</button><button type="button" disabled={categoryBusy} onClick={() => archiveCategory(category)} className="text-xs font-bold text-[#526B9B]">{category.active ? "Archivar" : "Reactivar"}</button></span> : null}</li>)}</ul>}
          {canManage ? <form onSubmit={submitCategory} className="flex gap-2"><label className="sr-only" htmlFor="category-name">Nombre de categoría</label><input id="category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nueva categoría" required className={inputClass} /><button type="submit" disabled={categoryBusy} aria-label="Agregar categoría" className="min-w-11 rounded-xl bg-[#182026] px-3 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /></button></form> : null}
          {categoryError && !categoryLoading ? <p role="alert" className="mt-3 text-sm text-[#A04439]">{categoryError}</p> : null}
        </SectionCard>
      </div>
      <div className="space-y-5">
        {selected ? <SectionCard title="Detalle del servicio" detail={selected.active ? "Servicio activo" : "Servicio archivado"}>
          {detailLoading ? <p role="status" className="mb-3 text-sm text-[#667078]">Actualizando detalle…</p> : null}
          {detailError ? <p role="alert" className="mb-3 rounded-lg bg-[#FFF6F3] p-3 text-sm text-[#A04439]">{detailError}</p> : null}
          <dl className="space-y-3 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Duración</dt><dd className="mt-1">{selected.durationMinutes} min</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Precio</dt><dd className="mt-1">{selected.pricingType === "ON_REQUEST" ? "Consultar" : selected.price === "0.00" ? "Gratis" : `${selected.pricingType === "FROM" ? "Desde " : ""}${selected.price ?? ""} ${selected.currency}`}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Categoría</dt><dd className="mt-1">{categories.find((category) => category.id === selected.categoryId)?.name ?? (selected.categoryId ? "Categoría archivada" : "Sin categoría")}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Modalidad</dt><dd className="mt-1">Presencial</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-[#9AA7A5]">Profesional</dt><dd className="mt-1">{selected.staffSelectionMode === "CUSTOMER_CHOICE" ? "A elección del cliente" : selected.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "No requiere profesional"}</dd></div></dl>
          {selected.staffSelectionMode !== "NO_ASSIGNMENT" && activeLinks.length === 0 ? <p className="mt-4 rounded-xl border border-[#FFF1E2] bg-[#FFF7EE] p-3 text-sm text-[#805B35]">No hay profesionales activos habilitados para este servicio. Revisá las habilitaciones antes de ofrecerlo para agenda.</p> : null}
          <div className="mt-5"><h3 className="text-sm font-bold text-[#182026]">Profesionales habilitados</h3>{links.length === 0 ? <p className="mt-2 text-sm text-[#667078]">Todavía no hay habilitaciones.</p> : <ul className="mt-2 space-y-2">{links.map((link) => <li key={link.staffMemberId} className="flex items-center justify-between gap-2 rounded-xl bg-[#FAFCFB] px-3 py-2"><span className="text-sm">{link.staff.name}{!link.staff.active ? <span className="ml-2 text-xs text-[#7C8A88]">Inactivo</span> : null}</span>{canManage ? <button type="button" disabled={busy} onClick={() => void changeAssociation(link.staffMemberId, false)} className="text-xs font-bold text-[#526B9B]">Quitar</button> : null}</li>)}</ul>}</div>
          {canManage ? <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="service-staff-select">Profesional para habilitar</label><select id="service-staff-select" value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)} className={inputClass}><option value="">Elegir profesional</option>{eligibleOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select><button type="button" disabled={!selectedStaffId || busy} onClick={() => void changeAssociation(selectedStaffId, true)} className="min-w-11 rounded-xl bg-[#182026] px-3 text-sm font-bold text-white disabled:opacity-50" aria-label="Habilitar profesional"><Plus size={16} /></button></div> : null}
          {canManage ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => startEditing(selected)} className={actionClass}>Editar</button><button type="button" disabled={busy} onClick={() => void toggleServiceActive()} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A] disabled:opacity-50">{selected.active ? "Archivar" : "Reactivar"}</button></div> : null}
        </SectionCard> : detailLoading ? <SectionCard title="Detalle del servicio"><p role="status" className="text-sm text-[#667078]">Cargando detalle…</p></SectionCard> : null}
        {canManage ? <SectionCard id="nuevo-servicio" title={editing ? "Editar servicio" : "Nuevo servicio"} detail="El precio se conserva como importe decimal exacto.">
          <form onSubmit={submitService} className="space-y-4">
            <FormField label="Nombre" htmlFor="service-name"><input id="service-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del servicio" required className={inputClass} /></FormField>
            <FormField label="Duración en minutos" htmlFor="service-duration"><input id="service-duration" type="number" min="5" max="720" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} required className={inputClass} /></FormField>
            <FormField label="Descripción" htmlFor="service-description"><textarea id="service-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Opcional" className={inputClass + " h-auto min-h-24 py-3"} /></FormField>
            <FormField label="Precio" htmlFor="service-pricing-type"><select id="service-pricing-type" value={pricingType} onChange={(event) => setPricingType(event.target.value as ServiceDTO["pricingType"])} className={inputClass}><option value="ON_REQUEST">Consultar</option><option value="FIXED">Precio fijo</option><option value="FROM">Desde</option></select></FormField>
            {pricingType !== "ON_REQUEST" ? <FormField label="Importe decimal" htmlFor="service-price"><input id="service-price" type="text" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="12500.00" required className={inputClass} /></FormField> : null}
            <FormField label="Categoría" htmlFor="service-category"><select id="service-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id} disabled={!category.active && category.id !== editing?.categoryId}>{category.name}{!category.active ? " (archivada)" : ""}</option>)}</select></FormField>
            <FormField label="Orden" htmlFor="service-sort-order"><input id="service-sort-order" type="number" min="0" max="1000000" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className={inputClass} /></FormField>
            <FormField label="Asignación profesional" htmlFor="service-selection-mode"><select id="service-selection-mode" value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as StaffMode)} required className={inputClass}><option value="">Elegí una opción</option><option value="CUSTOMER_CHOICE">A elección del cliente</option><option value="AUTO_ASSIGN">Asignación automática</option><option value="NO_ASSIGNMENT">No requiere profesional</option></select></FormField>
            <p className="text-xs leading-5 text-[#7C8A88]">Modalidad: presencial. La disponibilidad no se calcula en este catálogo.</p>
            {formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}
            <div className="flex gap-2"><button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando…" : editing ? "Guardar cambios" : "Agregar servicio"}</button>{editing ? <button type="button" disabled={busy} onClick={resetForm} className="min-h-11 rounded-xl border border-[#DDE5E2] px-4 text-sm font-bold text-[#43505A]">Cancelar</button> : null}</div>
          </form>
        </SectionCard> : null}
      </div>
    </div>
  </div>;
}
