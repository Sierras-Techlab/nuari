/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agenda = vi.hoisted(() => ({
  setup: vi.fn(), appointments: vi.fn(), customers: vi.fn(), eligible: vi.fn(), availability: vi.fn(), create: vi.fn(),
}));
vi.mock("./agenda-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("./agenda-data")>()), loadAgendaSetup: agenda.setup, loadAgendaAppointments: agenda.appointments, searchAgendaCustomers: agenda.customers, loadEligibleStaff: agenda.eligible, loadAvailableSlots: agenda.availability, saveNewAppointment: agenda.create }));
vi.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({
    preflight: async () => undefined,
    snapshot: { user: { id: "user-1" }, activeOrganizationId: "org-1", memberships: [{ organization: { id: "org-1" }, role: "OWNER" }] },
  }),
}));

import { AgendaScreen } from "./agenda-screen";

const today = businessToday();
const baseSetup = {
  services: [{ id: "service-1", organizationId: "org-1", name: "Consulta", description: null, durationMinutes: 40, pricingType: "ON_REQUEST", price: null, currency: "ARS", categoryId: null, active: true, sortOrder: 0, staffSelectionMode: "CUSTOMER_CHOICE", modality: "IN_PERSON", version: 1, createdAt: "", updatedAt: "" }],
  staff: [{ id: "staff-1", organizationId: "org-1", name: "Sofía Romano", active: true, version: 1, createdAt: "", updatedAt: "" }],
  calendars: [{ id: "calendar-1", organizationId: "org-1", kind: "STAFF", staffMemberId: "staff-1", version: 1, weeklyWindows: [{ weekday: 1, startMinute: 540, endMinute: 1020 }], dayOverrides: [], timeOff: [] }],
  slotStepMinutes: 10, timeZone: "America/Argentina/Buenos_Aires",
};
const booking = {
  id: "booking-1", organizationId: "org-1", customerId: "customer-1", serviceId: "service-1", staffMemberId: "staff-1",
  startAt: `${today}T13:00:00.000Z`, endAt: `${today}T13:40:00.000Z`, durationMinutes: 40, assignmentKind: "SPECIFIC",
  status: "CONFIRMED", source: "INTERNAL", version: 1, customerNameSnapshot: "Sofía Cliente", serviceNameSnapshot: "Consulta",
  staffNameSnapshot: "Sofía Romano", timezone: "America/Argentina/Buenos_Aires",
};

describe("AgendaScreen", () => {
  beforeEach(() => {
    agenda.setup.mockResolvedValue(baseSetup); agenda.appointments.mockResolvedValue([booking]);
    agenda.customers.mockResolvedValue([{ id: "customer-1", organizationId: "org-1", name: "Lara Pérez", phone: "112233", email: null, active: true, version: 1, createdAt: "", updatedAt: "" }]);
    agenda.eligible.mockResolvedValue([{ id: "staff-1", name: "Sofía Romano", active: true }]);
    agenda.availability.mockResolvedValue([{ startAt: `${today}T13:30:00.000Z`, endAt: `${today}T14:10:00.000Z`, localDate: today, localTime: "10:30", offset: "-03:00", timeZone: "America/Argentina/Buenos_Aires", staff: [{ id: "staff-1", name: "Sofía Romano" }] }]);
    agenda.create.mockResolvedValue({ ...booking, id: "booking-2", customerNameSnapshot: "Lara Pérez" });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("loads real reservations, filters status and switches between day and week", async () => {
    render(<AgendaScreen />);
    expect((await screen.findAllByRole("button", { name: "Ver reserva de Sofía Cliente" })).length).toBeGreaterThan(0);
    expect(agenda.appointments).toHaveBeenCalledWith("org-1", expect.objectContaining({ fromDate: today } ), expect.any(AbortSignal));

    fireEvent.change(screen.getByLabelText("Filtrar estado"), { target: { value: "CANCELLED" } });
    expect(screen.queryByRole("button", { name: "Ver reserva de Sofía Cliente" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Filtrar estado"), { target: { value: "" } });
    expect(screen.getAllByRole("button", { name: "Ver reserva de Sofía Cliente" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(agenda.appointments).toHaveBeenCalledWith("org-1", expect.objectContaining({ toDate: expect.any(String) }), expect.any(AbortSignal)));
    expect(screen.getByText("Sofía Romano")).toBeTruthy();
  });

  it("shows access and network failures with a retry action", async () => {
    agenda.appointments.mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValue([booking]);
    render(<AgendaScreen />);
    expect(await screen.findByText("Sin conexión")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect((await screen.findAllByRole("button", { name: "Ver reserva de Sofía Cliente" })).length).toBeGreaterThan(0);
  });

  it("creates an internal booking using an existing customer and an available backend slot", async () => {
    render(<AgendaScreen />);
    await screen.findAllByRole("button", { name: "Ver reserva de Sofía Cliente" });
    fireEvent.click(screen.getByRole("button", { name: /Nuevo turno/ }));
    fireEvent.change(await screen.findByLabelText("Buscar cliente"), { target: { value: "Lara" } });
    fireEvent.click(await screen.findByRole("button", { name: /Lara Pérez/ }));
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "service-1" } });
    fireEvent.click(await screen.findByRole("radio", { name: "10:30" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reserva" }));
    await waitFor(() => expect(agenda.create).toHaveBeenCalledWith("org-1", expect.objectContaining({ customerId: "customer-1", serviceId: "service-1", startAt: `${today}T13:30:00.000Z`, assignment: { kind: "ANY" } })));
  });

  it("disambiguates repeated local availability times with their UTC offsets", async () => {
    agenda.availability.mockResolvedValue([
      { startAt: `${today}T05:30:00.000Z`, endAt: `${today}T06:00:00.000Z`, localDate: today, localTime: "01:30", offset: "-04:00", timeZone: "America/New_York", staff: [] },
      { startAt: `${today}T06:30:00.000Z`, endAt: `${today}T07:00:00.000Z`, localDate: today, localTime: "01:30", offset: "-05:00", timeZone: "America/New_York", staff: [] },
    ]);
    render(<AgendaScreen />);
    await screen.findAllByRole("button", { name: "Ver reserva de Sofía Cliente" });
    fireEvent.click(screen.getByRole("button", { name: /Nuevo turno/ }));
    fireEvent.change(await screen.findByLabelText("Buscar cliente"), { target: { value: "Lara" } });
    fireEvent.click(await screen.findByRole("button", { name: /Lara Pérez/ }));
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "service-1" } });
    expect(await screen.findByRole("radio", { name: "01:30 · UTC-04:00" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "01:30 · UTC-05:00" })).toBeTruthy();
  });
});

function businessToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((item) => item.type === "year")?.value}-${parts.find((item) => item.type === "month")?.value}-${parts.find((item) => item.type === "day")?.value}`;
}
