"use client";

import { ArrowRight, CalendarBlank, CalendarPlus, CaretLeft, CaretRight, CheckCircle, Clock, MagicWand, User, WarningCircle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  cancelPublicBooking, getPublicBookingCatalog, getPublicBookingStaff, getPublicManagedBooking,
  getPublicRescheduleAvailability, reschedulePublicBooking,
} from "@/lib/api/browser";
import { ApiError } from "@/lib/api/errors";
import type {
  AppointmentAssignment, PublicAvailabilityDTO, PublicAvailabilityQuery, PublicBookingCatalogDTO,
  PublicManagedBookingDTO,
} from "@/lib/api/contracts";
import { addLocalDays, businessToday, localDateLabel, localInstantLabel, slotTimeLabel } from "./public-booking-date";
import { addCalendarMonths, calendarGridDates, calendarMonth } from "./public-booking-management-calendar";
import styles from "./public-booking-management.module.css";

type ViewState = "loading" | "invalid" | "error" | "ready" | "success";
type SuccessKind = "cancelled" | "rescheduled";
type Slot = PublicAvailabilityDTO["slots"][number];
type ProfessionalSelection = "ANY" | string;

const tokenPattern = /^[A-Za-z0-9_-]{40,100}$/;

function dateInTimeZone(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getInitialProfessionalChoice(booking: PublicManagedBookingDTO): ProfessionalSelection {
  return booking.staffSelectionMode === "CUSTOMER_CHOICE" && booking.assignment.kind === "SPECIFIC"
    ? booking.assignment.staffMemberId : "ANY";
}

function getAssignment(booking: PublicManagedBookingDTO, professional: ProfessionalSelection): AppointmentAssignment {
  if (booking.staffSelectionMode === "NO_ASSIGNMENT") return { kind: "NONE" };
  if (booking.staffSelectionMode === "AUTO_ASSIGN") return { kind: "ANY" };
  return professional === "ANY" ? { kind: "ANY" } : { kind: "SPECIFIC", staffMemberId: professional };
}

function assignmentUnchanged(booking: PublicManagedBookingDTO, assignment: AppointmentAssignment): boolean {
  if (booking.assignment.kind !== assignment.kind) return false;
  return assignment.kind !== "SPECIFIC" || (booking.assignment.kind === "SPECIFIC" && assignment.staffMemberId === booking.assignment.staffMemberId);
}

function apiMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "No pudimos conectar con Nuari. Revisá tu conexión e intentá nuevamente.";
  if (error.code === "MANAGEMENT_LINK_NOT_AVAILABLE") return "El enlace de gestión no está disponible o venció.";
  if (error.code === "BOOKING_NOT_AVAILABLE") return "La reprogramación no está disponible en este momento.";
  if (error.code === "SLOT_UNAVAILABLE") return "Ese horario dejó de estar disponible. Actualizamos los horarios; elegí otro.";
  if (error.code === "BOOKING_CONFIGURATION_CHANGED") return "La disponibilidad cambió. Volvé a consultar antes de elegir un horario.";
  if (error.code === "VERSION_CONFLICT") return "La reserva cambió desde que abriste este enlace. Actualizamos sus datos.";
  if (error.code === "INVALID_APPOINTMENT_TRANSITION") return "La reserva ya no admite esta operación según sus políticas vigentes.";
  if (error.code === "RATE_LIMITED") return "Se realizaron varios intentos. Esperá un momento antes de volver a probar.";
  if (error.status === 0) return "No pudimos verificar el resultado. Volvé a consultar la reserva antes de reintentar.";
  return error.message;
}

