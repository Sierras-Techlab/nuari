import {
  AppointmentSourceError,
  type Appointment,
  type AppointmentInput,
  type AppointmentSetup,
  type AppointmentSource,
} from "./types";

export const DEMO_DATE = "2026-10-06";

const setup: AppointmentSetup = {
  timeZone: "America/Argentina/Buenos_Aires",
  staff: [
    { id: "martin", name: "Martín Ríos", initials: "MR" },
    { id: "juli", name: "Juli Torres", initials: "JT" },
  ],
  services: [
    { id: "estandar", name: "Servicio estándar", durationMinutes: 40 },
    { id: "breve", name: "Servicio breve", durationMinutes: 25 },
    { id: "extendido", name: "Servicio extendido", durationMinutes: 60 },
  ],
};

const initialAppointments: Appointment[] = [
  { id: "demo-1", customerName: "Nicolás García", customerPhone: "11 5555 1234", serviceId: "estandar", staffId: "martin", date: DEMO_DATE, time: "09:00", status: "scheduled", notes: "" },
  { id: "demo-2", customerName: "Sofía Romano", customerPhone: "11 5555 1235", serviceId: "breve", staffId: "juli", date: DEMO_DATE, time: "10:30", status: "scheduled", notes: "Prefiere un horario temprano." },
  { id: "demo-3", customerName: "Lucas Gómez", customerPhone: "11 5555 1236", serviceId: "extendido", staffId: "martin", date: DEMO_DATE, time: "11:00", status: "scheduled", notes: "" },
  { id: "demo-4", customerName: "Valentina Díaz", customerPhone: "11 5555 1237", serviceId: "estandar", staffId: "juli", date: DEMO_DATE, time: "14:30", status: "scheduled", notes: "" },
];

function minutes(time: string): number {
  const [hours = 0, minutesPart = 0] = time.split(":").map(Number);
  return hours * 60 + minutesPart;
}

function durationFor(services: AppointmentSetup["services"], serviceId: string): number {
  return services.find((service) => service.id === serviceId)?.durationMinutes ?? 0;
}

function ensureValidSlot(slot: Pick<Appointment, "date" | "time">): void {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(slot.date) ? new Date(slot.date + "T12:00:00Z") : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== slot.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time)) {
    throw new AppointmentSourceError("INVALID_INPUT", "Ingresá una fecha y hora válidas.");
  }
}

function ensureAvailable(
  appointments: Appointment[],
  input: Pick<Appointment, "date" | "time" | "staffId" | "serviceId">,
  services: AppointmentSetup["services"],
  ignoreId?: string,
): void {
  const start = minutes(input.time);
  const end = start + durationFor(services, input.serviceId);
  const occupied = appointments.some((item) => {
    if (item.id === ignoreId || item.status !== "scheduled" || item.date !== input.date || item.staffId !== input.staffId) return false;
    const itemStart = minutes(item.time);
    return start < itemStart + durationFor(services, item.serviceId) && end > itemStart;
  });
  if (occupied) {
    throw new AppointmentSourceError("SLOT_TAKEN", "Ese profesional ya tiene un turno en el horario elegido.");
  }
}

export function createDemoAppointmentSource(catalog?: Pick<AppointmentSource, "getSetup">): AppointmentSource {
  let appointments = initialAppointments.map((item) => ({ ...item }));
  let nextId = 5;

  async function getCurrentSetup(): Promise<AppointmentSetup> {
    if (catalog) return catalog.getSetup();
    return {
      timeZone: setup.timeZone,
      staff: setup.staff.map((item) => ({ ...item })),
      services: setup.services.map((item) => ({ ...item })),
    };
  }

  return {
    getSetup: getCurrentSetup,
    async list(date) {
      return appointments
        .filter((item) => item.date === date)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((item) => ({ ...item }));
    },
    async create(input: AppointmentInput) {
      const currentSetup = await getCurrentSetup();
      if (!input.customerName.trim()) {
        throw new AppointmentSourceError("INVALID_INPUT", "Ingresá el nombre del cliente.");
      }
      if (!currentSetup.staff.some((item) => item.id === input.staffId) || !durationFor(currentSetup.services, input.serviceId)) {
        throw new AppointmentSourceError("INVALID_INPUT", "Seleccioná un servicio y un profesional válidos.");
      }
      ensureValidSlot(input);
      ensureAvailable(appointments, input, currentSetup.services);
      const created: Appointment = { ...input, id: `demo-${nextId++}`, status: "scheduled" };
      appointments = [...appointments, created];
      return { ...created };
    },
    async reschedule(id, slot) {
      const currentSetup = await getCurrentSetup();
      const current = appointments.find((item) => item.id === id);
      if (!current || current.status === "cancelled") {
        throw new AppointmentSourceError("NOT_FOUND", "No encontramos ese turno activo.");
      }
      ensureValidSlot(slot);
      const updated = { ...current, ...slot };
      ensureAvailable(appointments, updated, currentSetup.services, id);
      appointments = appointments.map((item) => item.id === id ? updated : item);
      return { ...updated };
    },
    async cancel(id) {
      const current = appointments.find((item) => item.id === id);
      if (!current) {
        throw new AppointmentSourceError("NOT_FOUND", "No encontramos ese turno.");
      }
      const updated: Appointment = { ...current, status: "cancelled" };
      appointments = appointments.map((item) => item.id === id ? updated : item);
      return { ...updated };
    },
  };
}
