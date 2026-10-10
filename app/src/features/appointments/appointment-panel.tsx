"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Appointment, AppointmentInput, AppointmentSetup } from "./types";

type PanelMode = "new" | "detail" | "reschedule" | "confirm";

type AppointmentPanelProps = {
  mode: PanelMode;
  appointment?: Appointment;
  setup: AppointmentSetup;
  currentDate: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onBack: () => void;
  onCreate: (input: AppointmentInput) => void;
  onEdit: () => void;
  onAskCancel: () => void;
  onReschedule: (slot: Pick<Appointment, "date" | "time">) => void;
  onCancel: () => void;
};

export function AppointmentPanel(props: AppointmentPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(props.onClose);
  const mode = props.mode;

  useEffect(() => {
    onCloseRef.current = props.onClose;
  }, [props.onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    if (mode === "detail" || mode === "confirm") titleRef.current?.focus();
    else firstFocusRef.current?.focus();
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
      previousFocus?.focus();
    };
  }, [mode]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const controls = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const title = props.mode === "new" ? "Nuevo turno" : props.mode === "detail" ? "Detalle del turno" : props.mode === "reschedule" ? "Reprogramar turno" : "Cancelar turno";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 cursor-default bg-[#101d1c]/45 backdrop-blur-[2px]" aria-label="Cerrar haciendo clic fuera" tabIndex={-1} onClick={props.onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="appointment-panel-title" onKeyDown={trapFocus} className="relative flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-[#dce5dd] bg-[#fbfcf8] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e1e8e1] bg-[#fbfcf8]/95 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-3">
            {props.mode === "reschedule" || props.mode === "confirm" ? <button type="button" onClick={props.onBack} aria-label="Volver al detalle" className="rounded-full p-2 text-[#53635d] hover:bg-[#edf3ec]"><ArrowLeft size={18} /></button> : null}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#688077]">Turnero / Agenda</p>
              <h2 ref={titleRef} tabIndex={-1} id="appointment-panel-title" className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-bold tracking-tight text-[#182a25]">{title}</h2>
            </div>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Cerrar panel" className="rounded-full border border-[#dfe7de] bg-white p-2 text-[#53635d] shadow-sm hover:text-[#172b23]"><X size={18} /></button>
        </div>

        {props.mode === "new" ? <NewAppointmentForm {...props} focusRef={firstFocusRef} /> : null}
        {props.mode === "detail" && props.appointment ? <AppointmentDetail {...props} appointment={props.appointment} /> : null}
        {props.mode === "reschedule" && props.appointment ? <RescheduleForm {...props} appointment={props.appointment} focusRef={firstFocusRef} /> : null}
        {props.mode === "confirm" && props.appointment ? <CancelConfirmation {...props} appointment={props.appointment} /> : null}
      </div>
    </div>
  );
}

function NewAppointmentForm({ setup, currentDate, busy, error, onCreate, onClose, focusRef }: AppointmentPanelProps & { focusRef: React.RefObject<HTMLInputElement | null> }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ customerName: customerName.trim(), customerPhone: customerPhone.trim(), serviceId, staffId, date, time, notes: notes.trim() });
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <div className="space-y-7 px-6 py-7">
        <p className="text-sm leading-6 text-[#65746c]">Completá los datos necesarios para reservar este turno.</p>
        <FormSection icon={<User size={18} />} title="Cliente">
          <Field label="Nombre del cliente" htmlFor="customer-name"><Input ref={focusRef} className={fieldClass} id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required placeholder="Nombre y apellido" /></Field>
          <Field label="Teléfono" htmlFor="customer-phone"><Input className={fieldClass} id="customer-phone" type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Opcional" /></Field>
        </FormSection>
        <FormSection icon={<CalendarDots size={18} />} title="Servicio y profesional">
          <Field label="Servicio" htmlFor="appointment-service"><select id="appointment-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} required className={selectClass}><option value="">Seleccioná un servicio</option>{setup.services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</select></Field>
          <Field label="Profesional" htmlFor="appointment-staff"><select id="appointment-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)} required className={selectClass}><option value="">Seleccioná un profesional</option>{setup.staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
        </FormSection>
        <FormSection icon={<CalendarBlank size={18} />} title="Horario">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="appointment-date"><Input className={fieldClass} id="appointment-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
            <Field label="Hora" htmlFor="appointment-time"><Input className={fieldClass} id="appointment-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></Field>
          </div>
          <p className="text-xs text-[#718077]">Verificá el horario antes de guardar.</p>
        </FormSection>
        <Field label="Notas" htmlFor="appointment-notes"><textarea id="appointment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Opcional" className={selectClass + " min-h-24 resize-y py-3"} /></Field>
        {error ? <p role="alert" className="rounded-xl border border-[#efc9bd] bg-[#fff3ef] px-4 py-3 text-sm text-[#9d3f32]">{error}</p> : null}
      </div>
      <PanelFooter><Button type="button" variant="outline" className={secondaryButtonClass} onClick={onClose}>Volver</Button><Button type="submit" className={primaryButtonClass} disabled={busy}>{busy ? "Guardando..." : "Guardar turno"}</Button></PanelFooter>
    </form>
  );
}

