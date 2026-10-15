import {
  cancelAppointment, closeAppointment, createAppointment, getAppointments, getAvailability,
  getBookingCalendars, getCustomers, getOrganization, getSchedulingSettings, getServiceStaff, getServices,
  getStaff, rescheduleAppointment,
} from "@/lib/api/browser";
import type {
  AppointmentAssignment, AppointmentCancelReason, AppointmentCreateInput, AppointmentDTO, AppointmentListQuery,
  AppointmentPageDTO, AvailabilityDTO, BookingCalendarDTO, CustomerSummaryDTO, ServiceDTO,
  StaffSummaryDTO,
} from "@/lib/api/contracts";

export type AgendaSetup = {
  services: ServiceDTO[];
  staff: StaffSummaryDTO[];
  calendars: BookingCalendarDTO[];
  slotStepMinutes: number;
  timeZone: string;
};

async function collect<T>(load: (offset: number) => Promise<{ items: T[]; pageInfo: { hasMore: boolean; nextOffset?: number | null } }>): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const result = await load(offset);
    items.push(...result.items);
    if (!result.pageInfo.hasMore || result.pageInfo.nextOffset == null) return items;
    offset = result.pageInfo.nextOffset;
  }
  return items;
}

export async function loadAgendaSetup(organizationId: string, signal?: AbortSignal): Promise<AgendaSetup> {
  const [services, staff, calendars, settings] = await Promise.all([
    collect((offset) => getServices(organizationId, { limit: 100, offset, status: "active" }, signal)),
    collect((offset) => getStaff(organizationId, { limit: 100, offset, status: "active" }, signal)),
    getBookingCalendars(organizationId, signal),
    getSchedulingSettings(organizationId, signal),
  ]);
  const organization = await getOrganization(organizationId, signal);
  return { services, staff, calendars, slotStepMinutes: settings.slotStepMinutes, timeZone: organization.organization.timezone };
}

export async function searchAgendaCustomers(organizationId: string, query: string, signal?: AbortSignal): Promise<CustomerSummaryDTO[]> {
  const page = await getCustomers(organizationId, { limit: 50, offset: 0, status: "active", ...(query ? { q: query } : {}) }, signal);
  return page.items;
}

export async function loadAgendaAppointments(organizationId: string, query: AppointmentListQuery, signal?: AbortSignal): Promise<AppointmentDTO[]> {
  const items: AppointmentDTO[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const result: AppointmentPageDTO = await getAppointments(organizationId, { ...query, limit: 100, ...(cursor ? { cursor } : {}) }, signal);
    items.push(...result.items);
    if (!result.pageInfo.hasMore || !result.pageInfo.nextCursor) return items;
    cursor = result.pageInfo.nextCursor;
  }
  return items;
}

export async function loadAvailableSlots(organizationId: string, input: {
  serviceId: string; date: string; assignment: AppointmentAssignment; signal?: AbortSignal;
}): Promise<AvailabilityDTO["slots"]> {
  const { serviceId, date, assignment, signal } = input;
  const result = await getAvailability(organizationId, {
    serviceId,
    selection: assignment.kind,
    ...(assignment.kind === "SPECIFIC" ? { staffMemberId: assignment.staffMemberId } : {}),
    fromDate: date,
    toDate: addDate(date, 1),
  }, signal);
  return result.slots;
}

export function saveNewAppointment(organizationId: string, input: AppointmentCreateInput): Promise<AppointmentDTO> {
  return createAppointment(organizationId, input, crypto.randomUUID());
}
export function moveAppointment(organizationId: string, appointment: AppointmentDTO, startAt: string, assignment: AppointmentAssignment) {
  return rescheduleAppointment(organizationId, appointment.id, { startAt, assignment }, appointment.version);
}
export function cancelAgendaAppointment(organizationId: string, appointment: AppointmentDTO, reasonCode: AppointmentCancelReason) {
  return cancelAppointment(organizationId, appointment.id, appointment.version, reasonCode);
}
export function closeAgendaAppointment(organizationId: string, appointment: AppointmentDTO, status: "complete" | "no-show") {
  return closeAppointment(organizationId, appointment.id, status, appointment.version);
}

export async function loadEligibleStaff(organizationId: string, serviceId: string, signal?: AbortSignal): Promise<Array<Pick<StaffSummaryDTO, "id" | "name" | "active">>> {
  const page = await getServiceStaff(organizationId, serviceId, { limit: 100, offset: 0, status: "active" }, signal);
  return page.items.filter((item) => item.staff.active).map((item) => item.staff);
}

export function addDate(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + amount, 12));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function localDateTime(instant: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export function localDateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function localMinute(instant: string, timeZone: string): number {
  const time = localDateTime(instant, timeZone).time;
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}
