"use client";

import { ArrowLeft, ArrowRight, CalendarBlank, CaretLeft, CaretRight, CheckCircle, Clock, LockKey, Receipt, User } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import {
  createPublicBooking, getPublicAvailability, getPublicBookingCatalog, getPublicBookingStaff,
} from "@/lib/api/browser";
import { ApiError } from "@/lib/api/errors";
import type {
  AppointmentAssignment, PublicAvailabilityDTO, PublicAvailabilityQuery, PublicBookingCatalogDTO,
  PublicBookingCreateInput, PublicBookingReceiptDTO, PublicBookingServiceDTO,
} from "@/lib/api/contracts";
import { addLocalDays, businessToday, localDateLabel, localInstantLabel, localWeekStart, slotTimeLabel } from "./public-booking-date";
import styles from "./public-booking.module.css";

type Step = "service" | "staff" | "schedule" | "customer";
type StaffChoice = { kind: "ANY" } | { kind: "SPECIFIC"; staffMemberId: string };
type SelectedSlot = PublicAvailabilityDTO["slots"][number];
type PublicReceipt = Omit<PublicBookingReceiptDTO, "managementToken"> & { offset: string; managementHref: string };

const stepTitle: Record<Step, string> = { service: "¿Qué necesitas hoy?", staff: "Elegí un especialista", schedule: "Fecha y horario", customer: "Casi listo" };

