"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/page-states";
import { AppointmentPanel } from "./appointment-panel";
import { DEMO_DATE } from "./demo-source";
import { useDemoAppointmentSource } from "./demo-provider";
import { AppointmentSourceError, type Appointment, type AppointmentInput, type AppointmentSetup, type AppointmentSource } from "./types";
import { ApiError } from "@/lib/api/errors";

type PanelState =
  | { mode: "new" }
  | { mode: "detail" | "reschedule" | "confirm"; id: string };

function requireSource(source: AppointmentSource | null): AppointmentSource {
  if (!source) throw new Error("Authorized appointment source is required.");
  return source;
}

function addDays(date: string, amount: number): string {
  const parsed = new Date(date + "T12:00:00Z");
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  const label = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
  return label[0].toLocaleUpperCase("es-AR") + label.slice(1);
}

function feedbackFor(error: unknown): string {
  if (error instanceof AppointmentSourceError && error.code === "SLOT_TAKEN") {
    return "Ese horario está ocupado para el profesional elegido. Probá con otra hora.";
  }
  return error instanceof Error ? error.message : "No pudimos completar la acción. Intentá nuevamente.";
}

export function AgendaScreen({ source }: { source?: AppointmentSource }) {
  const sharedDemoSource = useDemoAppointmentSource();
  const dataSource = requireSource(source ?? sharedDemoSource);
  const appointmentSource: AppointmentSource = dataSource;
  const [date, setDate] = useState(DEMO_DATE);
  const [staffFilter, setStaffFilter] = useState("");
  const [setup, setSetup] = useState<AppointmentSetup | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const contextRetries = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([appointmentSource.getSetup(), appointmentSource.list(date)]).then(([loadedSetup, loadedAppointments]) => {
      if (!active) return;
      setSetup(loadedSetup);
      setAppointments(loadedAppointments);
      contextRetries.current = 0;
      setLoadError(null);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && error.code === "CONTEXT_CHANGED") {
        if (contextRetries.current === 0) {
          contextRetries.current = 1;
          setRefreshKey((key) => key + 1);
          return;
        }
      }
      setLoadError(feedbackFor(error));
      setLoading(false);
    });
    return () => { active = false; };
  }, [appointmentSource, date, refreshKey]);

  function changeDate(nextDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate) || Number.isNaN(new Date(nextDate + "T12:00:00Z").getTime())) return;
    setLoading(true);
    setDate(nextDate);
    setNotice(null);
  }

  function openPanel(next: PanelState) {
    setPanelError(null);
    setPanel(next);
  }

  function closePanel() {
    if (busy) return;
    setPanel(null);
    setPanelError(null);
  }

  async function create(input: AppointmentInput) {
    setBusy(true);
    setPanelError(null);
    try {
      await appointmentSource.create(input);
      setPanel(null);
      setStaffFilter("");
      if (input.date !== date) changeDate(input.date);
      setNotice("Turno guardado");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setPanelError(feedbackFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(slot: Pick<Appointment, "date" | "time">) {
    if (!panel || !("id" in panel)) return;
    setBusy(true);
    setPanelError(null);
    try {
      await appointmentSource.reschedule(panel.id, slot);
      setPanel(null);
      setStaffFilter("");
      if (slot.date !== date) changeDate(slot.date);
      setNotice("Turno reprogramado");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setPanelError(feedbackFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!panel || !("id" in panel)) return;
    setBusy(true);
    setPanelError(null);
    try {
      await appointmentSource.cancel(panel.id);
      setPanel(null);
      setNotice("Turno cancelado");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setPanelError(feedbackFor(error));
    } finally {
      setBusy(false);
    }
  }

  const selectedAppointment = panel && "id" in panel ? appointments.find((item) => item.id === panel.id) : undefined;
  const visible = appointments.filter((item) => !staffFilter || item.staffId === staffFilter);
  const active = visible.filter((item) => item.status === "scheduled");
  const activeTotal = appointments.filter((item) => item.status === "scheduled").length;
  const professionals = new Set(appointments.filter((item) => item.status === "scheduled").map((item) => item.staffId)).size;

  return (
    <div className="space-y-7 pb-12 text-[#182026]">
      <header className="relative overflow-hidden rounded-[28px] border border-[#E4E9E7] bg-white px-6 py-8 shadow-[0_20px_50px_-38px_rgba(24,32,38,.24)] sm:px-9 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-35" />
        <div aria-hidden="true" className="absolute -right-16 -top-24 size-64 rounded-full bg-[#DDF6E8]/50 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-32 right-36 size-56 rounded-full bg-[#E8F0FF]/60 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#DDF6E8] bg-[#EFFBF4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-[#35645D]"><Sparkle size={14} weight="fill" /> Turnero / Agenda</p>
            <h1 className="mt-5 max-w-xl text-3xl font-bold tracking-[-0.045em] sm:text-[2.65rem]">Cada turno, en su lugar.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#667078]">Organizá el día, encontrá lo que necesitás y resolvé cambios con claridad.</p>
          </div>
          <Button onClick={() => openPanel({ mode: "new" })} disabled={loading || !!loadError || !setup} className="h-11 shrink-0 rounded-xl bg-[#182026] px-5 text-white shadow-[0_8px_24px_-12px_rgba(24,32,38,.55)] hover:bg-[#2A3742]"><Plus size={17} weight="bold" /> Nuevo turno</Button>
        </div>
      </header>

      {notice ? <div role="status" className="rounded-xl border border-[#cfe6d1] bg-[#eaf7e8] px-4 py-3 text-sm font-semibold text-[#2f6742]">{notice}</div> : null}

      <section aria-label="Resumen de la jornada" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<CalendarBlank size={20} />} tone="mint" label="Turnos activos" value={String(activeTotal).padStart(2, "0")} detail="En la fecha seleccionada" />
        <SummaryCard icon={<Users size={20} />} tone="blue" label="Profesionales" value={String(professionals).padStart(2, "0")} detail="Con turnos en agenda" />
        <SummaryCard icon={<Clock size={20} />} tone="lavender" label="Próximo bloque" value={active[0]?.time ?? "—"} detail={active[0] ? "Primer turno visible" : "Sin turnos visibles"} />
      </section>

      <section aria-labelledby="agenda-title" className="overflow-hidden rounded-[26px] border border-[#e0e8df] bg-white shadow-[0_18px_46px_-38px_rgba(26,60,36,.5)]">
        <div className="border-b border-[#edf0ea] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#438C78]"><CalendarDots size={16} weight="duotone" /> Agenda de turnos</p>
              <h2 id="agenda-title" className="mt-1 text-2xl font-bold tracking-tight">Tu día en orden</h2>
              <p className="mt-1 text-sm text-[#748178]">Consultá y gestioná cada cita desde un solo lugar.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-label="Día anterior" onClick={() => changeDate(addDays(date, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe7dd] bg-white text-[#426149] hover:bg-[#f3f8f0]"><ArrowLeft size={16} /></button>
              <label className="sr-only" htmlFor="agenda-date">Ir a fecha</label>
              <input id="agenda-date" type="date" value={date} onChange={(event) => changeDate(event.target.value)} className="h-10 rounded-xl border border-[#dfe7dd] bg-[#f9fbf7] px-3 text-sm font-bold text-[#294734]" />
              <button type="button" aria-label="Siguiente día" onClick={() => changeDate(addDays(date, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe7dd] bg-white text-[#426149] hover:bg-[#f3f8f0]"><ArrowRight size={16} /></button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-[#edf0ea] bg-[#fbfcf9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div><p className="text-lg font-bold tracking-tight">{formatDate(date)}</p><p className="text-xs font-medium text-[#829087]">{activeTotal} {activeTotal === 1 ? "turno" : "turnos"}</p></div>
          <div className="flex items-center gap-2"><Users size={18} className="text-[#7EA8F8]" /><label htmlFor="staff-filter" className="sr-only">Filtrar por profesional</label><select id="staff-filter" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="h-10 min-w-44 rounded-xl border border-[#E4E9E7] bg-white px-3 text-sm font-semibold text-[#182026]"><option value="">Todo el equipo</option>{setup?.staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
        </div>

        <div className="min-h-[360px] px-5 py-6 sm:px-7">
          {loading ? <LoadingState label="Cargando agenda" /> : loadError ? <ErrorState title="No pudimos cargar la agenda" description={loadError} action={<Button variant="outline" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }}>Reintentar</Button>} /> : visible.length === 0 ? <EmptyState title="No hay turnos para esta fecha" description={staffFilter ? "Probá con otro profesional o elegí un día diferente." : "Elegí otro día o registrá el primer turno de esta jornada."} action={<Button variant="outline" onClick={() => openPanel({ mode: "new" })}>Crear turno</Button>} /> : (
            <ol className="space-y-0">
              {visible.map((item, index) => {
                const service = setup?.services.find((entry) => entry.id === item.serviceId);
                const person = setup?.staff.find((entry) => entry.id === item.staffId);
                return <li key={item.id} className="relative grid grid-cols-[55px_1fr] gap-3 pb-4 last:pb-0 sm:grid-cols-[80px_1fr] sm:gap-5">
                  {index < visible.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[68px] top-7 hidden w-px bg-[#dce9db] sm:block" /> : null}
                  <div className="pt-4 text-right"><span className="text-sm font-bold text-[#365744]">{item.time}</span></div>
                  <button type="button" aria-label={"Ver turno de " + item.customerName} onClick={() => openPanel({ mode: "detail", id: item.id })} className={"group flex w-full flex-col justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5c9871] sm:flex-row sm:items-center sm:px-5 " + (item.status === "cancelled" ? "border-[#ece6e1] bg-[#faf7f5] opacity-75" : "border-[#dfe9df] bg-[#fbfdf9] hover:border-[#abd4b5]")}>
                    <span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f2e5] text-xs font-bold text-[#447353]">{item.customerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#243b2f]">{item.customerName}</span><span className="mt-1 block truncate text-xs text-[#738077]">{service?.name || "Servicio"} · {service?.durationMinutes || 0} min</span></span></span>
                    <span className="flex items-center gap-3"><span className="text-xs font-semibold text-[#5b7462]">{person?.name || "Profesional"}</span><span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + (item.status === "cancelled" ? "bg-[#f1e8e4] text-[#9a6559]" : "bg-[#e2f3e6] text-[#31734d]")}>{item.status === "cancelled" ? "Cancelado" : "Confirmado"}</span><ArrowRight size={16} className="text-[#78927e] transition-transform group-hover:translate-x-1" /></span>
                  </button>
                </li>;
              })}
            </ol>
          )}
        </div>
      </section>

      {panel && setup ? <AppointmentPanel
        key={panel.mode + ("id" in panel ? panel.id : "")}
        mode={panel.mode}
        appointment={selectedAppointment}
        setup={setup}
        currentDate={date}
        busy={busy}
        error={panelError}
        onClose={closePanel}
        onBack={() => { if (panel && "id" in panel) openPanel({ mode: "detail", id: panel.id }); }}
        onCreate={create}
        onEdit={() => { if (panel && "id" in panel) openPanel({ mode: "reschedule", id: panel.id }); }}
        onAskCancel={() => { if (panel && "id" in panel) openPanel({ mode: "confirm", id: panel.id }); }}
        onReschedule={reschedule}
        onCancel={cancel}
      /> : null}
    </div>
  );
}

function SummaryCard({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: "mint" | "blue" | "lavender"; label: string; value: string; detail: string }) {
  const toneClass = { mint: "bg-[#DDF6E8] text-[#438C78]", blue: "bg-[#E8F0FF] text-[#5D86D5]", lavender: "bg-[#F0ECFF] text-[#8E7BC9]" }[tone];
  return <div className="flex items-center gap-4 rounded-2xl border border-[#E4E9E7] bg-white p-4 shadow-[0_8px_24px_-20px_rgba(24,32,38,.18)]"><span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + toneClass}>{icon}</span><span><span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#79858B]">{label}</span><span className="mt-0.5 block text-xl font-bold leading-tight tracking-tight text-[#182026]">{value}</span><span className="block text-[11px] text-[#88949A]">{detail}</span></span></div>;
}