function AppointmentDetail({ appointment, setup, onEdit, onAskCancel, busy, error }: AppointmentPanelProps & { appointment: Appointment }) {
  const service = setup.services.find((item) => item.id === appointment.serviceId);
  const person = setup.staff.find((item) => item.id === appointment.staffId);
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-6 px-6 py-7">
        <div className="rounded-2xl border border-[#dfe9dc] bg-white p-6 shadow-[0_16px_40px_-28px_rgba(22,54,39,.28)]">
          <span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold " + (appointment.status === "cancelled" ? "bg-[#f7e9e5] text-[#a05f50]" : "bg-[#e1f4e6] text-[#286649]")}>{appointment.status === "cancelled" ? "Cancelado" : "Confirmado"}</span>
          <h3 className="mt-5 text-2xl font-bold tracking-tight text-[#1b2e27]">{appointment.customerName}</h3>
          <p className="mt-1 text-sm text-[#6c7a71]">{appointment.customerPhone || "Sin teléfono registrado"}</p>
        </div>
        <div className="divide-y divide-[#e4eae2] rounded-2xl border border-[#e1e8df] bg-white px-5">
          <DetailRow icon={<CalendarDots size={18} />} label="Servicio" value={service?.name || "Servicio"} />
          <DetailRow icon={<User size={18} />} label="Profesional" value={person?.name || "Profesional"} />
          <DetailRow icon={<CalendarBlank size={18} />} label="Fecha" value={formatDate(appointment.date)} />
          <DetailRow icon={<Clock size={18} />} label="Horario" value={appointment.time + " · " + (service?.durationMinutes || 0) + " min"} />
        </div>
        {appointment.notes ? <div className="rounded-2xl border border-[#e1e8df] bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-[#738279]">Nota</p><p className="mt-2 text-sm leading-6 text-[#354940]">{appointment.notes}</p></div> : null}
        {error ? <p role="alert" className="rounded-xl border border-[#efc9bd] bg-[#fff3ef] px-4 py-3 text-sm text-[#9d3f32]">{error}</p> : null}
      </div>
      {appointment.status === "scheduled" ? <PanelFooter><Button type="button" variant="outline" className={secondaryButtonClass} disabled={busy} onClick={onAskCancel}>Cancelar turno</Button><Button type="button" className={primaryButtonClass} onClick={onEdit}>Reprogramar</Button></PanelFooter> : null}
    </div>
  );
}

function RescheduleForm({ appointment, busy, error, onReschedule, focusRef }: AppointmentPanelProps & { appointment: Appointment; focusRef: React.RefObject<HTMLInputElement | null> }) {
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.time);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onReschedule({ date, time });
  }
  return <form onSubmit={submit} className="flex flex-1 flex-col"><div className="space-y-6 px-6 py-7"><p className="text-sm leading-6 text-[#65746c]">Elegí el nuevo horario de {appointment.customerName}.</p><div className="grid grid-cols-2 gap-3"><Field label="Fecha" htmlFor="reschedule-date"><Input ref={focusRef} className={fieldClass} id="reschedule-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field><Field label="Hora" htmlFor="reschedule-time"><Input className={fieldClass} id="reschedule-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></Field></div>{error ? <p role="alert" className="rounded-xl border border-[#efc9bd] bg-[#fff3ef] px-4 py-3 text-sm text-[#9d3f32]">{error}</p> : null}</div><PanelFooter><Button type="submit" className={primaryButtonClass + " w-full"} disabled={busy}>{busy ? "Guardando..." : "Guardar cambio"}</Button></PanelFooter></form>;
}

function CancelConfirmation({ appointment, busy, error, onCancel, onBack }: AppointmentPanelProps & { appointment: Appointment }) {
  return <div className="flex flex-1 flex-col"><div className="space-y-5 px-6 py-7"><p className="text-sm leading-6 text-[#65746c]">¿Querés cancelar el turno de <strong className="text-[#243b30]">{appointment.customerName}</strong> del {formatDate(appointment.date)} a las {appointment.time}? El turno seguirá visible con estado cancelado.</p>{error ? <p role="alert" className="rounded-xl border border-[#efc9bd] bg-[#fff3ef] px-4 py-3 text-sm text-[#9d3f32]">{error}</p> : null}</div><PanelFooter><Button type="button" variant="outline" className={secondaryButtonClass} onClick={onBack}>Volver</Button><Button type="button" variant="destructive" className="bg-[#a44636] text-white hover:bg-[#91372a]" disabled={busy} onClick={onCancel}>{busy ? "Cancelando..." : "Confirmar cancelación"}</Button></PanelFooter></div>;
}

function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="space-y-4"><div className="flex items-center gap-2 text-[#294d3b]">{icon}<h3 className="text-sm font-bold">{title}</h3></div>{children}</section>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={htmlFor} className="block text-xs font-bold text-[#43584b]">{label}</label>{children}</div>;
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 py-4"><span className="text-[#6d967d]">{icon}</span><span className="w-20 text-xs font-semibold text-[#738178]">{label}</span><span className="text-sm font-semibold text-[#263b30]">{value}</span></div>;
}

function PanelFooter({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 mt-auto flex justify-end gap-3 border-t border-[#e1e8e1] bg-[#fbfcf8] px-6 py-5">{children}</div>;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

const selectClass = "flex h-10 w-full rounded-md border border-[#d7e1d6] bg-white px-3 text-sm text-[#263b30] shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-[#649476]";
const fieldClass = "border-[#d7e1d6] bg-white text-[#263b30] placeholder:text-[#9aa79b] focus-visible:ring-[#649476]";
const primaryButtonClass = "bg-[#182026] text-white hover:bg-[#2A3742]";
const secondaryButtonClass = "border-[#d7e1d6] bg-white text-[#2a4935] hover:bg-[#f2f8ef]";
