/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalDays, businessToday, localDateLabel } from "./public-booking-date";

const api = vi.hoisted(() => ({
  catalog: vi.fn(), staff: vi.fn(), resolve: vi.fn(), availability: vi.fn(), cancel: vi.fn(), reschedule: vi.fn(),
}));
vi.mock("@/lib/api/browser", () => ({
  getPublicBookingCatalog: api.catalog,
  getPublicBookingStaff: api.staff,
  getPublicManagedBooking: api.resolve,
  getPublicRescheduleAvailability: api.availability,
  cancelPublicBooking: api.cancel,
  reschedulePublicBooking: api.reschedule,
}));

import { PublicBookingManagementScreen } from "./public-booking-management-screen";
import { ApiError } from "@/lib/api/errors";

const timeZone = "America/Argentina/Buenos_Aires";
const today = businessToday(timeZone);
const slotDate = addLocalDays(today, 2);
const appointmentDate = addLocalDays(today, 14);
const token = "m".repeat(43);
const appointment = {
  id: "appointment-1", serviceId: "service-1", status: "CONFIRMED" as const,
  startAt: `${appointmentDate}T16:00:00.000Z`, endAt: `${appointmentDate}T16:45:00.000Z`, durationMinutes: 45,
  serviceName: "Consulta inicial", staffName: "Sofía Romano", staffSelectionMode: "CUSTOMER_CHOICE" as const,
  assignment: { kind: "SPECIFIC" as const, staffMemberId: "staff-1" }, timeZone, version: 7,
  actions: { canCancel: true, canReschedule: true },
};
const newSlot = {
  startAt: `${slotDate}T16:00:00.000Z`, endAt: `${slotDate}T16:45:00.000Z`, localDate: slotDate, localTime: "13:00", offset: "-03:00", timeZone, staff: [],
};

