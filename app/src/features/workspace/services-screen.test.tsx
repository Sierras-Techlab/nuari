/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceCategoryDTO, ServiceDTO, ServicePageDTO, StaffServiceDTO, StaffSummaryDTO } from "@/lib/api/contracts";

const mocks = vi.hoisted(() => ({
  snapshot: null as unknown,
  preflight: vi.fn(async () => undefined),
  listServices: vi.fn(), listServiceCategories: vi.fn(), readService: vi.fn(), addService: vi.fn(), saveService: vi.fn(),
  listStaff: vi.fn(), listServiceStaff: vi.fn(), assignStaffToService: vi.fn(), unassignStaffFromService: vi.fn(),
  addServiceCategory: vi.fn(), saveServiceCategory: vi.fn(),
}));
vi.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ snapshot: mocks.snapshot, preflight: mocks.preflight }) }));
vi.mock("@/features/service-catalog/service-catalog-adapter", () => ({
  listServices: mocks.listServices, listServiceCategories: mocks.listServiceCategories, readService: mocks.readService,
  addService: mocks.addService, saveService: mocks.saveService, listStaff: mocks.listStaff, listServiceStaff: mocks.listServiceStaff,
  assignStaffToService: mocks.assignStaffToService, unassignStaffFromService: mocks.unassignStaffFromService,
  addServiceCategory: mocks.addServiceCategory, saveServiceCategory: mocks.saveServiceCategory,
}));

import { ServicesScreen } from "./services-screen";

const service = (overrides: Partial<ServiceDTO> = {}): ServiceDTO => ({
  id: "service-1", organizationId: "org-1", name: "Corte", description: "Corte clásico", durationMinutes: 40,
  pricingType: "FIXED", price: "12500.00", currency: "ARS", categoryId: "category-1", active: true, sortOrder: 0,
  staffSelectionMode: "CUSTOMER_CHOICE", modality: "IN_PERSON", version: 1,
  createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", ...overrides,
});
const category = (overrides: Partial<ServiceCategoryDTO> = {}): ServiceCategoryDTO => ({
  id: "category-1", organizationId: "org-1", name: "Cabello", active: true, sortOrder: 0, version: 1,
  createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", ...overrides,
});
const staff = (): StaffSummaryDTO => ({
  id: "staff-1", organizationId: "org-1", name: "Mara", active: true, version: 1,
  createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
});
const page = (item: ServiceDTO = service()): ServicePageDTO => ({
  items: [item], pageInfo: { limit: 25, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false },
});
function setRole(role: "OWNER" | "ADMIN" | "EMPLOYEE", organizationId = "org-1", userId = "user-1") {
  mocks.snapshot = {
    user: { id: userId, name: "Test", email: "test@example.test", emailVerifiedAt: null },
    memberships: [{ id: "membership-1", role, organization: { id: organizationId } }],
    activeOrganizationId: organizationId,
    access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: false },
    onboarding: { canCreateOrganization: false, reason: "HAS_MEMBERSHIP" },
  };
}

