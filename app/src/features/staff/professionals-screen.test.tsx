/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffDTO, StaffPageDTO, StaffServicePageDTO, StaffSummaryDTO } from "@/lib/api/contracts";

const mocks = vi.hoisted(() => ({
  snapshot: null as unknown,
  preflight: vi.fn(async () => undefined),
  listStaff: vi.fn(), readStaff: vi.fn(), addStaff: vi.fn(), saveStaff: vi.fn(), listStaffServices: vi.fn(),
}));
vi.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ snapshot: mocks.snapshot, preflight: mocks.preflight }) }));
vi.mock("@/features/staff/staff-adapter", () => ({
  listStaff: mocks.listStaff, readStaff: mocks.readStaff, addStaff: mocks.addStaff,
  saveStaff: mocks.saveStaff, listStaffServices: mocks.listStaffServices,
}));

import { ProfessionalsScreen } from "./professionals-screen";

const summary = (overrides: Partial<StaffSummaryDTO> = {}): StaffSummaryDTO => ({
  id: "staff-1", organizationId: "org-1", name: "Sofía Romano", active: true, version: 1,
  createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", ...overrides,
});
const detail = (overrides: Partial<StaffDTO> = {}): StaffDTO => ({ ...summary(), email: "sofia@example.test", phone: "11 5555 0101", userId: null, ...overrides });
const page = (item: StaffSummaryDTO): StaffPageDTO => ({
  items: [item], pageInfo: { limit: 25, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false },
});
const services: StaffServicePageDTO = {
  items: [{ organizationId: "org-1", staffMemberId: "staff-1", serviceId: "service-1", createdAt: "2026-10-14T00:00:00.000Z", staff: { id: "staff-1", name: "Sofía Romano", active: true }, service: { id: "service-1", name: "Corte", active: true } }],
  pageInfo: { limit: 25, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false },
};
function setRole(role: "OWNER" | "ADMIN" | "EMPLOYEE", organizationId = "org-1", userId = "user-1") {
  mocks.snapshot = {
    user: { id: userId, name: "Test", email: "test@example.test", emailVerifiedAt: null },
    memberships: [{ id: "membership-1", role, organization: { id: organizationId } }],
    activeOrganizationId: organizationId,
    access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: false },
    onboarding: { canCreateOrganization: false, reason: "HAS_MEMBERSHIP" },
  };
}

describe("ProfessionalsScreen keeps staff separate from organization access", () => {
  beforeEach(() => {
    setRole("OWNER");
    mocks.preflight.mockResolvedValue(undefined);
    mocks.listStaff.mockResolvedValue(page(summary()));
    mocks.readStaff.mockResolvedValue(detail());
    mocks.addStaff.mockImplementation(async (_organizationId: string, input: object) => ({ ...detail(), ...input, id: "staff-new", version: 1 }));
    mocks.saveStaff.mockImplementation(async (_organizationId: string, id: string, input: object, version: number) => ({ ...detail(), ...input, id, version: version + 1 }));
    mocks.listStaffServices.mockResolvedValue(services);
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("lets EMPLOYEE read a minimal directory without requesting contact details or showing management controls", async () => {
    setRole("EMPLOYEE");
    render(<ProfessionalsScreen />);
    expect(await screen.findByText("Sofía Romano")).toBeTruthy();
    expect(mocks.listStaff).toHaveBeenCalledWith("org-1", { limit: 25, offset: 0, status: "active" }, expect.any(AbortSignal));
    expect(mocks.readStaff).not.toHaveBeenCalled();
    expect(mocks.listStaffServices).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Nuevo profesional" })).toBeNull();
    expect(screen.queryByLabelText("Correo" )).toBeNull();
    expect(screen.getByText("Profesionales" )).toBeTruthy();
  });

  it("creates a staff record with optional contacts and does not create an account or membership", async () => {
    render(<ProfessionalsScreen />);
    await screen.findByRole("button", { name: /Sofía Romano/ });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lucía Pérez" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "lucia@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar profesional" }));
    await waitFor(() => expect(mocks.addStaff).toHaveBeenCalledWith("org-1", { name: "Lucía Pérez", email: "lucia@example.test", phone: null }));
    expect(JSON.stringify(mocks.addStaff.mock.calls[0])).not.toMatch(/role|password|invitation|membership|userId/i);
    expect(await screen.findByText("Profesional agregado")).toBeTruthy();
  });

  it("loads administrative contact details and associated services only after opening a professional", async () => {
    render(<ProfessionalsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Sofía Romano/ }));
    expect(await screen.findByText("sofia@example.test")).toBeTruthy();
    expect(await screen.findByText("Corte")).toBeTruthy();
    expect(mocks.readStaff).toHaveBeenCalledWith("org-1", "staff-1", expect.any(AbortSignal));
    expect(mocks.listStaffServices).toHaveBeenCalledWith("org-1", "staff-1", { limit: 25, offset: 0, status: "all" }, expect.any(AbortSignal));
  });

  it("edits a staff record with its version and archives it without changing membership data", async () => {
    render(<ProfessionalsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Sofía Romano/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Sofía R." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.saveStaff).toHaveBeenCalledWith("org-1", "staff-1", { name: "Sofía R.", email: "sofia@example.test", phone: "11 5555 0101" }, 1));
    expect(await screen.findByText("Cambios guardados")).toBeTruthy();
    expect(JSON.stringify(mocks.saveStaff.mock.calls[0])).not.toMatch(/role|password|invitation|membership|userId/i);
  });

  it("archives a professional through the versioned staff update", async () => {
    render(<ProfessionalsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Sofía Romano/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    await waitFor(() => expect(mocks.saveStaff).toHaveBeenCalledWith("org-1", "staff-1", { active: false }, 1));
    expect(await screen.findByText("Profesional archivado")).toBeTruthy();
  });

  it("discards a late directory response after changing organization", async () => {
    let resolveOld!: (value: StaffPageDTO) => void;
    mocks.listStaff.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<ProfessionalsScreen />);
    await waitFor(() => expect(mocks.listStaff).toHaveBeenCalledTimes(1));
    setRole("OWNER", "org-2", "user-2");
    mocks.listStaff.mockResolvedValue(page(summary({ id: "staff-2", organizationId: "org-2", name: "Nuevo tenant" })));
    view.rerender(<ProfessionalsScreen />);
    expect(await screen.findByText("Nuevo tenant")).toBeTruthy();
    resolveOld(page(summary({ name: "Respuesta antigua" })));
    await waitFor(() => expect(screen.queryByText("Respuesta antigua")).toBeNull());
  });
});
