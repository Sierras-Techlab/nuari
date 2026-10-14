/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerDTO, CustomerPageDTO, CustomerSummaryDTO } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  snapshot: null as unknown,
  preflight: vi.fn(async () => undefined),
  listCustomers: vi.fn(), readCustomer: vi.fn(), addCustomer: vi.fn(), saveCustomer: vi.fn(), findCustomerCandidates: vi.fn(),
}));
vi.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ snapshot: mocks.snapshot, preflight: mocks.preflight }) }));
vi.mock("@/features/customers/customer-adapter", () => ({
  listCustomers: mocks.listCustomers, readCustomer: mocks.readCustomer, addCustomer: mocks.addCustomer,
  saveCustomer: mocks.saveCustomer, findCustomerCandidates: mocks.findCustomerCandidates,
}));

import { ClientsScreen } from "./clients-screen";

const summary = (overrides: Partial<CustomerSummaryDTO> = {}): CustomerSummaryDTO => ({
  id: "customer-1", organizationId: "org-1", name: "Elena Ruiz", phone: "11 5555 9090", email: "elena@example.test",
  active: true, version: 1, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", ...overrides,
});
const detail = (overrides: Partial<CustomerDTO> = {}): CustomerDTO => ({ ...summary(), notes: "Nota privada", ...overrides });
const page = (item: CustomerSummaryDTO): CustomerPageDTO => ({
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

describe("ClientsScreen backed by the customer API", () => {
  beforeEach(() => {
    setRole("OWNER");
    mocks.preflight.mockResolvedValue(undefined);
    mocks.listCustomers.mockResolvedValue(page(summary()));
    mocks.readCustomer.mockResolvedValue(detail());
    mocks.addCustomer.mockImplementation(async (_organizationId: string, input: object) => ({ ...detail(), ...input, id: "customer-new", version: 1 }));
    mocks.saveCustomer.mockImplementation(async (_organizationId: string, id: string, input: object, version: number) => ({ ...detail(), ...input, id, version: version + 1 }));
    mocks.findCustomerCandidates.mockResolvedValue({ items: [], hasMore: false });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("lets EMPLOYEE view, create and edit customers without notes or archive controls", async () => {
    setRole("EMPLOYEE");
    mocks.readCustomer.mockResolvedValue({ ...summary(), notes: undefined });
    render(<ClientsScreen />);
    const row = await screen.findByRole("button", { name: /Elena Ruiz/ });
    fireEvent.click(row);
    expect(await screen.findByText("Ficha de cliente")).toBeTruthy();
    expect(screen.queryByLabelText("Notas internas")).toBeNull();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Elena R." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.saveCustomer).toHaveBeenCalledWith("org-1", "customer-1", {
      name: "Elena R.", phone: "11 5555 9090", email: "elena@example.test",
    }, 1));
    expect(await screen.findByText("Cambios guardados")).toBeTruthy();
  });

  it("creates a customer with name only and preserves the draft after a stale-version error", async () => {
    render(<ClientsScreen />);
    await screen.findByRole("button", { name: /Elena Ruiz/ });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María López" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar cliente" }));
    await waitFor(() => expect(mocks.addCustomer).toHaveBeenCalledWith("org-1", { name: "María López", phone: null, email: null, notes: null }));
    expect(await screen.findByText("Cliente agregado")).toBeTruthy();

    mocks.readCustomer.mockResolvedValue(detail());
    fireEvent.click(await screen.findByRole("button", { name: /Elena Ruiz/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Borrador" } });
    mocks.saveCustomer.mockRejectedValueOnce(new ApiError(412, "VERSION_CONFLICT", "El cliente cambió. Recargá y conciliá los cambios."));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Recargá y conciliá");
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Borrador");
  });

  it("sends search, status and pagination to the API instead of filtering a partial client page", async () => {
    mocks.listCustomers.mockResolvedValue({
      ...page(summary()),
      pageInfo: { limit: 25, offset: 0, hasMore: true, nextOffset: 25, windowLimitReached: false },
    });
    render(<ClientsScreen />);
    await screen.findByRole("button", { name: /Elena Ruiz/ });
    expect(mocks.listCustomers).toHaveBeenCalledWith("org-1", { limit: 25, offset: 0, status: "active" }, expect.any(AbortSignal));
    fireEvent.change(screen.getByLabelText("Estado de clientes"), { target: { value: "inactive" } });
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledWith("org-1", { limit: 25, offset: 0, status: "inactive" }, expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Buscar clientes"), { target: { value: "Valentina" } });
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledWith("org-1", { limit: 25, offset: 0, status: "inactive", q: "Valentina" }, expect.any(AbortSignal)), { timeout: 1500 });
    fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledWith("org-1", { limit: 25, offset: 25, status: "inactive", q: "Valentina" }, expect.any(AbortSignal)));
  });

  it("shows duplicate candidates as a warning and still allows saving", async () => {
    mocks.findCustomerCandidates.mockResolvedValue({ items: [summary({ id: "possible", name: "Otra Elena" })], hasMore: false });
    render(<ClientsScreen />);
    await screen.findByRole("button", { name: /Elena Ruiz/ });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Elena nueva" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "elena@example.test" } });
    expect(await screen.findByText(/Posibles coincidencias/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar cliente" }));
    await waitFor(() => expect(mocks.addCustomer).toHaveBeenCalled());
  });

  it("discards a late list response when the active organization changes", async () => {
    let resolveOld!: (value: CustomerPageDTO) => void;
    mocks.listCustomers.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(<ClientsScreen />);
    await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledTimes(1));
    setRole("OWNER", "org-2", "user-2");
    mocks.listCustomers.mockResolvedValue(page(summary({ id: "customer-2", organizationId: "org-2", name: "Nuevo tenant" })));
    view.rerender(<ClientsScreen />);
    expect(await screen.findByRole("button", { name: /Nuevo tenant/ })).toBeTruthy();
    resolveOld(page(summary({ name: "Respuesta antigua" })));
    await waitFor(() => expect(screen.queryByText("Respuesta antigua")).toBeNull());
  });
});