export function PublicBookingScreen({ slug }: { slug: string }) {
  const [catalog, setCatalog] = useState<PublicBookingCatalogDTO | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [choice, setChoice] = useState<StaffChoice | null>(null);
  const [today, setToday] = useState("");
  const [weekShift, setWeekShift] = useState(0);
  const [selectedDateOverride, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SelectedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsRetry, setSlotsRetry] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const submissionRef = useRef<{ signature: string; key: string } | null>(null);
  const service = catalog?.services.find((item) => item.id === serviceId) ?? null;
  const horizonEnd = useMemo(() => catalog && today ? addLocalDays(today, catalog.policy.maxAdvanceDays) : "", [catalog, today]);
  const weekAnchor = useMemo(() => today ? addLocalDays(localWeekStart(today), weekShift * 7) : "", [today, weekShift]);
  const selectedDate = selectedDateOverride || today;
  const weekDates = useMemo(() => weekAnchor ? Array.from({ length: 7 }, (_, index) => addLocalDays(weekAnchor, index)) : [], [weekAnchor]);
  const visibleSlots = slots.filter((slot) => slot.localDate === selectedDate);
  const stepList = service?.staffSelectionMode === "CUSTOMER_CHOICE" ? ["service", "staff", "schedule", "customer"] as const : ["service", "schedule", "customer"] as const;
  const currentStepIndex = stepList.indexOf(step as never);
  const assignment: AppointmentAssignment | null = service?.staffSelectionMode === "AUTO_ASSIGN"
    ? { kind: "ANY" }
    : service?.staffSelectionMode === "NO_ASSIGNMENT" ? { kind: "NONE" }
      : choice?.kind === "SPECIFIC" ? { kind: "SPECIFIC", staffMemberId: choice.staffMemberId }
        : choice?.kind === "ANY" ? { kind: "ANY" } : null;
  const assignmentKind = assignment?.kind;
  const assignmentStaffId = assignment?.kind === "SPECIFIC" ? assignment.staffMemberId : undefined;
  const staffChoices: StaffChoice[] = [{ kind: "ANY" }, ...staff.map((person) => ({ kind: "SPECIFIC" as const, staffMemberId: person.id }))];

  useEffect(() => {
    const controller = new AbortController();
    getPublicBookingCatalog(slug, controller.signal)
      .then((data) => { setCatalog(data); setToday(businessToday(data.timeZone)); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setCatalogError(publicErrorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [slug, catalogRetry]);

  useEffect(() => {
    if (step !== "service" && step !== "customer") titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!service || service.staffSelectionMode !== "CUSTOMER_CHOICE") return;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const people = [...(service.staff ?? [])];
        let offset = service.staffPage?.nextOffset ?? null;
        for (let page = 0; offset !== null && page < 200; page += 1) {
          const result = await getPublicBookingStaff(slug, service.id, offset, controller.signal);
          people.push(...result.items); offset = result.pageInfo.hasMore ? result.pageInfo.nextOffset : null;
        }
        if (!cancelled) setStaff([...new Map(people.map((person) => [person.id, person])).values()]);
      } catch (error) { if (!controller.signal.aborted && !cancelled) setStaffError(publicErrorMessage(error)); }
      finally { if (!cancelled) setStaffLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [service, slug]);

  useEffect(() => {
    if (!service || !assignmentKind || !catalog || !weekDates.length || !today || !horizonEnd) return;
    const firstDate = weekDates.find((date) => date >= today && date <= horizonEnd);
    const exclusiveWeekEnd = addLocalDays(weekDates[0]!, 7);
    const toDate = exclusiveWeekEnd <= addLocalDays(horizonEnd, 1) ? exclusiveWeekEnd : addLocalDays(horizonEnd, 1);
    if (!firstDate || firstDate >= toDate) return;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const found: SelectedSlot[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < 40; page += 1) {
          const query: PublicAvailabilityQuery = {
            serviceId: service.id, selection: assignmentKind!,
            ...(assignmentKind === "SPECIFIC" && assignmentStaffId ? { staffMemberId: assignmentStaffId } : {}),
            fromDate: firstDate, toDate, ...(cursor ? { cursor } : {}),
          };
          const result = await getPublicAvailability(slug, query, controller.signal);
          found.push(...result.slots);
          if (!result.hasMore || !result.nextCursor) break;
          cursor = result.nextCursor;
        }
        if (!cancelled) setSlots(found);
      } catch (error) { if (!controller.signal.aborted && !cancelled) setSlotsError(publicErrorMessage(error)); }
      finally { if (!cancelled) setSlotsLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [service, assignmentKind, assignmentStaffId, catalog, slug, weekDates, today, horizonEnd, slotsRetry]);

  const selectService = useCallback((selected: PublicBookingServiceDTO) => {
    setServiceId(selected.id); setStaff(selected.staff ?? []); setStaffLoading(selected.staffSelectionMode === "CUSTOMER_CHOICE"); setStaffError(null); setSlots([]); setSlotsLoading(true); setSlotsError(null); setSelectedSlot(null); setChoice(null); setSelectedDate(today); setFormError(null);
    setStep(selected.staffSelectionMode === "CUSTOMER_CHOICE" ? "staff" : "schedule");
  }, [today]);

  const chooseStaff = (next: StaffChoice) => {
    setChoice(next); setSlots([]); setSlotsLoading(true); setSlotsError(null); setSelectedSlot(null); setFormError(null); setStep("schedule");
  };

  function moveWeek(amount: number) {
    if (!weekAnchor) return;
    const nextShift = weekShift + amount;
    const next = addLocalDays(localWeekStart(today), nextShift * 7);
    const end = addLocalDays(next, 6);
    if (end < today || next > horizonEnd) return;
    setWeekShift(nextShift);
    setSelectedDate(next < today ? today : next);
    setSlotsLoading(true); setSlots([]); setSlotsError(null);
    setSelectedSlot(null);
  }

  function continueStep() {
    setFormError(null);
    if (step === "service" && service) setStep(service.staffSelectionMode === "CUSTOMER_CHOICE" ? "staff" : "schedule");
    else if (step === "staff" && assignment) setStep("schedule");
    else if (step === "schedule" && selectedSlot) setStep("customer");
  }

  function previousStep() {
    if (step === "customer") setStep(service?.staffSelectionMode === "CUSTOMER_CHOICE" ? "schedule" : "schedule");
    else if (step === "schedule") setStep(service?.staffSelectionMode === "CUSTOMER_CHOICE" ? "staff" : "service");
    else if (step === "staff") setStep("service");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog || !service || !assignment || !selectedSlot || submitting) return;
    const name = customer.name.trim();
    const phone = customer.phone.trim();
    const email = customer.email.trim();
    if (!name || (!phone && !email)) { setFormError("Ingresá tu nombre y al menos un teléfono o correo electrónico."); return; }
    const emailInput = document.getElementById("public-customer-email");
    if (email && emailInput instanceof HTMLInputElement && emailInput.validity.typeMismatch) { setFormError("Ingresá un correo electrónico válido."); emailInput.focus(); return; }
    const input: PublicBookingCreateInput = {
      serviceId: service.id, startAt: selectedSlot.startAt, assignment,
      customer: { name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) },
    };
    const signature = JSON.stringify(input);
    if (submissionRef.current?.signature !== signature) submissionRef.current = { signature, key: crypto.randomUUID() };
    setSubmitting(true); setFormError(null);
    try {
      const result = await createPublicBooking(slug, input, submissionRef.current.key);
      setReceipt({ id: result.id, status: result.status, startAt: result.startAt, endAt: result.endAt, durationMinutes: result.durationMinutes, serviceName: result.serviceName, staffName: result.staffName, timeZone: result.timeZone, version: result.version, offset: selectedSlot.offset, managementHref: `/reservar/${encodeURIComponent(slug)}/gestionar#${encodeURIComponent(result.managementToken)}` });
      submissionRef.current = null;
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setFormError(publicErrorMessage(error));
      if (apiError?.code === "SLOT_UNAVAILABLE" || apiError?.code === "BOOKING_CONFIGURATION_CHANGED") {
        setSelectedSlot(null); setSlots([]); setSlotsLoading(true); setSlotsError(null); setSlotsRetry((value) => value + 1);
      }
    } finally { setSubmitting(false); }
  }

  if (receipt && catalog) return <ReceiptScreen catalog={catalog} receipt={receipt} onRestart={() => { setReceipt(null); setStep("service"); setServiceId(""); setChoice(null); setSelectedSlot(null); setCustomer({ name: "", phone: "", email: "" }); }} />;
  if (catalogLoading) return <PublicPageFrame><LoadingState text="Cargando servicios y disponibilidad…" /></PublicPageFrame>;
  if (catalogError || !catalog) return <PublicPageFrame><ErrorState message={catalogError ?? "No pudimos cargar la reserva pública."} onRetry={() => { setCatalogLoading(true); setCatalogError(null); setCatalog(null); setCatalogRetry((value) => value + 1); }} /></PublicPageFrame>;
  if (!catalog.services.length) return <PublicPageFrame><EmptyState title="Todavía no hay servicios disponibles" text="Este negocio no publicó servicios para reservar por internet." /></PublicPageFrame>;

  const currentPosition = currentStepIndex + 1;
  const canContinue = step === "service" ? !!service : step === "staff" ? !!assignment : step === "schedule" ? !!selectedSlot : true;
  const nextLabel = step === "customer" ? "Confirmar reserva" : "Continuar";
  const selectedStaffName = assignment?.kind === "SPECIFIC" ? staff.find((person) => person.id === assignment.staffMemberId)?.name ?? "Especialista seleccionado" : assignment?.kind === "ANY" ? (service?.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "Cualquier especialista") : assignment?.kind === "NONE" ? "Sin especialista" : "A elección";
  const selectedDateText = selectedDate ? localDateLabel(selectedDate, { weekday: "long", day: "numeric", month: "short" }) : "Elegí una fecha";
  const selectedTimeText = selectedSlot ? slotTimeLabel(selectedSlot, slots) : "Elegí un horario";
  const progress = Math.round((currentPosition / stepList.length) * 100);

  return <PublicPageFrame>
    <header className="sticky top-0 z-30 border-b border-[#E4E9E7] bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        {step !== "service" ? <button type="button" onClick={previousStep} aria-label="Paso anterior" className="rounded-full p-2 text-[#667078] transition hover:bg-[#F8FAF9] hover:text-[#182026]"><ArrowLeft size={21} /></button> : <span className="w-10" />}
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#182026] text-xs font-bold text-white shadow-sm">{catalog.organization.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0"><h1 className="truncate text-sm font-bold tracking-tight text-[#182026] sm:text-base">{catalog.organization.name}</h1><p className="text-[10px] font-medium uppercase tracking-[.16em] text-[#667078]">Reservas en línea</p></div></div>
        <span className="w-10" aria-hidden="true" />
      </div>
      <div className="h-1 bg-[#E4E9E7]"><div className="h-full bg-[#7ED6A5] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
    </header>

    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 pb-44 md:flex-row md:gap-12 md:py-10 md:pb-10">
      <div className="min-w-0 flex-1">
        <section key={step} className={styles.step} aria-labelledby="public-booking-step-title">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#667078] md:hidden">Paso {currentPosition} de {stepList.length}</p>
          <h2 ref={titleRef} id="public-booking-step-title" tabIndex={-1} className="mb-2 text-3xl font-bold tracking-tight text-[#182026]">{stepTitle[step]}</h2>
          <p className="mb-8 text-base text-[#667078]">{step === "service" ? "Seleccioná el servicio que querés reservar." : step === "staff" ? "Elegí con quién atenderte o dejá que el negocio asigne un especialista." : step === "schedule" ? "Elegí una fecha y un horario disponible." : "Completá tus datos para confirmar la reserva."}</p>

          {step === "service" ? <div className="space-y-4" aria-label="Servicios disponibles">{catalog.services.map((item) => <ServiceCard key={item.id} service={item} selected={serviceId === item.id} currency={catalog.organization.currency} onSelect={() => selectService(item)} />)}</div> : null}

          {step === "staff" && service ? <div className="space-y-3">
            <div role="radiogroup" aria-label="Elegí especialista" onKeyDown={(event) => moveRadioWithArrows(event, (index) => { const next = staffChoices[index]; if (next) chooseStaff(next); })} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ChoiceCard selected={choice?.kind === "ANY"} label="Cualquier especialista" description="Ver horarios de todo el equipo." onClick={() => chooseStaff({ kind: "ANY" })} />
              {staff.map((person) => <ChoiceCard key={person.id} selected={choice?.kind === "SPECIFIC" && choice.staffMemberId === person.id} label={person.name} description="Ver horarios de esta persona." onClick={() => chooseStaff({ kind: "SPECIFIC", staffMemberId: person.id })} />)}
            </div>
            {staffLoading ? <p role="status" className="text-sm text-[#667078]">Cargando especialistas…</p> : null}
            {staffError ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{staffError}</p> : null}
            {!staffLoading && !staffError && staff.length === 0 ? <EmptyState title="No hay especialistas disponibles" text="Este servicio todavía no tiene especialistas habilitados para reservas públicas." /> : null}
          </div> : null}

          {step === "schedule" && service && assignment ? <section aria-label="Calendario de disponibilidad">
            <div className="mb-6 rounded-[1.5rem] border border-[#E4E9E7] bg-white p-5 shadow-[0_2px_8px_rgba(24,32,38,.04)] sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold capitalize text-[#182026]"><CalendarBlank size={20} className="text-[#667078]" />{weekDates[0] ? localDateLabel(weekDates[0], { month: "long", year: "numeric" }) : "Fechas"}</h3>
                <div className="flex gap-1"><button type="button" aria-label="Semana anterior" onClick={() => moveWeek(-1)} disabled={!weekDates.length || addLocalDays(weekDates[0]!, 6) < today} className="rounded-lg border border-[#E4E9E7] p-2 text-[#182026] transition hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-35"><CaretLeft size={17} /></button><button type="button" aria-label="Semana siguiente" onClick={() => moveWeek(1)} disabled={!weekDates.length || addLocalDays(weekDates[0]!, 7) > horizonEnd} className="rounded-lg border border-[#E4E9E7] p-2 text-[#182026] transition hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-35"><CaretRight size={17} /></button></div>
              </div>
              <div role="group" aria-label="Fechas disponibles" className="flex gap-2 overflow-x-auto pb-1">
                {weekDates.map((date) => {
                  const disabled = date < today || date > horizonEnd;
                  const dayHasSlots = slots.some((slot) => slot.localDate === date);
                  return <button key={date} type="button" aria-label={`Elegir ${localDateLabel(date)}`} aria-pressed={selectedDate === date} disabled={disabled} onClick={() => { setSelectedDate(date); setSelectedSlot(null); setFormError(null); }} className={`relative flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-3 transition duration-200 ${selectedDate === date ? "scale-[1.03] border-[#182026] bg-[#182026] text-white shadow-sm" : "border-[#E4E9E7] bg-white text-[#182026] hover:border-[#A0AAA8]"} disabled:cursor-not-allowed disabled:opacity-35`}><span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">{localDateLabel(date, { weekday: "short" })}</span><span className="mt-1 text-lg font-bold">{date.slice(-2)}</span>{dayHasSlots ? <span aria-label="Con horarios" className={`absolute bottom-1 h-1 w-1 rounded-full ${selectedDate === date ? "bg-[#7ED6A5]" : "bg-[#438C78]"}`} /> : null}</button>;
                })}
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between gap-2 px-1"><h3 className="font-bold text-[#182026]">Horarios disponibles</h3><span className="rounded-md border border-[#E4E9E7] bg-white px-2 py-1 text-[11px] font-medium text-[#667078]">{catalog.timeZone}</span></div>
            {slotsLoading ? <p role="status" className="rounded-2xl border border-dashed border-[#E4E9E7] bg-white p-8 text-center text-sm text-[#667078]">Consultando disponibilidad…</p>
              : slotsError ? <ErrorState message={slotsError} onRetry={() => { setSlotsError(null); setSlotsLoading(true); setSlotsRetry((value) => value + 1); }} />
                : visibleSlots.length ? <div role="radiogroup" aria-label="Horarios disponibles" onKeyDown={(event) => moveRadioWithArrows(event, (index) => { const slot = visibleSlots[index]; if (slot) setSelectedSlot(slot); })} className="grid grid-cols-3 gap-3 sm:grid-cols-4">{visibleSlots.map((slot) => <button key={slot.startAt} type="button" role="radio" aria-label={slotTimeLabel(slot, visibleSlots)} aria-checked={selectedSlot?.startAt === slot.startAt} onClick={() => { setSelectedSlot(slot); setFormError(null); }} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${selectedSlot?.startAt === slot.startAt ? "border-[#182026] bg-[#182026] text-white shadow-sm" : "border-[#E4E9E7] bg-white text-[#182026] hover:border-[#7EA8F8] hover:bg-[#E8F0FF]"}`}>{slotTimeLabel(slot, visibleSlots)}</button>)}</div>
                  : <div className="rounded-2xl border border-dashed border-[#E4E9E7] bg-white px-5 py-8 text-center"><Clock size={25} className="mx-auto mb-3 text-[#A0AAA8]" /><p className="font-semibold text-[#182026]">No hay horarios disponibles para esta fecha</p><p className="mt-1 text-sm text-[#667078]">Probá otro día. Los cupos se actualizan con la agenda del negocio.</p></div>}
            <p className="mt-3 text-xs text-[#667078]">Los horarios se muestran en la zona del negocio: {catalog.timeZone}.</p>
          </section> : null}

          {step === "customer" ? <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-[1.5rem] border border-[#E4E9E7] bg-white p-5 shadow-[0_2px_8px_rgba(24,32,38,.04)] sm:p-8" noValidate>
            <label className="block text-sm font-bold text-[#182026]" htmlFor="public-customer-name">Nombre completo<input id="public-customer-name" autoComplete="name" required maxLength={150} value={customer.name} onChange={(event) => setCustomer((value) => ({ ...value, name: event.target.value }))} className={inputClass} placeholder="Ej. Ana Pérez" /></label>
            <label className="block text-sm font-bold text-[#182026]" htmlFor="public-customer-email">Correo electrónico <span className="font-medium text-[#667078]">(opcional)</span><input id="public-customer-email" type="email" autoComplete="email" maxLength={254} value={customer.email} onChange={(event) => setCustomer((value) => ({ ...value, email: event.target.value }))} className={inputClass} placeholder="tucorreo@ejemplo.com" /></label>
            <label className="block text-sm font-bold text-[#182026]" htmlFor="public-customer-phone">Teléfono <span className="font-medium text-[#667078]">(opcional)</span><input id="public-customer-phone" type="tel" autoComplete="tel" maxLength={30} value={customer.phone} onChange={(event) => setCustomer((value) => ({ ...value, phone: event.target.value }))} className={inputClass} placeholder="Ej. 11 2345 6789" /></label>
            <p className="-mt-2 text-xs leading-5 text-[#667078]">Ingresá al menos un medio de contacto. No enviamos un correo automático con el comprobante.</p>
            {formError ? <p role="alert" className="rounded-xl border border-[#F4C8C4] bg-[#FFF1F0] p-3 text-sm text-[#9B3F37]">{formError}</p> : null}
            <button type="submit" disabled={submitting || !customer.name.trim() || (!customer.phone.trim() && !customer.email.trim())} className="hidden" aria-hidden="true" tabIndex={-1}>Enviar</button>
          </form> : null}
        </section>
      </div>

      <aside className="hidden w-80 shrink-0 md:block lg:w-96" aria-label="Resumen de la reserva"><BookingSummary service={service} staffName={selectedStaffName} date={selectedDateText} time={selectedTimeText} timezone={catalog.timeZone} currency={catalog.organization.currency} />
        <div className="mt-4 text-center text-[10px] font-medium text-[#667078]"><LockKey size={12} className="mr-1 inline" />Gestionado de forma segura por <strong>nuari</strong></div>
      </aside>
    </main>

    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E4E9E7] bg-white p-4 shadow-[0_-10px_30px_rgba(24,32,38,.08)] md:hidden">
      <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#667078]">Paso {currentPosition} de {stepList.length}</p><p className="truncate text-sm font-bold text-[#182026]">{step === "customer" ? selectedDateText : service?.name ?? "Seleccioná un servicio"}{step === "schedule" && selectedSlot ? ` · ${selectedTimeText}` : ""}</p></div><span className="shrink-0 text-sm font-bold text-[#182026]">{service ? priceLabel(service, catalog.organization.currency) : ""}</span></div>
      {step === "customer" ? <button type="button" onClick={() => document.getElementById("public-customer-name")?.closest("form")?.requestSubmit()} disabled={submitting || !customer.name.trim() || (!customer.phone.trim() && !customer.email.trim())} className={primaryButton}>{submitting ? "Confirmando…" : nextLabel}</button>
        : <button type="button" onClick={continueStep} disabled={!canContinue || (step === "staff" && (staffLoading || !!staffError))} className={primaryButton}>{nextLabel}<ArrowRight size={18} /></button>}
    </div>

    {step !== "customer" ? <div className="mx-auto hidden w-full max-w-5xl px-4 pb-6 md:block"><button type="button" onClick={continueStep} disabled={!canContinue || (step === "staff" && (staffLoading || !!staffError))} className={primaryButton}>{nextLabel}<ArrowRight size={18} /></button></div> : <div className="mx-auto hidden w-full max-w-5xl px-4 pb-6 md:block"><button type="button" onClick={() => document.getElementById("public-customer-name")?.closest("form")?.requestSubmit()} disabled={submitting || !customer.name.trim() || (!customer.phone.trim() && !customer.email.trim())} className={primaryButton}>{submitting ? "Confirmando…" : nextLabel}</button></div>}
  </PublicPageFrame>;
}

function ReceiptScreen({ catalog, receipt, onRestart }: { catalog: PublicBookingCatalogDTO; receipt: PublicReceipt; onRestart: () => void }) {
  return <PublicPageFrame><main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center px-4 py-8 print:min-h-0 print:py-0">
    <section className={`relative w-full overflow-hidden rounded-[2rem] border border-[#E4E9E7] bg-white p-7 text-center shadow-[0_20px_40px_-10px_rgba(24,32,38,.12)] sm:p-10 print:border-0 print:shadow-none ${styles.receipt}`} aria-labelledby="booking-success-title">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#DDF6E8] opacity-60 blur-[40px]" />
      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#7ED6A5]/20 bg-[#DDF6E8] text-[#438C78]"><CheckCircle size={43} weight="fill" /></div>
      <h1 id="booking-success-title" className="relative mb-2 text-3xl font-bold tracking-tight text-[#182026]">¡Reserva confirmada!</h1>
      <p className="relative mb-8 text-sm text-[#667078]">Guardá este comprobante para consultar los datos de tu reserva.</p>
      <div className="relative mb-6 space-y-4 rounded-xl border border-[#E4E9E7] bg-[#F8FAF9] p-5 text-left shadow-inner">
        <div className="flex items-center gap-3 border-b border-[#E4E9E7] pb-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#182026] text-xs font-bold text-white">{catalog.organization.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div><p className="text-sm font-bold text-[#182026]">{receipt.serviceName}</p><p className="text-xs text-[#667078]">{catalog.organization.name}</p></div></div>
        <ReceiptRow icon={<CalendarBlank size={18} />} label={localInstantLabel(receipt.startAt, receipt.timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} value={`${localInstantLabel(receipt.startAt, receipt.timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} · UTC${receipt.offset}`} />
        <ReceiptRow icon={<Clock size={18} />} label={`${receipt.durationMinutes} minutos`} value={`Zona: ${receipt.timeZone}`} />
        <ReceiptRow icon={<User size={18} />} label="Profesional" value={receipt.staffName ?? "Asignación del negocio"} />
      </div>
      <div className="mb-3 print:hidden"><a href={receipt.managementHref} className={primaryButton}><CalendarBlank size={17} />Gestionar reserva</a></div>
      <div className="grid grid-cols-2 gap-3 print:hidden"><button type="button" onClick={() => window.print()} className={secondaryButton}><Receipt size={17} />Guardar comprobante</button><button type="button" onClick={onRestart} className={secondaryButton}>Hacer otra reserva</button></div>
    </section>
  </main></PublicPageFrame>;
}

function ServiceCard({ service, selected, currency, onSelect }: { service: PublicBookingServiceDTO; selected: boolean; currency: string; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-label={`Elegir servicio ${service.name}`} aria-pressed={selected} className={`group flex w-full items-start justify-between gap-4 rounded-[1.4rem] border bg-white p-5 text-left shadow-[0_2px_8px_rgba(24,32,38,.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(24,32,38,.08)] sm:p-6 ${selected ? "border-[#182026] ring-2 ring-[#182026]/5" : "border-[#E4E9E7]"}`}>
    <span className="min-w-0"><span className="block text-lg font-bold text-[#182026]">{service.name}</span>{service.description ? <span className="mt-1 block text-sm leading-5 text-[#667078]">{service.description}</span> : null}<span className="mt-4 inline-flex flex-wrap gap-2"><span className="rounded-full bg-[#E8F0FF] px-2.5 py-1 text-[11px] font-bold text-[#35588E]">{service.durationMinutes} min</span><span className="rounded-full bg-[#F0ECFF] px-2.5 py-1 text-[11px] font-bold text-[#67588F]">{service.staffSelectionMode === "CUSTOMER_CHOICE" ? "Elegí especialista" : service.staffSelectionMode === "AUTO_ASSIGN" ? "Asignación automática" : "Sin especialista"}</span></span></span>
    <span className="shrink-0 text-right"><span className="block text-sm font-bold text-[#182026]">{priceLabel(service, currency)}</span><span aria-hidden="true" className={`mt-4 flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-[#182026] bg-[#182026] text-white" : "border-[#D6DEDA] text-transparent group-hover:border-[#7EA8F8]"}`}><CheckCircle size={16} weight="fill" /></span></span>
  </button>;
}

function ChoiceCard({ selected, label, description, onClick }: { selected: boolean; label: string; description: string; onClick: () => void }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`rounded-[1.4rem] border bg-white p-5 text-left shadow-[0_2px_8px_rgba(24,32,38,.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-8px_rgba(24,32,38,.08)] ${selected ? "border-[#182026] ring-2 ring-[#182026]/5" : "border-[#E4E9E7]"}`}><span className="block font-bold text-[#182026]">{label}</span><span className="mt-1 block text-sm text-[#667078]">{description}</span></button>;
}

function BookingSummary({ service, staffName, date, time, timezone, currency }: { service: PublicBookingServiceDTO | null; staffName: string; date: string; time: string; timezone: string; currency: string }) {
  return <div className="sticky top-24 flex min-h-[400px] flex-col rounded-[2rem] border border-[#E4E9E7] bg-white p-6 shadow-[0_20px_40px_-10px_rgba(24,32,38,.12)]"><h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-[#182026]"><Receipt size={21} className="text-[#A997E8]" />Tu reserva</h2>
    {service ? <div className="flex-1 space-y-4">
      <div className="rounded-2xl bg-[#E8F0FF] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#35588E]">Servicio</p><p className="mt-1 font-bold text-[#182026]">{service.name}</p><p className="mt-1 text-xs text-[#667078]">{service.durationMinutes} minutos</p></div>
      {staffName !== "A elección" ? <div className="rounded-2xl bg-[#F0ECFF] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#67588F]">Profesional</p><p className="mt-1 font-semibold text-[#182026]">{staffName}</p></div> : null}
      {date !== "Elegí una fecha" || time !== "Elegí un horario" ? <div className="rounded-2xl bg-[#182026] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-wider text-white/65">Fecha y horario</p><p className="mt-2 font-bold capitalize">{date}</p><p className="mt-1 text-sm text-white/80">{time}</p><p className="mt-2 text-[10px] text-white/65">{timezone}</p></div> : null}
      <div className="flex items-center justify-between border-t border-[#E4E9E7] pt-4"><span className="text-sm font-medium text-[#667078]">Precio de referencia</span><span className="font-bold text-[#182026]">{priceLabel(service, currency)}</span></div>
    </div> : <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center text-sm italic text-[#667078]/65"><Receipt size={30} />Seleccioná un servicio para comenzar</div>}
  </div>;
}

function ReceiptRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-3 text-sm"><span className="mt-0.5 shrink-0 text-[#667078]">{icon}</span><div><p className="font-bold capitalize text-[#182026]">{label}</p><p className="mt-0.5 text-xs text-[#667078]">{value}</p></div></div>; }
function moveRadioWithArrows(event: KeyboardEvent<HTMLDivElement>, select: (index: number) => void) {
  if (!(event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft")) return;
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
  const current = radios.indexOf(event.target as HTMLButtonElement);
  if (!radios.length || current < 0) return;
  event.preventDefault();
  const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
  const next = (current + delta + radios.length) % radios.length;
  radios[next]?.focus();
  select(next);
}
function PublicPageFrame({ children }: { children: React.ReactNode }) { return <div className={`flex min-h-screen flex-col bg-[#F8FAF9] text-[#182026] antialiased selection:bg-[#DDF6E8] ${styles.page}`}>{children}</div>; }
function LoadingState({ text }: { text: string }) { return <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-8"><p role="status" className="rounded-2xl border border-[#E4E9E7] bg-white px-5 py-4 text-sm text-[#667078]">{text}</p></main>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-2xl border border-[#F4C8C4] bg-[#FFF1F0] p-5 text-sm text-[#9B3F37]"><p role="alert">{message}</p>{onRetry ? <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-white px-3 py-2 font-bold text-[#182026]">Reintentar</button> : null}</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-[#E4E9E7] bg-white px-5 py-10 text-center"><p className="font-bold text-[#182026]">{title}</p><p className="mt-2 text-sm leading-6 text-[#667078]">{text}</p></div>; }
function priceLabel(service: PublicBookingServiceDTO, fallbackCurrency: string): string { if (service.price === null) return "A consultar"; return new Intl.NumberFormat("es-AR", { style: "currency", currency: service.currency || fallbackCurrency }).format(Number(service.price)); }
function publicErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "BOOKING_NOT_AVAILABLE") return "La reserva pública no está disponible en este momento.";
    if (error.code === "MANAGEMENT_LINK_NOT_AVAILABLE") return "El enlace de gestión no está disponible o venció.";
    if (error.code === "SLOT_UNAVAILABLE") return "Ese horario ya no está disponible. Elegí otro de los horarios actualizados.";
    if (error.code === "BOOKING_CONFIGURATION_CHANGED") return "La disponibilidad cambió. Actualizamos los horarios; elegí uno nuevo.";
    if (error.code === "BOOKING_BUSY") return "Hay mucha actividad en este momento. Podés reintentar en unos segundos.";
    if (error.code === "IDEMPOTENCY_KEY_REUSED") return "No se pudo confirmar el mismo intento. Revisá tus datos y volvé a intentarlo.";
    if (error.code === "RATE_LIMITED") return "Se realizaron varios intentos. Esperá un momento antes de volver a probar.";
    if (error.status === 0) return "No pudimos comprobar el resultado. Reintentá; conservamos los datos para evitar duplicar la reserva.";
    return error.message;
  }
  return "No pudimos conectar con Nuari. Reintentá para comprobar el resultado.";
}

const inputClass = "mt-2 block w-full rounded-xl border border-[#E4E9E7] bg-[#F8FAF9]/70 px-4 py-3 text-sm font-medium text-[#182026] outline-none transition placeholder:text-[#A0AAB2] focus:border-[#182026] focus:bg-white focus:ring-4 focus:ring-[#182026]/[.08]";
const primaryButton = "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#182026] px-4 py-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(24,32,38,.15)] transition hover:bg-[#2A3742] hover:shadow-[0_6px_20px_rgba(24,32,38,.2)] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E9E7] bg-white px-3 py-3 text-xs font-bold text-[#182026] shadow-sm transition hover:bg-[#F8FAF9]";