describe("PublicBookingManagementScreen", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", `/reservar/estudio/gestionar#${token}`);
    api.catalog.mockResolvedValue({ organization: { id: "org-1", name: "Estudio Nuari", timezone: timeZone, currency: "ARS" }, timeZone, policy: { slotStepMinutes: 15, minNoticeMinutes: 60, maxAdvanceDays: 45, cancelNoticeMinutes: 60 }, services: [] });
    api.staff.mockResolvedValue({ items: [{ id: "staff-1", name: "Sofía Romano" }, { id: "staff-2", name: "Lucía Costa" }], pageInfo: { hasMore: false, nextOffset: null } });
    api.resolve.mockResolvedValue(appointment);
    api.availability.mockImplementation((_slug: string, _appointmentId: string, _token: string, query: { fromDate: string; toDate: string }) => Promise.resolve({
      slots: slotDate >= query.fromDate && slotDate < query.toDate ? [newSlot] : [], hasMore: false, nextCursor: null, timeZone,
    }));
    api.cancel.mockResolvedValue({ ...appointment, status: "CANCELLED", version: 8 });
    api.reschedule.mockResolvedValue({ ...appointment, startAt: newSlot.startAt, endAt: newSlot.endAt, version: 8 });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

  it("cleans the private fragment before resolving and rebooks using live availability and assignment only", async () => {
    render(<PublicBookingManagementScreen slug="estudio" />);
    expect(await screen.findByText("Consulta inicial")).toBeTruthy();
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith("estudio", token, expect.any(AbortSignal)));
    expect(window.location.hash).toBe("");
    expect(screen.queryByText("Lucas Gómez")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reprogramar reserva" }));
    expect(await screen.findByRole("dialog", { name: "Reprogramar reserva" })).toBeTruthy();
    expect(await screen.findByRole("radio", { name: /Sofía Romano/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Cualquier especialista/ }));
    await waitFor(() => expect(api.availability).toHaveBeenCalledWith("estudio", "appointment-1", token,
      expect.objectContaining({ selection: "ANY", fromDate: expect.any(String), toDate: expect.any(String) }), 7, expect.any(AbortSignal)));

    fireEvent.click(await screen.findByRole("button", { name: `Elegir ${localDateLabel(slotDate)}` }));
    fireEvent.click(await screen.findByRole("radio", { name: "13:00" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reprogramación" }));
    await waitFor(() => expect(api.reschedule).toHaveBeenCalledWith("estudio", "appointment-1", {
      token, startAt: newSlot.startAt, assignment: { kind: "ANY" },
    }, 7));
    expect(await screen.findByText("Reserva actualizada")).toBeTruthy();
    expect(api.reschedule.mock.calls[0]?.[2]).not.toHaveProperty("serviceId");
    expect(api.reschedule.mock.calls[0]?.[2]).not.toHaveProperty("customer");
  });

  it("uses NONE for a service without professional assignment and does not render professional choices", async () => {
    api.resolve.mockResolvedValue({ ...appointment, staffName: null, staffSelectionMode: "NO_ASSIGNMENT", assignment: { kind: "NONE" }, actions: { canCancel: true, canReschedule: true } });
    render(<PublicBookingManagementScreen slug="estudio" />);
    await screen.findByText("Consulta inicial");
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar reserva" }));
    expect(await screen.findByText("Este servicio no requiere profesional.")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Profesional" })).toBeNull();
    await waitFor(() => expect(api.availability).toHaveBeenCalledWith("estudio", "appointment-1", token,
      expect.objectContaining({ selection: "NONE" }), 7, expect.any(AbortSignal)));
  });

  it("keeps AUTO_ASSIGN automatic and submits ANY without offering professional selection", async () => {
    api.resolve.mockResolvedValue({ ...appointment, staffName: null, staffSelectionMode: "AUTO_ASSIGN", assignment: { kind: "ANY" }, actions: { canCancel: true, canReschedule: true } });
    render(<PublicBookingManagementScreen slug="estudio" />);
    await screen.findByText("Consulta inicial");
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar reserva" }));
    expect(await screen.findByText(/asignará un profesional disponible/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Profesional" })).toBeNull();
    await waitFor(() => expect(api.availability).toHaveBeenCalledWith("estudio", "appointment-1", token,
      expect.objectContaining({ selection: "ANY" }), 7, expect.any(AbortSignal)));
    fireEvent.click(await screen.findByRole("button", { name: `Elegir ${localDateLabel(slotDate)}` }));
    fireEvent.click(await screen.findByRole("radio", { name: "13:00" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reprogramación" }));
    await waitFor(() => expect(api.reschedule).toHaveBeenCalledWith("estudio", "appointment-1", {
      token, startAt: newSlot.startAt, assignment: { kind: "ANY" },
    }, 7));
  });

  it("sends the public cancellation contract and shows the terminal cancelled state", async () => {
    render(<PublicBookingManagementScreen slug="estudio" />);
    await screen.findByText("Consulta inicial");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar reserva" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cancelar reserva" }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("estudio", "appointment-1", { token, reasonCode: "CUSTOMER_REQUEST" }, 7));
    expect(await screen.findByText("Reserva cancelada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reprogramar reserva" })).toBeNull();
  });

  it("shows an invalid-link state without sending an empty token to the API", async () => {
    window.history.replaceState(null, "", "/reservar/estudio/gestionar");
    render(<PublicBookingManagementScreen slug="estudio" />);
    expect(await screen.findByText("Enlace no válido")).toBeTruthy();
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it("keeps the rescheduling modal open and reports a slot conflict for recovery", async () => {
    api.reschedule.mockRejectedValue(new ApiError(409, "SLOT_UNAVAILABLE", "Conflict"));
    render(<PublicBookingManagementScreen slug="estudio" />);
    await screen.findByText("Consulta inicial");
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar reserva" }));
    fireEvent.click(await screen.findByRole("button", { name: `Elegir ${localDateLabel(slotDate)}` }));
    fireEvent.click(await screen.findByRole("radio", { name: "13:00" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reprogramación" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Reprogramar reserva" })).toBeTruthy();
  });
});