export function PublicBookingManagementScreen({ slug }: { slug: string }) {
  const [view, setView] = useState<ViewState>("loading");
  const [booking, setBooking] = useState<PublicManagedBookingDTO | null>(null);
  const [catalog, setCatalog] = useState<PublicBookingCatalogDTO | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [token, setToken] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [modal, setModal] = useState<"cancel" | "reschedule" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successKind, setSuccessKind] = useState<SuccessKind | null>(null);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);
  const [professionalsLoading, setProfessionalsLoading] = useState(false);
  const [professionalsError, setProfessionalsError] = useState<string | null>(null);
  const [professionalsRetry, setProfessionalsRetry] = useState(0);
  const [professional, setProfessional] = useState<ProfessionalSelection>("ANY");
  const [calendarVisible, setCalendarVisible] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resolveController = useRef<AbortController | null>(null);
  const bookingToday = catalog ? businessToday(catalog.timeZone) : booking ? businessToday(booking.timeZone) : "";
  const horizon = catalog && bookingToday ? addLocalDays(bookingToday, catalog.policy.maxAdvanceDays) : "";
  const visibleMonth = calendarVisible || (bookingToday ? calendarMonth(bookingToday) : "");
  const gridDates = useMemo(() => visibleMonth ? calendarGridDates(visibleMonth) : [], [visibleMonth]);
  const selectedAssignment = booking ? getAssignment(booking, professional) : null;
  const selectedDateSlots = selectedDate ? slotsByDate[selectedDate] ?? [] : [];
  const assignmentSame = booking && selectedAssignment ? assignmentUnchanged(booking, selectedAssignment) : true;
  const unchangedSelection = !!booking && !!selectedSlot && selectedSlot.startAt === booking.startAt && assignmentSame;

  const resolveToken = useCallback(async (value: string, signal?: AbortSignal) => {
    const resolved = await getPublicManagedBooking(slug, value, signal);
    setBooking(resolved);
    setProfessional(getInitialProfessionalChoice(resolved));
    setCalendarVisible(calendarMonth(businessToday(resolved.timeZone)));
    setSelectedDate("");
    setSelectedSlot(null);
    setSlotsByDate({});
    setView("ready");
    setPageError(null);
    return resolved;
  }, [slug]);

  useEffect(() => {
    let rawToken = "";
    if (typeof window !== "undefined") {
      rawToken = window.location.hash.slice(1);
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    }
    if (!tokenPattern.test(rawToken)) {
      // The fragment is unavailable during SSR, so invalid-link state must be set after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("invalid");
      return;
    }
    setToken(rawToken);
    const controller = new AbortController();
    resolveController.current = controller;
    void resolveToken(rawToken, controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.code === "MANAGEMENT_LINK_NOT_AVAILABLE") setView("invalid");
      else { setPageError(apiMessage(error)); setView("error"); }
    });
    return () => { controller.abort(); resolveController.current = null; };
  }, [resolveToken]);

  useEffect(() => {
    if (!booking) return;
    const controller = new AbortController();
    // This effect owns the catalog request lifecycle and its visible loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCatalogLoading(true);
    setCatalogError(null);
    getPublicBookingCatalog(slug, controller.signal)
      .then(setCatalog)
      .catch((error: unknown) => { if (!controller.signal.aborted) setCatalogError(apiMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [booking, slug, catalogRetry]);

  useEffect(() => {
    if (!booking || !booking.actions.canReschedule || booking.staffSelectionMode !== "CUSTOMER_CHOICE") {
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    // This effect owns the staff request lifecycle and its visible loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfessionalsLoading(true);
    setProfessionalsError(null);
    void (async () => {
      try {
        const items: Array<{ id: string; name: string }> = [];
        let offset: number | null = 0;
        for (let page = 0; offset !== null && page < 200; page += 1) {
          const result = await getPublicBookingStaff(slug, booking.serviceId, offset, controller.signal);
          items.push(...result.items);
          offset = result.pageInfo.hasMore ? result.pageInfo.nextOffset : null;
        }
        if (!cancelled) setProfessionals([...new Map(items.map((person) => [person.id, person])).values()]);
      } catch (error) { if (!cancelled && !controller.signal.aborted) setProfessionalsError(apiMessage(error)); }
      finally { if (!cancelled) setProfessionalsLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [booking, slug, professionalsRetry]);

  useEffect(() => {
    if (modal !== "reschedule" || !booking || !token || !catalog || !booking.actions.canReschedule || !horizon || !visibleMonth) return;
    const controller = new AbortController();
    let cancelled = false;
    // This effect owns availability refresh state while querying the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlotsLoading(true); setSlotsError(null); setSlotsByDate({});
    void (async () => {
      try {
        const available: Record<string, Slot[]> = {};
        for (let index = 0; index < gridDates.length; index += 7) {
          const weekStart = gridDates[index]!;
          const weekEnd = addLocalDays(weekStart, 7);
          const fromDate = weekStart < bookingToday ? bookingToday : weekStart;
          const toDate = weekEnd > addLocalDays(horizon, 1) ? addLocalDays(horizon, 1) : weekEnd;
          if (fromDate >= toDate) continue;
          let cursor: string | undefined;
          for (let page = 0; page < 20; page += 1) {
            const query: PublicAvailabilityQuery = {
              serviceId: booking.serviceId,
              selection: booking.staffSelectionMode === "NO_ASSIGNMENT" ? "NONE" : booking.staffSelectionMode === "AUTO_ASSIGN" ? "ANY" : professional === "ANY" ? "ANY" : "SPECIFIC",
              ...(booking.staffSelectionMode === "CUSTOMER_CHOICE" && professional !== "ANY" ? { staffMemberId: professional } : {}),
              fromDate, toDate, ...(cursor ? { cursor } : {}),
            };
            const result = await getPublicRescheduleAvailability(slug, booking.id, token, query, booking.version, controller.signal);
            for (const slot of result.slots) (available[slot.localDate] ??= []).push(slot);
            if (!result.hasMore || !result.nextCursor) break;
            cursor = result.nextCursor;
          }
        }
        if (!cancelled) setSlotsByDate(available);
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          setSlotsError(apiMessage(error));
          if (error instanceof ApiError && ["VERSION_CONFLICT", "INVALID_APPOINTMENT_TRANSITION", "BOOKING_NOT_AVAILABLE"].includes(error.code)) {
            try {
              const latest = await getPublicManagedBooking(slug, token);
              if (!cancelled) {
                setBooking(latest);
                setProfessional(getInitialProfessionalChoice(latest));
                if (latest.status !== "CONFIRMED" || !latest.actions.canReschedule) setModal(null);
              }
            } catch { /* Keep the recoverable availability error visible. */ }
          }
        }
      } finally { if (!cancelled) setSlotsLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [modal, booking, token, catalog, horizon, bookingToday, visibleMonth, gridDates, professional, slug, availabilityRetry]);

  const openReschedule = () => {
    setActionError(null); setSlotsError(null); setSelectedDate(""); setSelectedSlot(null); setSlotsByDate({});
    setCalendarVisible(calendarMonth(bookingToday)); setModal("reschedule");
  };

  const refreshBooking = useCallback(async () => {
    if (!token) return;
    const controller = new AbortController();
    resolveController.current?.abort();
    resolveController.current = controller;
    try {
      const refreshed = await resolveToken(token, controller.signal);
      if (refreshed.status !== "CONFIRMED") { setModal(null); setActionError(null); }
      else setActionError("La reserva se actualizó. Revisá los datos y elegí nuevamente fecha y horario.");
      setAvailabilityRetry((value) => value + 1);
    } catch (error) { if (!controller.signal.aborted) setActionError(apiMessage(error)); }
  }, [resolveToken, token]);

  const chooseProfessional = (value: ProfessionalSelection) => {
    setProfessional(value); setSelectedSlot(null); setSlotsByDate({}); setSlotsError(null); setSelectedDate("");
  };

  const submitCancel = async () => {
    if (!booking || !token || actionBusy) return;
    setActionBusy(true); setActionError(null);
    try {
      await cancelPublicBooking(slug, booking.id, { token, reasonCode: "CUSTOMER_REQUEST" }, booking.version);
      setBooking((current) => current ? { ...current, status: "CANCELLED", version: current.version + 1, actions: { canCancel: false, canReschedule: false } } : current);
      setSuccessKind("cancelled"); setView("success"); setModal(null);
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError && (error.code === "VERSION_CONFLICT" || error.code === "INVALID_APPOINTMENT_TRANSITION" || error.code === "BOOKING_NOT_AVAILABLE")) await refreshBooking();
    } finally { setActionBusy(false); }
  };

  const submitReschedule = async () => {
    if (!booking || !token || !selectedSlot || !selectedAssignment || unchangedSelection || actionBusy) return;
    setActionBusy(true); setActionError(null);
    try {
      const result = await reschedulePublicBooking(slug, booking.id, { token, startAt: selectedSlot.startAt, assignment: selectedAssignment }, booking.version);
      try { await resolveToken(token); }
      catch {
        setBooking((current) => current ? {
          ...current, status: result.status, startAt: result.startAt, endAt: result.endAt, staffName: result.staffName,
          assignment: selectedAssignment, version: result.version, actions: { canCancel: false, canReschedule: false },
        } : current);
      }
      setSuccessKind("rescheduled"); setView("success"); setModal(null);
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError && error.code === "SLOT_UNAVAILABLE") {
        setSelectedSlot(null); setAvailabilityRetry((value) => value + 1);
      }
      if (error instanceof ApiError && error.code === "BOOKING_CONFIGURATION_CHANGED") {
        setSelectedSlot(null); setAvailabilityRetry((value) => value + 1); setCatalogRetry((value) => value + 1);
      }
      if (error instanceof ApiError && (error.code === "VERSION_CONFLICT" || error.code === "INVALID_APPOINTMENT_TRANSITION" || error.code === "BOOKING_NOT_AVAILABLE")) await refreshBooking();
    } finally { setActionBusy(false); }
  };

  const closeModal = () => { if (!actionBusy) { setModal(null); setActionError(null); } };

  useEffect(() => {
    if (view === "success" || view === "invalid" || view === "error") titleRef.current?.focus();
  }, [view]);

  if (view === "loading") return <PageFrame><main className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12"><div className="flex w-full flex-col items-center rounded-[2rem] border border-[#E4E9E7] bg-white p-10 text-center shadow-[0_20px_40px_-10px_rgba(24,32,38,.08)]"><span className="mb-5 h-14 w-14 animate-spin rounded-full border-4 border-[#F8FAF9] border-t-[#A997E8]" /><p role="status" className="text-sm font-semibold text-[#667078]">Cargando información…</p></div></main></PageFrame>;
  if (view === "invalid" || view === "error") return <PageFrame><main className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12"><section className="w-full rounded-[2rem] border border-[#E4E9E7] bg-white p-8 text-center shadow-[0_20px_40px_-10px_rgba(24,32,38,.08)] sm:p-10"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E4E9E7] bg-[#F8FAF9] text-[#667078]"><WarningCircle size={32} /></div><h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold tracking-tight">{view === "invalid" ? "Enlace no válido" : "No pudimos cargar la reserva"}</h1><p role={view === "error" ? "alert" : undefined} className="mb-8 mt-2 text-sm leading-6 text-[#667078]">{view === "invalid" ? "No pudimos encontrar la reserva o el enlace venció." : pageError}</p>{view === "error" ? <button type="button" onClick={() => window.location.reload()} className={secondaryButton}>Reintentar</button> : null}</section></main></PageFrame>;
  if (!booking) return null;

  const currentDate = dateInTimeZone(booking.startAt, booking.timeZone);
  const currentClock = localInstantLabel(booking.startAt, booking.timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const currentMonthText = localDateLabel(currentDate, { month: "short" }).toUpperCase().replace(".", "");
  const businessName = catalog?.organization.name ?? slug.replace(/[-_]+/g, " ");
  const initials = businessName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
  const statusDetails = getStatusDetails(booking.status);
  const selectionChanged = !!selectedAssignment && !assignmentSame;
  const canConfirmReschedule = !!selectedSlot && !unchangedSelection && !actionBusy;
  const selectedNewProfessional = selectedAssignment?.kind === "SPECIFIC" ? professionals.find((person) => person.id === selectedAssignment.staffMemberId)?.name ?? "Profesional seleccionado" : selectedAssignment?.kind === "ANY" ? booking.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "Cualquier profesional" : "Sin profesional";
  const originalDateLabel = localInstantLabel(booking.startAt, booking.timeZone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return <PageFrame>
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8 sm:py-10">
      <header className="mb-8 flex items-center justify-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#182026] text-lg font-bold text-white shadow-sm">{initials}</div><h1 className="text-xl font-bold tracking-tight">{businessName}</h1></header>
      {view === "success" ? <section className={`${styles.success} flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-[#E4E9E7] bg-white p-8 text-center shadow-[0_20px_40px_-10px_rgba(24,32,38,.08)] sm:p-10`}>
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-[#E4E9E7] bg-[#F8FAF9] shadow-sm"><span className="absolute inset-0 rounded-[1.5rem] bg-[#DDF6E8]/60 blur-xl" /><CheckCircle size={42} weight="fill" className="relative z-10 text-[#438C78]" /></div>
        <h2 ref={titleRef} tabIndex={-1} className="mb-2 text-2xl font-bold tracking-tight">{successKind === "cancelled" ? "Reserva cancelada" : "Reserva actualizada"}</h2>
        <p className="mb-8 text-sm leading-6 text-[#667078]">{successKind === "cancelled" ? "El horario quedó liberado. Si necesitás un nuevo turno, podés solicitarlo al negocio." : "El turno se reprogramó correctamente."}</p>
        <button type="button" onClick={() => { setSuccessKind(null); setView("ready"); }} className={primaryButton}>Ver reserva</button>
      </section> : <section className={`${styles.enter} overflow-hidden rounded-[2rem] border border-[#E4E9E7] bg-white shadow-[0_20px_40px_-10px_rgba(24,32,38,.08)]`} aria-labelledby="managed-booking-heading">
        <div className="relative overflow-hidden border-b border-[#E4E9E7]/70 bg-[#F8FAF9]/70 px-6 py-6 sm:px-8 sm:py-8">
          {booking.status === "CONFIRMED" ? <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#7EA8F8] opacity-30 blur-[40px]" /> : null}
          <div className="relative z-10"><span className={`mb-4 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusDetails.className}`}><i className={`h-1.5 w-1.5 rounded-full ${statusDetails.dotClass}`} />{statusDetails.label}</span><h2 id="managed-booking-heading" className="text-2xl font-bold leading-tight">{booking.serviceName}</h2><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[#667078]"><User size={16} />Detalle de tu reserva</p></div>
        </div>
        <div className="flex items-start gap-5 px-6 py-6 sm:px-8 sm:py-8"><div className="flex h-14 w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-[#E4E9E7] bg-white shadow-sm"><span className="w-full bg-[#182026] py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">{currentMonthText}</span><span className="flex flex-1 items-center text-lg font-bold">{currentDate.slice(-2)}</span></div><div><p className="mb-0.5 text-2xl font-bold tracking-tight">{currentClock} hs</p><p className="text-sm font-medium capitalize text-[#667078]">{localInstantLabel(booking.startAt, booking.timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div></div>
        <div className="space-y-4 px-6 pb-6 sm:px-8 sm:pb-8">
          <DetailRow icon={<Clock size={18} />} label="Duración estimada" value={`${booking.durationMinutes} minutos`} />
          {booking.assignment.kind !== "NONE" ? <DetailRow icon={<User size={18} />} label={booking.staffName ? "Con profesional" : "Profesional"} value={booking.staffName ?? (booking.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "A elección")} /> : <DetailRow icon={<User size={18} />} label="Profesional" value="Sin profesional" />}
          <DetailRow icon={<CalendarBlank size={18} />} label="Zona horaria" value={booking.timeZone} />
        </div>
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {actionError && !modal ? <p role="alert" className="mb-4 rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{actionError}</p> : null}
          {booking.status === "CONFIRMED" && (booking.actions.canReschedule || booking.actions.canCancel) ? <div className="flex flex-col gap-3">
            {booking.actions.canReschedule ? <button type="button" onClick={openReschedule} className={primaryButton}><CalendarBlank size={18} />Reprogramar reserva</button> : null}
            {booking.actions.canCancel ? <button type="button" onClick={() => { setActionError(null); setModal("cancel"); }} className={cancelButton}><WarningCircle size={18} />Cancelar reserva</button> : null}
          </div> : <p className="rounded-lg border border-[#E4E9E7] bg-[#F8FAF9] p-3 text-center text-xs font-medium text-[#667078]">{booking.status === "CONFIRMED" ? "Las políticas vigentes no permiten realizar cambios desde este enlace." : "Esta reserva ya no admite cambios."}</p>}
          {catalogError && booking.actions.canReschedule ? <p className="mt-3 text-center text-xs text-[#9B3F37]">No pudimos cargar la política de disponibilidad. <button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className="font-bold underline">Reintentar</button></p> : null}
        </div>
      </section>}
      <footer className="mt-auto pt-10 pb-2 text-center text-[10px] font-medium text-[#667078]">Gestionado con <span className="text-xs font-bold text-[#182026]">nuari</span></footer>
    </main>

    {modal === "cancel" ? <Dialog title="¿Cancelar tu reserva?" onClose={closeModal} labelledBy="cancel-dialog-title" className="max-w-sm">
      <div className="p-6 pb-2"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 shadow-sm"><WarningCircle size={26} /></div><h2 id="cancel-dialog-title" className="mb-2 text-xl font-bold">¿Cancelar tu reserva?</h2><p className="mb-4 text-sm text-[#667078]">Estás por cancelar el turno para <strong className="font-semibold text-[#182026]">{booking.serviceName}</strong>.</p><p className="rounded-lg border border-[#E4E9E7] bg-[#F8FAF9] p-3 text-xs font-medium text-[#667078]">Si cancelás, dejarás libre este espacio. Si necesitás un nuevo turno deberás solicitarlo nuevamente.</p>{actionError ? <p role="alert" className="mt-4 rounded-lg border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{actionError}</p> : null}</div>
      <div className="flex flex-col gap-3 p-6 pt-4"><button type="button" data-dialog-initial-focus onClick={() => void submitCancel()} disabled={actionBusy} className={dangerButton}>{actionBusy ? <Spinner /> : null}<span>{actionBusy ? "Cancelando…" : "Sí, cancelar reserva"}</span></button><button type="button" onClick={closeModal} disabled={actionBusy} className={secondaryButton}>Mantener turno</button></div>
    </Dialog> : null}

    {modal === "reschedule" ? <Dialog title="Reprogramar reserva" onClose={closeModal} labelledBy="reschedule-dialog-title" className="max-w-4xl">
      <div className="flex items-center justify-between border-b border-[#E4E9E7] bg-[#F8FAF9]/70 px-6 py-4"><h2 id="reschedule-dialog-title" className="flex items-center gap-2 text-lg font-bold"><CalendarPlus size={21} className="text-[#A997E8]" />Reprogramar reserva</h2><button type="button" data-dialog-initial-focus onClick={closeModal} aria-label="Cerrar diálogo" disabled={actionBusy} className="rounded-xl p-2 text-[#667078] transition hover:bg-[#F8FAF9] hover:text-[#182026]"><X size={20} /></button></div>
      {catalogError || !catalog ? <div className="p-6">{catalogLoading && !catalogError ? <p role="status" className="text-sm text-[#667078]">Cargando las políticas de disponibilidad…</p> : null}{catalogError ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{catalogError}</p> : null}<button type="button" onClick={() => setCatalogRetry((value) => value + 1)} className={`${secondaryButton} mt-4`}>Reintentar</button></div> : <>
        {actionError || slotsError || professionalsError ? <div className="px-6 pt-4"><p role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"><WarningCircle size={18} className="mt-0.5 shrink-0 text-red-500" />{actionError ?? slotsError ?? professionalsError}</p></div> : null}
        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {booking.staffSelectionMode === "CUSTOMER_CHOICE" ? <fieldset className="w-full"><legend className="mb-4 font-bold">Profesional</legend><div role="radiogroup" aria-label="Profesional" onKeyDown={moveRadioWithArrows} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ProfessionalOption selected={professional === "ANY"} onClick={() => chooseProfessional("ANY")} name="Cualquier especialista" description="Ver horarios de todo el equipo." icon={<MagicWand size={19} />} current={booking.assignment.kind === "ANY"} />
            {professionals.map((person) => <ProfessionalOption key={person.id} selected={professional === person.id} onClick={() => chooseProfessional(person.id)} name={person.name} current={booking.assignment.kind === "SPECIFIC" && booking.assignment.staffMemberId === person.id} />)}
          </div>{professionalsLoading ? <p role="status" className="mt-3 text-sm text-[#667078]">Cargando profesionales…</p> : null}{professionalsError ? <div className="mt-3"><p role="alert" className="text-sm text-[#9B3F37]">{professionalsError}</p><button type="button" onClick={() => setProfessionalsRetry((value) => value + 1)} className="mt-2 text-sm font-bold underline">Reintentar carga</button></div> : null}{!professionalsLoading && !professionalsError && professionals.length === 0 ? <p className="mt-3 text-sm text-[#667078]">No hay profesionales habilitados para este servicio.</p> : null}</fieldset>
            : <section aria-label="Profesional asignado"><h3 className="mb-4 font-bold">Profesional</h3><div className="flex items-center gap-3 rounded-xl border border-[#E4E9E7] bg-[#F8FAF9] p-4">{booking.staffSelectionMode === "AUTO_ASSIGN" ? <MagicWand size={20} className="text-[#A997E8]" /> : <User size={20} className="text-[#667078]" />}<div><p className="text-sm font-bold">{booking.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "Sin profesional"}</p><p className="mt-0.5 text-xs text-[#667078]">{booking.staffSelectionMode === "AUTO_ASSIGN" ? "El negocio asignará un profesional disponible para el nuevo horario." : "Este servicio no requiere profesional."}</p></div></div></section>}

          <div className="flex flex-col gap-8 md:flex-row">
            <section className="min-w-0 flex-1" aria-label="Calendario mensual"><h3 className="mb-4 font-bold">Nueva fecha</h3><div className="rounded-2xl border border-[#E4E9E7] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><button type="button" aria-label="Mes anterior" onClick={() => setCalendarVisible(addCalendarMonths(visibleMonth, -1))} disabled={visibleMonth <= calendarMonth(bookingToday)} className={calendarNavButton}><CaretLeft size={17} /></button><h4 aria-live="polite" className="font-bold capitalize">{localDateLabel(visibleMonth, { month: "long", year: "numeric" })}</h4><button type="button" aria-label="Mes siguiente" onClick={() => setCalendarVisible(addCalendarMonths(visibleMonth, 1))} disabled={addCalendarMonths(visibleMonth, 1) > calendarMonth(horizon)} className={calendarNavButton}><CaretRight size={17} /></button></div>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#667078]"><span>Do</span><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sa</span></div>
              <div role="group" aria-label="Días con disponibilidad" className="grid grid-cols-7 gap-1">{gridDates.map((date) => {
                const outsideMonth = calendarMonth(date) !== visibleMonth;
                const hasSlots = (slotsByDate[date]?.length ?? 0) > 0;
                const inRange = date >= bookingToday && date <= horizon;
                const disabled = !inRange || slotsLoading || !hasSlots || !booking.actions.canReschedule;
                return <button key={date} type="button" aria-label={`Elegir ${localDateLabel(date)}`} aria-pressed={selectedDate === date} disabled={disabled} onClick={() => { setSelectedDate(date); setSelectedSlot(null); setActionError(null); if (outsideMonth) setCalendarVisible(calendarMonth(date)); }} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 border-transparent text-sm font-semibold transition hover:border-[#E4E9E7] hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-30 ${outsideMonth ? "text-[#A0AAA8]" : "text-[#182026]"} ${selectedDate === date ? "border-[#182026] bg-[#182026] text-white shadow-[0_4px_14px_rgba(24,32,38,.15)] hover:bg-[#182026]" : date === bookingToday ? "border-[#7EA8F8] text-blue-600" : ""}`}>{Number(date.slice(-2))}{hasSlots ? <span aria-label="Con horarios" className={`absolute bottom-1 h-1 w-1 rounded-full ${selectedDate === date ? "bg-[#7ED6A5]" : "bg-[#438C78]"}`} /> : null}</button>;
              })}</div>
            </div><p className="mt-3 text-xs text-[#667078]">Fechas y horarios según la zona del negocio: {catalog.timeZone}.</p></section>

            <section className="flex w-full flex-col md:w-[280px]" aria-label="Horarios disponibles"><h3 className="mb-4 font-bold">Horarios disponibles</h3><div role="radiogroup" aria-label="Horarios disponibles" onKeyDown={moveRadioWithArrows} aria-live="polite" className="grid min-h-[150px] grid-cols-3 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {slotsLoading ? <p role="status" className="col-span-full rounded-xl border border-dashed border-[#E4E9E7] bg-[#F8FAF9] px-4 py-6 text-center text-sm text-[#667078]">Consultando disponibilidad…</p>
                : slotsError ? <p className="col-span-full rounded-xl border border-dashed border-[#F4C8C4] bg-[#FFF1F0] px-4 py-6 text-center text-sm text-[#9B3F37]">No se pudieron cargar los horarios.</p>
                  : !selectedDate ? <p className="col-span-full rounded-xl border border-dashed border-[#E4E9E7] bg-[#F8FAF9] px-4 py-6 text-center text-sm text-[#667078]">Seleccioná una fecha.</p>
                    : selectedDateSlots.length ? selectedDateSlots.map((slot) => <button key={`${slot.startAt}:${slot.offset}`} type="button" role="radio" aria-checked={selectedSlot?.startAt === slot.startAt} aria-label={slotTimeLabel(slot, selectedDateSlots)} onClick={() => { setSelectedSlot(slot); setActionError(null); }} className={`rounded-xl border-2 px-2 py-3 text-sm font-bold transition hover:border-[#182026] ${selectedSlot?.startAt === slot.startAt ? "scale-[1.02] border-[#7ED6A5] bg-[#DDF6E8] text-green-800 shadow-sm" : "border-[#E4E9E7] bg-white text-[#182026]"}`}>{slotTimeLabel(slot, selectedDateSlots)}</button>)
                      : <div className="col-span-full rounded-xl border border-dashed border-[#E4E9E7] bg-[#F8FAF9] px-4 py-6 text-center text-sm text-[#667078]">{selectedDate ? "No hay horarios disponibles para esta fecha." : "Seleccioná una fecha."}</div>}
            </div>{slotsError ? <button type="button" onClick={() => setAvailabilityRetry((value) => value + 1)} className="mt-3 text-sm font-bold underline">Actualizar disponibilidad</button> : null}</section>
          </div>
        </div>
        <div className="shrink-0 border-t border-[#E4E9E7] bg-[#F8FAF9]/70 p-5 sm:p-6">
          {selectedSlot ? <div className="mb-5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E4E9E7] bg-white p-3 text-sm shadow-sm"><span className="truncate text-[#667078] line-through">{originalDateLabel}</span><ArrowRight size={17} /><span className="rounded bg-[#DDF6E8] px-2 py-1 font-bold text-[#438C78]">{localInstantLabel(selectedSlot.startAt, catalog.timeZone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} · UTC{selectedSlot.offset}</span></div>
            {selectionChanged ? <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E4E9E7] bg-white p-3 text-sm shadow-sm"><span className="text-[#667078] line-through">{booking.staffName ?? "Asignación actual"}</span><ArrowRight size={17} /><span className="truncate font-bold">{selectedNewProfessional}</span></div> : null}
          </div> : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={closeModal} disabled={actionBusy} className={`${secondaryButton} sm:w-auto`}>Mantener turno actual</button><button type="button" onClick={() => void submitReschedule()} disabled={!canConfirmReschedule} className={`${primaryButton} sm:w-auto`}>{actionBusy ? <Spinner /> : null}<span>{actionBusy ? "Reprogramando…" : "Confirmar reprogramación"}</span></button></div>
        </div>
      </>}
    </Dialog> : null}
  </PageFrame>;
}

function Dialog({ title, labelledBy, onClose, className, children }: { title: string; labelledBy: string; onClose: () => void; className: string; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    return () => previous?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0]!; const last = focusables[focusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className={`${styles.modalOverlay} fixed inset-0 z-50 flex items-end justify-center bg-[#182026]/40 backdrop-blur-sm sm:items-center sm:p-4`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={title} tabIndex={-1} onKeyDown={onKeyDown} className={`${styles.dialogSheet} relative flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-[#E4E9E7] bg-white shadow-[0_20px_40px_-10px_rgba(24,32,38,.18)] sm:max-h-[90vh] sm:rounded-[1.5rem] ${className}`}>
      {children}
    </div>
  </div>;
}

function ProfessionalOption({ selected, onClick, name, description, icon, current = false }: { selected: boolean; onClick: () => void; name: string; description?: string; icon?: ReactNode; current?: boolean }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`group relative flex min-h-[68px] items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-[#667078]/40 ${selected ? "border-[#182026] shadow-[0_4px_14px_-2px_rgba(24,32,38,.08)]" : "border-[#E4E9E7]"}`}>
    {icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0ECFF] text-[#A997E8]">{icon}</span> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4E9E7] bg-[#F8FAF9] text-xs font-bold text-[#667078]">{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
    <span className="min-w-0 flex-1"><span className="flex items-center gap-1 truncate text-sm font-bold">{name}{current ? <span className="rounded bg-[#F8FAF9] px-1.5 py-0.5 text-[10px] font-semibold text-[#667078]">Actual</span> : null}</span>{description ? <span className="mt-0.5 block text-xs text-[#667078]">{description}</span> : null}</span><CheckCircle size={18} weight="fill" className={`shrink-0 text-[#438C78] transition ${selected ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} />
  </button>;
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4E9E7] bg-[#F8FAF9] text-[#667078]">{icon}</span><div><p className="text-xs font-medium text-[#667078]">{label}</p><p className="text-sm font-semibold text-[#182026]">{value}</p></div></div>; }
function PageFrame({ children }: { children: ReactNode }) { return <div className={`${styles.page} relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAF9] text-[#182026] antialiased selection:bg-[#DDF6E8]`}>{children}<div aria-hidden="true" className={`${styles.mesh} pointer-events-none fixed inset-0 -z-0 overflow-hidden`}><span className={`${styles.blob} ${styles.blobBlue}`} /><span className={`${styles.blob} ${styles.blobMint}`} /></div></div>; }
function Spinner() { return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />; }
function moveRadioWithArrows(event: KeyboardEvent<HTMLDivElement>) {
  if (!(event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft")) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
  const current = radios.indexOf(event.target as HTMLButtonElement);
  if (!radios.length || current < 0) return;
  event.preventDefault();
  const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
  const next = radios[(current + delta + radios.length) % radios.length];
  next?.focus(); next?.click();
}
function getStatusDetails(status: PublicManagedBookingDTO["status"]) {
  if (status === "CONFIRMED") return { label: "Confirmada", className: "border-[#7EA8F8]/30 bg-[#E8F0FF] text-blue-800", dotClass: "bg-[#7EA8F8]" };
  if (status === "COMPLETED") return { label: "Completada", className: "border-[#7ED6A5]/40 bg-[#DDF6E8] text-green-800", dotClass: "bg-[#438C78]" };
  if (status === "CANCELLED") return { label: "Cancelada", className: "border-[#E4E9E7] bg-[#F8FAF9] text-[#667078]", dotClass: "bg-[#A0AAA8]" };
  return { label: "Ausente", className: "border-[#E4E9E7] bg-[#F8FAF9] text-[#667078]", dotClass: "bg-[#A0AAA8]" };
}

const primaryButton = "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#182026] px-4 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(24,32,38,.15)] transition hover:-translate-y-0.5 hover:bg-[#2A3742] hover:shadow-[0_6px_20px_rgba(24,32,38,.2)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0";
const secondaryButton = "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm font-semibold text-[#182026] shadow-sm transition hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-50";
const cancelButton = "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-100 hover:bg-red-50";
const dangerButton = "relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,.2)] transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const calendarNavButton = "flex h-8 w-8 items-center justify-center rounded-lg text-[#182026] transition hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-30";
