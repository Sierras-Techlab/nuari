"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { getAppointment } from "@/lib/api/browser";
import type { AppointmentAssignment, AppointmentCancelReason, AppointmentDTO, AvailabilityDTO, BookingCalendarDTO, CustomerSummaryDTO, OrganizationRole, ServiceDTO, StaffSummaryDTO } from "@/lib/api/contracts";
import { cancelAgendaAppointment, closeAgendaAppointment, loadAvailableSlots, loadEligibleStaff, moveAppointment, saveNewAppointment, searchAgendaCustomers } from "./agenda-data";
import styles from "./agenda.module.css";

type Mode = "new" | "detail" | "reschedule" | "cancel-confirm";
type Setup = { services: ServiceDTO[]; staff: StaffSummaryDTO[]; calendars: BookingCalendarDTO[]; slotStepMinutes: number; timeZone: string };
type Props = {
  organizationId: string; role: OrganizationRole; setup: Setup; mode: Mode; date: string; appointment?: AppointmentDTO;
  onClose(): void; onChanged(appointment: AppointmentDTO, message: string): void; onMode(mode: Mode): void;
};

export function AgendaPanel({ organizationId, role, setup, mode, date: initialDate, appointment, onClose, onChanged, onMode }: Props) {
  const canManage = role === "OWNER" || role === "ADMIN";
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerSummaryDTO[]>([]);
  const [customer, setCustomer] = useState<CustomerSummaryDTO | null>(null);
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? "");
  const [date, setDate] = useState(appointment ? localDate(appointment.startAt, setup.timeZone) : initialDate);
  const [eligibleState, setEligibleState] = useState<{ serviceId: string; items: Array<Pick<StaffSummaryDTO, "id" | "name" | "active">> } | null>(null);
  const [staffId, setStaffId] = useState(appointment?.assignmentKind === "SPECIFIC" ? appointment.staffMemberId ?? "" : "");
  const [slotState, setSlotState] = useState<{ key: string; loading: boolean; slots: AvailabilityDTO["slots"] }>({ key: "", loading: false, slots: [] });
  const [selectedSlot, setSelectedSlot] = useState<{ key: string; startAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState<AppointmentCancelReason>("BUSINESS_REQUEST");
  const [notes, setNotes] = useState("");
  const [privateNote, setPrivateNote] = useState<{ appointmentId: string; text: string | null } | null>(null);
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const service = setup.services.find((item) => item.id === serviceId);
  const eligibleStaff = eligibleState && eligibleState.serviceId === service?.id ? eligibleState.items : [];

  const assignment: AppointmentAssignment | null = useMemo(() => {
    if (!service) return null;
    if (service.staffSelectionMode === "NO_ASSIGNMENT") return { kind: "NONE" };
    if (service.staffSelectionMode === "AUTO_ASSIGN" || !staffId) return { kind: "ANY" };
    return { kind: "SPECIFIC", staffMemberId: staffId };
  }, [service, staffId]);
  const slotKey = assignmentKeyFor(service?.id, date, assignment);
  const selectedStart = selectedSlot?.key === slotKey ? selectedSlot.startAt : "";
  const slotLoading = !!assignment && !!service && (slotState.key !== slotKey || slotState.loading);
  const slots = slotState.key === slotKey ? slotState.slots : [];
  const customerSearching = searchingQuery === customerQuery;
  const privateNotes = privateNote && privateNote.appointmentId === appointment?.id ? privateNote.text : null;

  useEffect(() => {
    if (mode !== "detail" || !appointment || !canManage) return;
    const controller = new AbortController();
    void getAppointment(organizationId, appointment.id, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPrivateNote({ appointmentId: appointment.id, text: result.internalNotes ?? null });
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [organizationId, appointment, mode, canManage]);

  useEffect(() => {
    if (mode !== "new") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchingQuery(customerQuery);
      void searchAgendaCustomers(organizationId, customerQuery.trim(), controller.signal)
        .then((result) => { if (!controller.signal.aborted) { setCustomers(result); setSearchingQuery(null); } })
        .catch((reason: unknown) => { if (!controller.signal.aborted) { setError(errorMessage(reason)); setSearchingQuery(null); } });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [organizationId, customerQuery, mode]);

  useEffect(() => {
    if (!service || service.staffSelectionMode === "NO_ASSIGNMENT") return;
    const controller = new AbortController();
    void loadEligibleStaff(organizationId, service.id, controller.signal).then((items) => {
      if (!controller.signal.aborted) setEligibleState({ serviceId: service.id, items });
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [organizationId, service]);

  useEffect(() => {
    if (!assignment || !service || !date || (mode !== "new" && mode !== "reschedule")) return;
    const controller = new AbortController();
    const key = assignmentKeyFor(service.id, date, assignment);
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) { setSlotState({ key, loading: true, slots: [] }); setError(null); }
      return loadAvailableSlots(organizationId, { serviceId: service.id, date, assignment, signal: controller.signal });
    })
      .then((result) => { if (!controller.signal.aborted) setSlotState({ key, loading: false, slots: result }); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) { setError(errorMessage(reason)); setSlotState({ key, loading: false, slots: [] }); } });
    return () => controller.abort();
  }, [organizationId, service, assignment, slotKey, date, mode]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    if (mode === "detail" || mode === "cancel-confirm") titleRef.current?.focus();
    else dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled])")?.focus();
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape" && !busy) closeRef.current(); }
    document.addEventListener("keydown", onEscape);
    return () => { document.removeEventListener("keydown", onEscape); previousFocus?.focus(); };
  }, [busy, mode]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (!controls?.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (!service || !assignment || !selectedStart) throw new ApiError(400, "VALIDATION_ERROR", "Elegí un servicio y un horario disponible.");
      if (mode === "new") {
        if (!customer) throw new ApiError(400, "VALIDATION_ERROR", "Seleccioná un cliente existente.");
        const created = await saveNewAppointment(organizationId, { customerId: customer.id, serviceId: service.id, startAt: selectedStart, assignment, ...(canManage && notes.trim() ? { internalNotes: notes.trim() } : {}) });
        onChanged(created, "Turno creado correctamente");
      } else if (appointment) {
        const moved = await moveAppointment(organizationId, appointment, selectedStart, assignment);
        onChanged(moved, "Turno reprogramado");
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!appointment) return;
    setBusy(true); setError(null);
    try { onChanged(await cancelAgendaAppointment(organizationId, appointment, cancelReason), "Turno cancelado"); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function close(status: "complete" | "no-show") {
    if (!appointment) return;
    setBusy(true); setError(null);
    try { onChanged(await closeAgendaAppointment(organizationId, appointment, status), status === "complete" ? "Turno marcado como completado" : "Turno marcado como ausencia"); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  const title = mode === "new" ? "Nueva reserva" : mode === "detail" ? "Detalles de la reserva" : mode === "reschedule" ? "Reprogramar reserva" : "Cancelar reserva";
  const visibleSlots = slots.filter((slot) => slot.localDate === date);
  const localTimeCounts = new Map<string, number>();
  for (const slot of visibleSlots) localTimeCounts.set(slot.localTime, (localTimeCounts.get(slot.localTime) ?? 0) + 1);

  return <div className={`fixed inset-0 z-50 flex justify-end ${styles.backdrop}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="absolute inset-0 bg-[#182026]/35 backdrop-blur-[2px]" aria-hidden="true" />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="agenda-panel-title" onKeyDown={trapFocus} className={`${styles.drawer} relative flex h-full w-full max-w-[500px] flex-col overflow-y-auto border-l border-[#E4E9E7] bg-white shadow-[-10px_0_30px_rgba(24,32,38,.08)]`}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E4E9E7] bg-white/95 px-6 py-5 backdrop-blur">
        <div className="flex items-center gap-3">{mode === "cancel-confirm" || mode === "reschedule" ? <button type="button" onClick={() => onMode("detail")} aria-label="Volver al detalle" className="rounded-lg p-2 hover:bg-[#F8FAF9]"><ArrowLeft size={18} /></button> : null}<div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#667078]">Nuari / Agenda</p><h2 ref={titleRef} id="agenda-panel-title" tabIndex={-1} className="mt-1 text-lg font-bold tracking-tight text-[#182026]">{title}</h2></div></div>
        <button type="button" onClick={onClose} aria-label="Cerrar panel" className="rounded-lg p-2 text-[#667078] hover:bg-[#F8FAF9]"><X size={20} /></button>
      </header>

      {mode === "detail" && appointment ? <div className="flex flex-1 flex-col">
        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-[#E4E9E7] bg-[#F8FAF9] p-5"><StatusPill status={appointment.status} /><h3 className="mt-4 text-2xl font-bold text-[#182026]">{appointment.customerNameSnapshot}</h3><p className="mt-1 text-sm text-[#667078]">{appointment.serviceNameSnapshot}</p></div>
          <div className="space-y-3 rounded-2xl border border-[#E4E9E7] p-5 text-sm"><Row icon={<CalendarBlank size={17} />} label="Fecha" value={new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${localDate(appointment.startAt, setup.timeZone)}T12:00:00Z`))} /><Row icon={<Clock size={17} />} label="Horario" value={`${localTime(appointment.startAt, setup.timeZone)} – ${localTime(appointment.endAt, setup.timeZone)} · ${appointment.durationMinutes} min`} /><Row icon={<User size={17} />} label="Profesional" value={appointment.staffNameSnapshot ?? "Sin profesional"} /><Row icon={<Clock size={17} />} label="Zona horaria" value={setup.timeZone} /></div>
          {canManage && privateNotes ? <div className="rounded-xl border border-[#E4E9E7] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#667078]">Nota interna</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{privateNotes}</p></div> : null}
          {error ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{error}</p> : null}
        </div>
        {appointment.status === "CONFIRMED" ? <footer className="sticky bottom-0 mt-auto flex flex-wrap gap-2 border-t border-[#E4E9E7] bg-white p-5">
          <Button variant="outline" disabled={busy} onClick={() => onMode("cancel-confirm")} className="border-[#E4E9E7]">Cancelar</Button><Button variant="outline" disabled={busy} onClick={() => onMode("reschedule")} className="border-[#E4E9E7]">Reprogramar</Button>
          {canManage ? <><Button disabled={busy} onClick={() => void close("complete")} className="bg-[#182026] text-white">Completar</Button><Button variant="outline" disabled={busy} onClick={() => void close("no-show")} className="border-[#E4E9E7]">Ausencia</Button></> : null}
        </footer> : null}
      </div> : null}

      {mode === "cancel-confirm" && appointment ? <div className="flex flex-1 flex-col"><div className="space-y-4 p-6"><p className="text-sm leading-6 text-[#667078]">¿Cancelar la reserva de <strong>{appointment.customerNameSnapshot}</strong>? El cambio quedará registrado en el historial.</p><label className="block space-y-1.5 text-xs font-bold text-[#667078]" htmlFor="agenda-cancel-reason">Motivo<select id="agenda-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value as AppointmentCancelReason)} className={inputClass}><option value="CUSTOMER_REQUEST">A pedido del cliente</option><option value="BUSINESS_REQUEST">A pedido del negocio</option><option value="OTHER">Otro motivo</option></select></label>{error ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{error}</p> : null}</div><footer className="mt-auto flex justify-end gap-3 border-t border-[#E4E9E7] p-5"><Button variant="outline" onClick={() => onMode("detail")}>Volver</Button><Button variant="destructive" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelando…" : "Confirmar cancelación"}</Button></footer></div> : null}

      {(mode === "new" || mode === "reschedule") ? <div className="flex flex-1 flex-col">
        <div className="space-y-6 p-6">
          {mode === "new" ? <section className="space-y-3"><SectionTitle icon={<User size={17} />} title="Cliente existente" /><label className="sr-only" htmlFor="agenda-customer-search">Buscar cliente</label><input id="agenda-customer-search" value={customer?.name ?? customerQuery} onChange={(event) => { setCustomer(null); setCustomerQuery(event.target.value); }} placeholder="Buscar por nombre, teléfono o correo" className={inputClass} autoComplete="off" />{customer ? <div className="flex items-center justify-between rounded-xl bg-[#DDF6E8] px-3 py-2 text-sm"><span className="font-semibold">{customer.name}</span><button type="button" onClick={() => { setCustomer(null); setCustomerQuery(""); }} className="text-xs font-bold">Cambiar</button></div> : <div className="max-h-36 overflow-y-auto rounded-xl border border-[#E4E9E7]">{customerSearching ? <p className="p-3 text-xs text-[#667078]">Buscando clientes…</p> : customers.length ? customers.map((item) => <button key={item.id} type="button" onClick={() => { setCustomer(item); setCustomerQuery(item.name); }} className="block w-full border-b border-[#F0F2F1] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#F8FAF9]"><span className="block font-semibold">{item.name}</span><span className="text-xs text-[#667078]">{item.phone || item.email || "Sin contacto registrado"}</span></button>) : <p className="p-3 text-xs text-[#667078]">No hay clientes coincidentes.</p>}</div>}</section> : <p className="text-sm text-[#667078]">Nuevo horario para {appointment?.customerNameSnapshot}.</p>}
          <section className="space-y-3"><SectionTitle icon={<CalendarBlank size={17} />} title="Servicio y profesional" />
            {mode === "new" ? <><label className="sr-only" htmlFor="agenda-service">Servicio</label><select id="agenda-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setStaffId(""); }} className={inputClass}><option value="">Elegir servicio</option>{setup.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min</option>)}</select></> : <div className="rounded-xl bg-[#F8FAF9] p-3 text-sm font-semibold">{appointment?.serviceNameSnapshot} · {appointment?.durationMinutes} min</div>}
            {service && service.staffSelectionMode !== "NO_ASSIGNMENT" ? <><label className="sr-only" htmlFor="agenda-staff">Profesional</label><select id="agenda-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)} className={inputClass}><option value="">Cualquiera disponible</option>{eligibleStaff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></> : service?.staffSelectionMode === "NO_ASSIGNMENT" ? <p className="rounded-xl bg-[#F8FAF9] p-3 text-sm text-[#667078]">Este servicio se reserva sin profesional asignado.</p> : null}
          </section>
          <section className="space-y-3"><SectionTitle icon={<Clock size={17} />} title="Fecha y horario" /><label className="sr-only" htmlFor="agenda-slot-date">Fecha</label><input id="agenda-slot-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
            {!service ? <p className="text-xs text-[#667078]">Elegí un servicio para consultar disponibilidad.</p> : slotLoading ? <p role="status" className="text-sm text-[#667078]">Consultando horarios disponibles…</p> : visibleSlots.length ? <div role="radiogroup" aria-label="Horarios disponibles" className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">{visibleSlots.map((slot) => { const label = `${slot.localTime}${localTimeCounts.get(slot.localTime)! > 1 ? ` · UTC${slot.offset}` : ""}`; return <button key={slot.startAt} type="button" role="radio" aria-label={label} aria-checked={selectedStart === slot.startAt} onClick={() => setSelectedSlot({ key: slotKey, startAt: slot.startAt })} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${selectedStart === slot.startAt ? "border-[#182026] bg-[#182026] text-white" : "border-[#E4E9E7] bg-white hover:border-[#9CA9A5]"}`}>{label}</button>; })}</div> : <p className="rounded-xl bg-[#FFF1E2] p-3 text-sm text-[#715331]">No hay disponibilidad para esta fecha. Probá otro día o profesional.</p>}
            {mode === "reschedule" && appointment ? <p className="text-xs text-[#667078]">Zona horaria del negocio: {setup.timeZone}. Los horarios corresponden a la disponibilidad vigente.</p> : null}
          </section>
          {canManage ? <section className="space-y-2"><label htmlFor="agenda-internal-notes" className="text-xs font-bold text-[#667078]">Nota interna (opcional)</label><textarea id="agenda-internal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClass} /></section> : null}
          {error ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{error}</p> : null}
        </div>
        <footer className="sticky bottom-0 mt-auto flex justify-end gap-3 border-t border-[#E4E9E7] bg-white p-5"><Button variant="outline" onClick={onClose}>Cerrar</Button><Button disabled={busy || slotLoading || !selectedStart || (mode === "new" && !customer)} onClick={() => void submit()} className="bg-[#182026] text-white">{busy ? "Guardando…" : mode === "new" ? "Confirmar reserva" : "Guardar cambio"}</Button></footer>
      </div> : null}
    </section>
  </div>;
}

function StatusPill({ status }: { status: AppointmentDTO["status"] }) {
  const labels: Record<AppointmentDTO["status"], string> = { CONFIRMED: "Confirmada", COMPLETED: "Completada", CANCELLED: "Cancelada", NO_SHOW: "Ausencia" };
  const tones: Record<AppointmentDTO["status"], string> = { CONFIRMED: "bg-[#E8F0FF] text-[#35588E]", COMPLETED: "bg-[#DDF6E8] text-[#356B4A]", CANCELLED: "bg-[#F0F2F1] text-[#667078]", NO_SHOW: "bg-[#FFE8E8] text-[#9B3F37]" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tones[status]}`}>{labels[status]}</span>;
}
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h3 className="flex items-center gap-2 text-sm font-bold text-[#182026]">{icon}{title}</h3>; }
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="text-[#667078]">{icon}</span><span className="w-20 text-xs text-[#667078]">{label}</span><span className="font-semibold text-[#182026]">{value}</span></div>; }
function localDate(instant: string, timeZone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant)); return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`; }
function localTime(instant: string, timeZone: string) { return new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant)); }
function assignmentKeyFor(serviceId: string | undefined, date: string, assignment: AppointmentAssignment | null) { return `${serviceId ?? ""}|${date}|${assignment?.kind ?? ""}|${assignment?.kind === "SPECIFIC" ? assignment.staffMemberId : ""}`; }
function errorMessage(error: unknown) {
  if (error instanceof ApiError && (error.code === "SLOT_UNAVAILABLE" || error.code === "BOOKING_CONFIGURATION_CHANGED")) return "Ese horario dejó de estar disponible. Actualizamos las opciones; elegí otra hora.";
  return error instanceof Error ? error.message : "No pudimos completar esta operación. Intentá nuevamente.";
}
const inputClass = "w-full rounded-xl border border-[#E4E9E7] bg-[#F8FAF9] px-3 py-2.5 text-sm text-[#182026] outline-none transition focus:border-[#182026] focus:bg-white focus:ring-2 focus:ring-[#182026]/10";
