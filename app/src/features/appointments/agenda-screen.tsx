"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccess } from "@/features/access/access-provider";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { Funnel } from "@phosphor-icons/react/dist/csr/Funnel";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/page-states";
import type { AppointmentDTO, OrganizationRole } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";
import { addDate, loadAgendaAppointments, loadAgendaSetup, localDateLabel, localDateTime, localMinute } from "./agenda-data";
import { AgendaPanel } from "./agenda-panel";
import styles from "./agenda.module.css";

type Mode = "DAY" | "WEEK";
type PanelState = { mode: "new" } | { mode: "detail" | "reschedule" | "cancel-confirm"; id: string };
const hourHeight = 80;

export function AgendaScreen() {
  const { snapshot, preflight } = useAccess();
  const organizationId = snapshot?.activeOrganizationId ?? null;
  const userId = snapshot?.user.id ?? null;
  const role: OrganizationRole = snapshot?.memberships.find((member) => member.organization.id === organizationId)?.role ?? "EMPLOYEE";
  const contextRef = useRef<{ organizationId: string; userId: string } | null>(null);
  const preflightRef = useRef(preflight);
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof loadAgendaSetup>> | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [date, setDate] = useState(() => todayDate());
  const [mode, setMode] = useState<Mode>("DAY");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [setupRevision, setSetupRevision] = useState(0);
  const contextRetries = useRef(0);
  const dateInitialized = useRef(false);

  useEffect(() => { contextRef.current = organizationId && userId ? { organizationId, userId } : null; preflightRef.current = preflight; }, [organizationId, userId, preflight]);
  const isCurrent = (context: { organizationId: string; userId: string }) => contextRef.current?.organizationId === context.organizationId && contextRef.current.userId === context.userId;

  useEffect(() => {
    const context = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!context) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(context)) return;
        const result = await loadAgendaSetup(context.organizationId, controller.signal);
        if (active && isCurrent(context)) { setSetup(result); if (!dateInitialized.current) { setDate(todayDate(result.timeZone)); dateInitialized.current = true; } }
      } catch (reason) { if (active && !controller.signal.aborted && isCurrent(context)) setError(errorMessage(reason)); }
      finally { if (active && isCurrent(context)) setSetupLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, setupRevision]);

  const range = useMemo(() => {
    if (mode === "DAY") return { fromDate: date, toDate: addDate(date, 1), days: [date] };
    const first = mondayOf(date);
    return { fromDate: first, toDate: addDate(first, 7), days: Array.from({ length: 7 }, (_, index) => addDate(first, index)) };
  }, [date, mode]);

  useEffect(() => {
    const context = organizationId && userId ? { organizationId, userId } : null;
    const controller = new AbortController();
    let active = true;
    if (!context) return () => { active = false; controller.abort(); };
    void (async () => {
      try {
        await preflightRef.current();
        if (!active || !isCurrent(context)) return;
        const result = await loadAgendaAppointments(context.organizationId, { fromDate: range.fromDate, toDate: range.toDate }, controller.signal);
        if (active && isCurrent(context)) { setAppointments(result); contextRetries.current = 0; }
      } catch (reason) {
        if (!active || controller.signal.aborted || !isCurrent(context)) return;
        if (reason instanceof ApiError && reason.code === "CONTEXT_CHANGED" && contextRetries.current === 0) { contextRetries.current = 1; setRevision((value) => value + 1); return; }
        setError(errorMessage(reason));
      } finally { if (active && isCurrent(context)) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [organizationId, userId, range.fromDate, range.toDate, revision]);

  const visible = useMemo(() => appointments.filter((item) => (!staffFilter || item.staffMemberId === staffFilter) && (!statusFilter || item.status === statusFilter)), [appointments, staffFilter, statusFilter]);
  const selected = panel && "id" in panel ? appointments.find((item) => item.id === panel.id) : undefined;
  const onChanged = useCallback((updated: AppointmentDTO, message: string) => {
    setPanel(null); setNotice(message); setLoading(true); setError(null); setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item)); setRevision((value) => value + 1);
  }, []);

  function navigate(amount: number) { setLoading(true); setError(null); setDate(addDate(date, amount * (mode === "DAY" ? 1 : 7))); setNotice(null); }
  function changeDate(value: string) { if (/^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value)) { setLoading(true); setError(null); setDate(value); setNotice(null); } }
  function changeMode(next: Mode) { if (next !== mode) { setLoading(true); setError(null); setMode(next); } }
  function retry() { setError(null); setLoading(true); setSetupLoading(true); setSetupRevision((value) => value + 1); setRevision((value) => value + 1); }
  const calendarColumns = mode === "DAY" ? dayColumns(setup, staffFilter).map((column) => ({ ...column, date })) : range.days.map((day) => ({ id: day, label: localDateLabel(day, { weekday: "short", day: "numeric" }), staffMemberId: null as string | null, date: day }));
  const timeRange = computeTimeRange(setup, visible);
  const canCreate = !loading && !!setup && (!!setup.services.length) && !error;

  return <main className={`${styles.agenda} flex min-h-[calc(100vh-5rem)] flex-col bg-[#F8FAF9] text-[#182026]`}>
    <header className="z-20 flex shrink-0 flex-col gap-4 border-b border-[#E4E9E7] bg-white px-4 py-4 shadow-sm md:px-7 md:py-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><h1 className="text-2xl font-bold tracking-tight">Agenda</h1><span aria-hidden="true" className="hidden h-6 w-px bg-[#E4E9E7] sm:block" />
          <div className="flex items-center gap-3"><div className="flex items-center rounded-xl border border-[#E4E9E7] p-1"><button type="button" aria-label={mode === "DAY" ? "Día anterior" : "Semana anterior"} onClick={() => navigate(-1)} className="rounded-lg p-2 text-[#667078] hover:bg-[#F8FAF9]"><CaretLeft size={17} /></button><button type="button" onClick={() => { setDate(todayDate()); setNotice(null); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-[#F8FAF9]">Hoy</button><button type="button" aria-label={mode === "DAY" ? "Día siguiente" : "Semana siguiente"} onClick={() => navigate(1)} className="rounded-lg p-2 text-[#667078] hover:bg-[#F8FAF9]"><CaretRight size={17} /></button></div>
            <label className="sr-only" htmlFor="agenda-date">Fecha de agenda</label><input id="agenda-date" type="date" value={date} onChange={(event) => changeDate(event.target.value)} className="max-w-[160px] rounded-lg border border-[#E4E9E7] bg-[#F8FAF9] px-2 py-2 text-sm font-semibold" />
            <span className="hidden text-sm font-bold capitalize text-[#182026] lg:block">{mode === "DAY" ? localDateLabel(date) : `${localDateLabel(range.fromDate, { day: "numeric", month: "short" })} – ${localDateLabel(addDate(range.toDate, -1), { day: "numeric", month: "short", year: "numeric" })}`}</span>
          </div>
        </div>
        <div className="flex items-center gap-3"><div role="group" aria-label="Vista de agenda" className="flex shrink-0 rounded-xl border border-[#E4E9E7] bg-white p-1"><button type="button" aria-pressed={mode === "DAY"} onClick={() => changeMode("DAY")} className={modeButton(mode === "DAY")}>Día</button><button type="button" aria-pressed={mode === "WEEK"} onClick={() => changeMode("WEEK")} className={modeButton(mode === "WEEK")}>Semana</button></div><Button onClick={() => { setNotice(null); setPanel({ mode: "new" }); }} disabled={!canCreate} className="ml-auto shrink-0 bg-[#182026] text-white hover:bg-[#2A3742]"><Plus size={17} weight="bold" /><span className="hidden sm:inline">Nuevo turno</span></Button></div>
      </div>
      <div className="flex items-center gap-3 overflow-x-auto pb-1"><div className="relative shrink-0"><Funnel size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667078]" /><label className="sr-only" htmlFor="agenda-staff-filter">Filtrar profesional</label><select id="agenda-staff-filter" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="min-w-48 rounded-xl border border-[#E4E9E7] bg-white py-2 pl-9 pr-3 text-sm"><option value="">Todos los profesionales</option>{setup?.staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><label className="sr-only" htmlFor="agenda-status-filter">Filtrar estado</label><select id="agenda-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-36 rounded-xl border border-[#E4E9E7] bg-white px-3 py-2 text-sm"><option value="">Todos los estados</option><option value="CONFIRMED">Confirmados</option><option value="COMPLETED">Completados</option><option value="CANCELLED">Cancelados</option><option value="NO_SHOW">Ausencias</option></select><span className="ml-auto hidden items-center gap-1 text-xs text-[#667078] md:flex"><Clock size={14} /> {setup ? `${setup.slotStepMinutes} min · ${setup.timeZone}` : ""}</span></div>
    </header>

    <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 py-4 md:px-6 md:py-5">
      {notice ? <div role="status" className="rounded-xl border border-[#CDE8D5] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#356B4A]">{notice}</div> : null}
      {setupLoading ? <LoadingState label="Cargando calendario" /> : error && !setup ? <ErrorState title="No pudimos cargar la agenda" description={error} action={<Button variant="outline" onClick={retry}>Reintentar</Button>} /> : loading ? <LoadingState label="Cargando reservas" /> : error ? <ErrorState title="No pudimos cargar las reservas" description={error} action={<Button variant="outline" onClick={retry}>Reintentar</Button>} /> : !setup ? <LoadingState label="Cargando calendario" /> : !setup.services.length ? <EmptyState title="No hay servicios disponibles" description="Agregá un servicio activo para crear reservas internas." /> : !setup.staff.length && !setup.services.some((service) => service.staffSelectionMode === "NO_ASSIGNMENT") ? <EmptyState title="Todavía no hay profesionales" description="Agregá profesionales y habilitá los servicios que prestan para comenzar a asignar reservas." /> : <>
        {!visible.length ? <div role="status" className="rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm text-[#667078]">No hay reservas para este período. Podés crear una reserva cuando quieras.</div> : null}
        <CalendarGrid mode={mode} columns={calendarColumns} setup={setup} appointments={visible} onSelect={(appointment) => setPanel({ mode: "detail", id: appointment.id })} startMinute={timeRange.start} endMinute={timeRange.end} />
      </>}
    </div>
    {panel && setup && organizationId ? <AgendaPanel key={`${panel.mode}:${"id" in panel ? panel.id : "new"}`} organizationId={organizationId} role={role} setup={setup} mode={panel.mode} date={date} appointment={selected} onClose={() => setPanel(null)} onChanged={onChanged} onMode={(next) => setPanel(panel && "id" in panel ? { mode: next, id: panel.id } : panel)} /> : null}
  </main>;
}

function CalendarGrid({ mode, columns, setup, appointments, onSelect, startMinute, endMinute }: {
  mode: Mode; columns: Array<{ id: string; label: string; staffMemberId: string | null; date: string }>;
  setup: NonNullable<Awaited<ReturnType<typeof loadAgendaSetup>>>; appointments: AppointmentDTO[]; onSelect(appointment: AppointmentDTO): void; startMinute: number; endMinute: number;
}) {
  const gridTemplate = `64px repeat(${columns.length}, minmax(220px, 1fr))`;
  const totalHeight = (endMinute - startMinute) / 60 * hourHeight;
  const hours = Array.from({ length: Math.max(1, endMinute / 60 - startMinute / 60 + 1) }, (_, index) => startMinute / 60 + index);
  const mobileBookings = [...appointments].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const mobileTimeOff = setup.calendars.flatMap((calendar) => calendar.timeOff.filter((block) => {
    const startDate = localDateTime(block.startAt, setup.timeZone).date;
    const endDate = localDateTime(block.endAt, setup.timeZone).date;
    return columns.some((column) => startDate <= column.date && endDate >= column.date);
  }).map((block) => ({ ...block, kind: calendar.kind })));
  return <>
    <div className="space-y-3 md:hidden">
      {mobileBookings.map((item) => {
        const local = localDateTime(item.startAt, setup.timeZone);
        return <button key={item.id} type="button" onClick={() => onSelect(item)} aria-label={`Ver reserva de ${item.customerNameSnapshot}`} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm ${appointmentTone(item.status)}`}>
          <span className="w-14 shrink-0 text-sm font-bold">{local.time}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.customerNameSnapshot}</span><span className="mt-0.5 block truncate text-xs">{item.serviceNameSnapshot}{item.staffNameSnapshot ? ` · ${item.staffNameSnapshot}` : ""}</span><span className="mt-1 block text-[10px] font-semibold">{statusText(item.status)}{mode === "WEEK" ? ` · ${localDateLabel(local.date, { weekday: "short", day: "numeric", month: "short" })}` : ""}</span></span><CaretRight size={17} />
        </button>;
      })}
      {mobileTimeOff.map((block) => <div key={block.id} className="flex items-center gap-3 rounded-2xl border border-[#E5D6C2] bg-[#FFF1E2] px-4 py-3 text-sm text-[#79572F]"><Clock size={17} /><span className="font-semibold">{block.kind === "BUSINESS" ? "Negocio cerrado" : "Ausencia de profesional"}</span><span className="ml-auto text-xs">{localDateTime(block.startAt, setup.timeZone).time} – {localDateTime(block.endAt, setup.timeZone).time}</span></div>)}
    </div>
    <div className="hidden min-h-0 flex-1 overflow-auto rounded-2xl border border-[#E4E9E7] bg-white shadow-[0_4px_20px_-2px_rgba(24,32,38,.04)] md:block">
    <div style={{ display: "grid", gridTemplateColumns: gridTemplate, minWidth: "max-content" }} className="relative">
      <div className="sticky top-0 left-0 z-30 border-b border-r border-[#E4E9E7] bg-[#F8FAF9]" />
      {columns.map((column) => <div key={`head-${column.id}`} className="sticky top-0 z-20 border-b border-r border-[#E4E9E7] bg-[#F8FAF9] px-3 py-3 text-center"><p className="text-sm font-bold capitalize">{column.label}</p><p className="mt-0.5 truncate text-[11px] text-[#667078]">{mode === "DAY" ? column.staffMemberId ? setup.staff.find((person) => person.id === column.staffMemberId)?.name ?? "Profesional" : "Sin profesional" : setup.staff.length ? `${setup.staff.length} profesionales` : "Sin profesional"}</p></div>)}
      <div className="sticky left-0 z-20 border-r border-[#E4E9E7] bg-white" style={{ height: totalHeight }}>
        {hours.map((hour) => <div key={hour} className="relative border-t border-[#E4E9E7] pr-2 text-right text-[11px] font-medium text-[#667078]" style={{ height: hourHeight }}><span className="relative -top-2 bg-white px-1">{String(hour).padStart(2, "0")}:00</span></div>)}
      </div>
      {columns.map((column) => <CalendarColumn key={column.id} mode={mode} column={column} setup={setup} appointments={appointments} onSelect={onSelect} startMinute={startMinute} endMinute={endMinute} totalHeight={totalHeight} />)}
    </div>
    </div>
  </>;
}

function CalendarColumn({ mode, column, setup, appointments, onSelect, startMinute, endMinute, totalHeight }: {
  mode: Mode; column: { id: string; label: string; staffMemberId: string | null; date: string }; setup: NonNullable<Awaited<ReturnType<typeof loadAgendaSetup>>>;
  appointments: AppointmentDTO[]; onSelect(appointment: AppointmentDTO): void; startMinute: number; endMinute: number; totalHeight: number;
}) {
  const date = column.date;
  const inColumn = appointments.filter((item) => {
    const local = localDateTime(item.startAt, setup.timeZone);
    if (local.date !== date) return false;
    return mode === "WEEK" || item.staffMemberId === column.staffMemberId || (!item.staffMemberId && !column.staffMemberId);
  }).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const positioned = assignLanes(inColumn, setup.timeZone);
  const closures = closureBlocks(setup, date, column.staffMemberId, startMinute, endMinute, mode);
  const timeOffs = setup.calendars.flatMap((calendar) => calendar.timeOff.filter((block) => {
    const localStart = localDateTime(block.startAt, setup.timeZone).date;
    const localEnd = localDateTime(block.endAt, setup.timeZone).date;
    return localStart <= date && localEnd >= date && (calendar.kind === "BUSINESS" || mode === "WEEK" || calendar.staffMemberId === column.staffMemberId);
  }).map((block) => ({ calendar, block })));
  return <div className="relative border-r border-[#E4E9E7] bg-white" style={{ height: totalHeight }}>
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">{Array.from({ length: Math.floor(totalHeight / hourHeight) + 1 }, (_, index) => <div key={index} className="absolute left-0 right-0 border-t border-[#EDF0EF]" style={{ top: index * hourHeight }} />)}</div>
    {closures.map((block, index) => <div key={`closed-${index}`} aria-label="Horario no disponible" className="absolute left-1 right-1 z-0 rounded-md bg-[repeating-linear-gradient(135deg,#f8faf9,#f8faf9_5px,#edf0ef_5px,#edf0ef_6px)]" style={{ top: minuteTop(block.start, startMinute), height: Math.max(3, minuteHeight(block.end - block.start)), pointerEvents: "none" }}><span className="sr-only">Horario no disponible</span></div>)}
    {timeOffs.map(({ calendar, block }) => {
      const startDate = localDateTime(block.startAt, setup.timeZone).date; const endDate = localDateTime(block.endAt, setup.timeZone).date;
      const start = Math.max(startMinute, startDate < date ? startMinute : localMinute(block.startAt, setup.timeZone));
      const end = Math.min(endMinute, endDate > date ? endMinute : localMinute(block.endAt, setup.timeZone));
      if (end <= start) return null;
      return <div key={block.id} aria-label={calendar.kind === "BUSINESS" ? "Negocio cerrado" : "Ausencia de profesional"} className="absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-[#E5D6C2] bg-[#FFF1E2]/95 px-2 py-1 text-[10px] font-semibold text-[#79572F]" style={{ top: minuteTop(start, startMinute), height: Math.max(20, minuteHeight(end - start)) }}>{calendar.kind === "BUSINESS" ? "Cerrado" : "Ausencia"}</div>;
    })}
    {positioned.map(({ item, lane, laneCount }) => {
      const start = localMinute(item.startAt, setup.timeZone); const end = Math.min(24 * 60, start + item.durationMinutes);
      const top = minuteTop(start, startMinute); const height = Math.max(38, minuteHeight(Math.max(15, end - start)) - 4);
      return <button key={item.id} type="button" onClick={() => onSelect(item)} aria-label={`Ver reserva de ${item.customerNameSnapshot}`} className={`absolute z-20 overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm transition hover:z-30 hover:brightness-[.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#182026] ${appointmentTone(item.status)}`} style={{ top: top + 2, height, left: `calc(${lane * 100 / laneCount}% + 3px)`, width: `calc(${100 / laneCount}% - 6px)` }}>
        <span className="block truncate text-xs font-bold">{localDateTime(item.startAt, setup.timeZone).time} · {item.customerNameSnapshot}</span><span className="mt-0.5 block truncate text-[11px]">{item.serviceNameSnapshot}{item.staffNameSnapshot && mode === "WEEK" ? ` · ${item.staffNameSnapshot}` : ""}</span><span className="mt-1 block truncate text-[10px] font-semibold">{statusText(item.status)}</span>
      </button>;
    })}
  </div>;
}

function assignLanes(items: AppointmentDTO[], timeZone: string) {
  const ends: number[] = []; const positions: Array<{ item: AppointmentDTO; lane: number; laneCount: number }> = [];
  for (const item of items) {
    const start = localMinute(item.startAt, timeZone); const end = Math.min(24 * 60, start + item.durationMinutes);
    let lane = ends.findIndex((lastEnd) => lastEnd <= start);
    if (lane < 0) { lane = ends.length; ends.push(end); } else ends[lane] = end;
    positions.push({ item, lane, laneCount: 1 });
  }
  // Each overlap group receives the same lane count so simultaneous bookings remain legible.
  for (const position of positions) {
    const start = localMinute(position.item.startAt, timeZone); const end = Math.min(24 * 60, start + position.item.durationMinutes);
    position.laneCount = Math.max(1, positions.filter((other) => {
      const otherStart = localMinute(other.item.startAt, timeZone); const otherEnd = Math.min(24 * 60, otherStart + other.item.durationMinutes);
      return otherStart < end && otherEnd > start;
    }).length);
  }
  return positions;
}

function dayColumns(setup: Awaited<ReturnType<typeof loadAgendaSetup>> | null, staffFilter: string) {
  const staff = (setup?.staff ?? []).filter((person) => !staffFilter || person.id === staffFilter);
  return [...staff.map((person) => ({ id: person.id, label: person.name, staffMemberId: person.id, date: "" })), { id: "none", label: "Sin asignación", staffMemberId: null, date: "" }];
}
function closureBlocks(setup: NonNullable<Awaited<ReturnType<typeof loadAgendaSetup>>>, date: string, staffId: string | null, start: number, end: number, mode: Mode) {
  const business = setup.calendars.find((calendar) => calendar.kind === "BUSINESS");
  const staff = staffId ? setup.calendars.find((calendar) => calendar.staffMemberId === staffId) : undefined;
  const dayWindows = (calendar?: typeof business) => {
    if (!calendar) return [] as Array<{ startMinute: number; endMinute: number }>;
    const override = calendar.dayOverrides.find((item) => item.localDate.slice(0, 10) === date);
    if (override) return override.windows;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    return calendar.weeklyWindows.filter((window) => window.weekday === weekday);
  };
  const businessWindows = dayWindows(business);
  const effective = mode === "WEEK" || !staff ? businessWindows : intersectWindows(businessWindows, dayWindows(staff));
  const normalized = effective.map((window) => ({ start: Math.max(start, window.startMinute), end: Math.min(end, window.endMinute) })).filter((window) => window.end > window.start).sort((a, b) => a.start - b.start);
  const blocks: Array<{ start: number; end: number }> = []; let cursor = start;
  for (const window of normalized) { if (window.start > cursor) blocks.push({ start: cursor, end: window.start }); cursor = Math.max(cursor, window.end); }
  if (cursor < end) blocks.push({ start: cursor, end });
  return blocks;
}
function intersectWindows(a: Array<{ startMinute: number; endMinute: number }>, b: Array<{ startMinute: number; endMinute: number }>) { return a.flatMap((left) => b.map((right) => ({ startMinute: Math.max(left.startMinute, right.startMinute), endMinute: Math.min(left.endMinute, right.endMinute) })).filter((window) => window.endMinute > window.startMinute)); }
function computeTimeRange(setup: Awaited<ReturnType<typeof loadAgendaSetup>> | null, appointments: AppointmentDTO[]) {
  const starts = setup?.calendars.flatMap((calendar) => calendar.weeklyWindows.map((window) => window.startMinute)) ?? [];
  const ends = setup?.calendars.flatMap((calendar) => calendar.weeklyWindows.map((window) => window.endMinute)) ?? [];
  for (const item of appointments) { const start = localMinute(item.startAt, setup?.timeZone ?? "UTC"); starts.push(start); ends.push(Math.min(24 * 60, start + item.durationMinutes)); }
  const min = starts.length ? Math.min(...starts) : 8 * 60; const max = ends.length ? Math.max(...ends) : 20 * 60;
  const start = Math.max(0, Math.floor(min / 60) * 60); const end = Math.min(24 * 60, Math.ceil(max / 60) * 60);
  return { start: start === end ? 8 * 60 : start, end: start === end ? 20 * 60 : end };
}
function todayDate(timeZone = "UTC") { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`; }
function mondayOf(date: string) { const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7; return addDate(date, 1 - weekday); }
function validDate(date: string) { const [year, month, day] = date.split("-").map(Number); const parsed = new Date(Date.UTC(year!, month! - 1, day!)); return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day; }
function minuteTop(minute: number, startMinute: number) { return (minute - startMinute) / 60 * hourHeight; }
function minuteHeight(minutes: number) { return minutes / 60 * hourHeight; }
function modeButton(active: boolean) { return `rounded-lg px-3 py-1.5 text-sm font-bold transition ${active ? "border border-[#E4E9E7] bg-[#F8FAF9] text-[#182026] shadow-sm" : "text-[#667078] hover:text-[#182026]"}`; }
function appointmentTone(status: AppointmentDTO["status"]) { return status === "CONFIRMED" ? "border-[#7EA8F8] bg-[#E8F0FF] text-[#294B7D]" : status === "COMPLETED" ? "border-[#7ED6A5] bg-[#DDF6E8] text-[#2E6A48]" : status === "NO_SHOW" ? "border-[#F87E7E] bg-[#FFE8E8] text-[#8F3434]" : "border-[#D7DEDB] bg-[#F0F2F1] text-[#667078]"; }
function statusText(status: AppointmentDTO["status"]) { return ({ CONFIRMED: "Confirmada", COMPLETED: "Completada", CANCELLED: "Cancelada", NO_SHOW: "Ausencia" } as const)[status]; }
function errorMessage(error: unknown) { if (error instanceof ApiError && error.status === 401) return "La sesión expiró. Volvé a iniciar sesión."; if (error instanceof ApiError && error.status === 403) return "No tenés permisos para consultar esta agenda."; return error instanceof Error ? error.message : "No pudimos completar la operación."; }
