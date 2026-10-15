/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ catalog: vi.fn(), staff: vi.fn(), availability: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/api/browser", () => ({
  getPublicBookingCatalog: api.catalog,
  getPublicBookingStaff: api.staff,
  getPublicAvailability: api.availability,
  createPublicBooking: api.create,
}));

import { PublicBookingScreen } from "./public-booking-screen";
import { businessToday } from "./public-booking-date";

const today = businessToday("America/Argentina/Buenos_Aires");
const catalog = {
  organization: { id: "org-1", name: "Estudio Nuari", timezone: "America/Argentina/Buenos_Aires", currency: "ARS" },
  timeZone: "America/Argentina/Buenos_Aires",
  policy: { slotStepMinutes: 10, minNoticeMinutes: 120, maxAdvanceDays: 60, cancelNoticeMinutes: 120 },
  services: [{ id: "service-1", name: "Consulta inicial", description: "Una consulta para empezar.", durationMinutes: 40, pricingType: "ON_REQUEST", price: null, currency: "ARS", staffSelectionMode: "CUSTOMER_CHOICE", staff: [{ id: "staff-1", name: "Sofía Romano" }], staffPage: { limit: 50, hasMore: false, nextOffset: null } }],
};

describe("PublicBookingScreen", () => {
  beforeEach(() => {
    api.catalog.mockResolvedValue(catalog);
    api.staff.mockResolvedValue({ items: [], pageInfo: { hasMore: false, nextOffset: null } });
    api.availability.mockResolvedValue({ slots: [{ startAt: `${today}T13:30:00.000Z`, endAt: `${today}T14:10:00.000Z`, localDate: today, localTime: "10:30", offset: "-03:00", timeZone: catalog.timeZone, staff: [] }], hasMore: false, nextCursor: null, timeZone: catalog.timeZone });
    api.create.mockResolvedValue({ id: "appointment-1", status: "CONFIRMED", startAt: `${today}T13:30:00.000Z`, endAt: `${today}T14:10:00.000Z`, durationMinutes: 40, serviceName: "Consulta inicial", staffName: "Sofía Romano", timeZone: catalog.timeZone, version: 1, managementToken: "m".repeat(43) });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("uses backend service, specialist, availability and idempotent booking without promising email delivery", async () => {
    render(<PublicBookingScreen slug="estudio-nuari" />);
    await screen.findByText("¿Qué necesitas hoy?");
    fireEvent.click(await screen.findByRole("button", { name: /consulta inicial/i }));
    expect(await screen.findByRole("radio", { name: /cualquier especialista/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /cualquier especialista/i }));
    expect(await screen.findByRole("radio", { name: "10:30" })).toBeTruthy();
    expect(api.availability).toHaveBeenCalledWith("estudio-nuari", expect.objectContaining({ serviceId: "service-1", selection: "ANY", fromDate: expect.any(String), toDate: expect.any(String) }), expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("radio", { name: "10:30" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]!);
    fireEvent.change(await screen.findByLabelText("Nombre completo"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText(/Teléfono/), { target: { value: "+5491112345678" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Confirmar reserva" })[0]!);

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("estudio-nuari", expect.objectContaining({
      serviceId: "service-1", startAt: `${today}T13:30:00.000Z`, assignment: { kind: "ANY" },
      customer: { name: "Ana Pérez", phone: "+5491112345678" },
    }), expect.stringMatching(/^[0-9a-f-]{36}$/i)));
    expect(await screen.findByText("¡Reserva confirmada!" )).toBeTruthy();
    expect(screen.queryByText(/te enviaremos/i)).toBeNull();
    expect(screen.getByRole("link", { name: /gestionar reserva/i }).getAttribute("href")).toMatch(/^\/reservar\/estudio-nuari\/gestionar#m{43}$/);
  });

  it.each([
    ["AUTO_ASSIGN", "ANY"],
    ["NO_ASSIGNMENT", "NONE"],
  ] as const)("requests real availability for %s with assignment %s", async (mode, selection) => {
    api.catalog.mockResolvedValue({ ...catalog, services: [{ ...catalog.services[0], staffSelectionMode: mode, staff: undefined, staffPage: undefined }] });
    render(<PublicBookingScreen slug="estudio-nuari" />);
    fireEvent.click(await screen.findByRole("button", { name: /consulta inicial/i }));
    expect(await screen.findByRole("radio", { name: "10:30" })).toBeTruthy();
    expect(api.availability).toHaveBeenCalledWith("estudio-nuari", expect.objectContaining({ serviceId: "service-1", selection }), expect.any(AbortSignal));
  });
});