describe("ServicesScreen backed by service catalog APIs", () => {
  beforeEach(() => {
    setRole("OWNER");
    mocks.preflight.mockResolvedValue(undefined);
    mocks.listServices.mockResolvedValue(page());
    mocks.listServiceCategories.mockResolvedValue({ items: [category()], pageInfo: { limit: 100, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false } });
    mocks.readService.mockResolvedValue(service());
    mocks.listStaff.mockResolvedValue({ items: [staff()], pageInfo: { limit: 100, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false } });
    mocks.listServiceStaff.mockResolvedValue({ items: [], pageInfo: { limit: 100, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false } });
    mocks.addService.mockImplementation(async (_organizationId: string, input: object) => ({ ...service(), ...input, id: "service-new", version: 1 }));
    mocks.saveService.mockImplementation(async (_organizationId: string, id: string, input: object, version: number) => ({ ...service(), ...input, id, version: version + 1 }));
    mocks.addServiceCategory.mockResolvedValue(category({ id: "category-new" }));
    mocks.saveServiceCategory.mockResolvedValue(category());
    mocks.assignStaffToService.mockResolvedValue({ association: {} as StaffServiceDTO, serviceVersion: 2 });
    mocks.unassignStaffFromService.mockResolvedValue({ serviceVersion: 2 });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("keeps monetary prices as decimal strings and requires an explicit assignment mode", async () => {
    render(<ServicesScreen />);
    await screen.findByRole("button", { name: /Corte/ });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Evaluación" } });
    fireEvent.change(screen.getByLabelText("Duración en minutos"), { target: { value: "720" } });
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "FIXED" } });
    fireEvent.change(screen.getByLabelText("Importe decimal"), { target: { value: "1234567890.05" } });
    fireEvent.change(screen.getByLabelText("Asignación profesional"), { target: { value: "AUTO_ASSIGN" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    await waitFor(() => expect(mocks.addService).toHaveBeenCalledWith("org-1", {
      name: "Evaluación", description: null, durationMinutes: 720, pricingType: "FIXED", price: "1234567890.05",
      categoryId: null, sortOrder: 0, staffSelectionMode: "AUTO_ASSIGN", modality: "IN_PERSON",
    }));
  });

  it("shows linked professionals from service detail and uses the service version for association changes", async () => {
    render(<ServicesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Corte/ }));
    expect(await screen.findByText(/No hay profesionales activos habilitados/)).toBeTruthy();
    expect(screen.queryByText(/disponible ahora|disponibilidad confirmada/i)).toBeNull();
    fireEvent.change(await screen.findByLabelText("Profesional para habilitar"), { target: { value: "staff-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Habilitar profesional" }));
    await waitFor(() => expect(mocks.assignStaffToService).toHaveBeenCalledWith("org-1", "service-1", "staff-1", 1));
  });

  it("keeps the saved decimal and inactive category visible when editing a service", async () => {
    mocks.listServiceCategories.mockResolvedValue({ items: [category({ active: false })], pageInfo: { limit: 100, offset: 0, hasMore: false, nextOffset: null, windowLimitReached: false } });
    render(<ServicesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Corte/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect((screen.getByLabelText("Importe decimal") as HTMLInputElement).value).toBe("12500.00");
    expect(screen.getByRole("option", { name: "Cabello (archivada)" })).toBeTruthy();
  });

  it("loads server-side search, filters and page offsets", async () => {
    mocks.listServices.mockResolvedValue({
      ...page(), pageInfo: { limit: 25, offset: 0, hasMore: true, nextOffset: 25, windowLimitReached: false },
    });
    render(<ServicesScreen />);
    await screen.findByRole("button", { name: /Corte/ });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "inactive" } });
    fireEvent.change(screen.getByLabelText("Asignación"), { target: { value: "AUTO_ASSIGN" } });
    await waitFor(() => expect(mocks.listServices).toHaveBeenCalledWith("org-1", expect.objectContaining({
      limit: 25, offset: 0, status: "inactive", staffSelectionMode: "AUTO_ASSIGN",
    }), expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Buscar servicios"), { target: { value: "Consulta" } });
    await waitFor(() => expect(mocks.listServices).toHaveBeenCalledWith("org-1", expect.objectContaining({
      limit: 25, offset: 0, status: "inactive", q: "Consulta", staffSelectionMode: "AUTO_ASSIGN",
    }), expect.any(AbortSignal)), { timeout: 1500 });
    fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(mocks.listServices).toHaveBeenCalledWith("org-1", expect.objectContaining({
      limit: 25, offset: 25, status: "inactive", q: "Consulta", staffSelectionMode: "AUTO_ASSIGN",
    }), expect.any(AbortSignal)));
  });

  it("keeps the catalog read-only for EMPLOYEE", async () => {
    setRole("EMPLOYEE");
    render(<ServicesScreen />);
    await screen.findByRole("button", { name: /Corte/ });
    expect(screen.queryByRole("button", { name: "Agregar servicio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar categoría" })).toBeNull();
  });
});
