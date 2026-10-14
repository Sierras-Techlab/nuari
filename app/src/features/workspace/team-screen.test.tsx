/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccess } from "@/features/access/access-provider";
import * as browserApi from "@/lib/api/browser";
import type { InvitationDTO, MemberDetailDTO, OrganizationRole } from "@/lib/api/contracts";
import { TeamScreen } from "./team-screen";

vi.mock("@/features/access/access-provider", () => ({ useAccess: vi.fn() }));

const members: MemberDetailDTO[] = [
  { id: "mem-1", userId: "user-1", name: "Martín Silva", email: "martin@example.test", role: "OWNER", status: "ACTIVE", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { id: "mem-2", userId: "user-2", name: "Sofía Romano", email: "sofia@example.test", role: "ADMIN", status: "ACTIVE", createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" },
  { id: "mem-3", userId: "user-3", name: "Lucas Gómez", email: "lucas@example.test", role: "EMPLOYEE", status: "ACTIVE", createdAt: "2026-01-03T00:00:00Z", updatedAt: "2026-01-03T00:00:00Z" },
];
const invitations: InvitationDTO[] = [
  { id: "inv-1", organizationId: "org-1", email: "ana@example.test", role: "EMPLOYEE", createdAt: "2026-01-04T00:00:00Z", expiresAt: "2026-12-31T00:00:00Z", acceptedAt: null, revokedAt: null },
];
function mockAccess(role: OrganizationRole) {
  vi.mocked(useAccess).mockReturnValue({
    snapshot: {
      user: { id: "user-1", name: "Martín Silva", email: "martin@example.test", emailVerifiedAt: "2026-01-01T00:00:00Z" },
      activeOrganizationId: "org-1",
      memberships: [{ id: "mem-1", role, organization: { id: "org-1", name: "Estudio Nuari", slug: "estudio-nuari", businessType: "SERVICES", timezone: "America/Argentina/Buenos_Aires", currency: "ARS", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } }],
      access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: true },
      onboarding: { canCreateOrganization: false, reason: "HAS_MEMBERSHIP" },
    }, error: null, refresh: vi.fn(), select: vi.fn(), signOut: vi.fn(), preflight: vi.fn(),
  });
}

describe("TeamScreen organization access management", () => {
  beforeEach(() => {
    mockAccess("OWNER");
    vi.spyOn(browserApi, "getMembers").mockResolvedValue(members);
    vi.spyOn(browserApi, "getInvitations").mockResolvedValue(invitations);
    vi.spyOn(browserApi, "createInvitation").mockResolvedValue({ invitation: invitations[0], token: "test-token" });
    vi.spyOn(browserApi, "updateMemberRole").mockResolvedValue({ ...members[2], role: "ADMIN" });
    vi.spyOn(browserApi, "removeMember").mockResolvedValue(members[2]);
    vi.spyOn(browserApi, "revokeInvitation").mockResolvedValue({ success: true });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("keeps the Equipo design while listing live members and identifying the signed-in user", async () => {
    render(<TeamScreen />);
    expect(screen.getByRole("heading", { name: "Un equipo conectado." })).toBeTruthy();
    expect(screen.getByText("Personas del equipo")).toBeTruthy();
    expect(await screen.findByText("Martín Silva")).toBeTruthy();
    expect(screen.getByText(/\(Vos\)/)).toBeTruthy();
    expect(screen.getByText("Propietario")).toBeTruthy();
    expect(screen.getAllByText("Administrador").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Empleado").length).toBeGreaterThan(0);
    expect(await screen.findByText("ana@example.test")).toBeTruthy();
    expect(browserApi.getMembers).toHaveBeenCalledWith("org-1", expect.any(AbortSignal));
    expect(browserApi.getInvitations).toHaveBeenCalledWith("org-1", expect.any(AbortSignal));
    expect(screen.queryByText("Martín Ríos")).toBeNull();
  });

  it("searches by email and filters by organization role", async () => {
    render(<TeamScreen />);
    await screen.findByText("Sofía Romano");
    fireEvent.change(screen.getByLabelText("Buscar integrantes"), { target: { value: "lucas@example.test" } });
    expect(screen.getByText("Lucas Gómez")).toBeTruthy();
    expect(screen.queryByText("Sofía Romano")).toBeNull();
    fireEvent.change(screen.getByLabelText("Filtrar por rol"), { target: { value: "ADMIN" } });
    expect(screen.queryByText("Lucas Gómez")).toBeNull();
  });

  it("invites only roles available to the current role and refreshes after sending", async () => {
    render(<TeamScreen />);
    await screen.findByText("Lucas Gómez");
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "new@example.test" } });
    fireEvent.change(screen.getByLabelText("Rol de acceso"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));
    await waitFor(() => expect(browserApi.createInvitation).toHaveBeenCalledWith("org-1", { email: "new@example.test", role: "ADMIN" }));
    await waitFor(() => expect(browserApi.getInvitations).toHaveBeenCalledTimes(2));

    cleanup(); vi.clearAllMocks(); mockAccess("ADMIN");
    vi.spyOn(browserApi, "getMembers").mockResolvedValue(members);
    vi.spyOn(browserApi, "getInvitations").mockResolvedValue(invitations);
    render(<TeamScreen />);
    await screen.findByText("Lucas Gómez");
    const roleSelect = screen.getByLabelText("Rol de acceso");
    expect(roleSelect.querySelector('option[value="EMPLOYEE"]')).toBeTruthy();
    expect(roleSelect.querySelector('option[value="ADMIN"]')).toBeNull();
  });

  it("updates a member role and removes revoked members after refreshing", async () => {
    vi.spyOn(browserApi, "getMembers").mockResolvedValueOnce(members).mockResolvedValueOnce(members).mockResolvedValueOnce(members.filter((member) => member.id !== "mem-3"));
    render(<TeamScreen />);
    await screen.findByText("Lucas Gómez");
    fireEvent.click(screen.getAllByRole("button", { name: "Gestionar" })[2]);
    fireEvent.change(screen.getByLabelText("Rol en la organización"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nuevo rol" }));
    await waitFor(() => expect(browserApi.updateMemberRole).toHaveBeenCalledWith("org-1", "mem-3", "ADMIN"));
    await screen.findByText(/Rol actualizado/);

    fireEvent.click(screen.getAllByRole("button", { name: "Gestionar" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Revocar acceso" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, revocar" }));
    await waitFor(() => expect(screen.queryByText("Lucas Gómez")).toBeNull());
    expect(browserApi.removeMember).toHaveBeenCalledWith("org-1", "mem-3");
  });

  it("prevents an ADMIN from managing non-employee accounts", async () => {
    mockAccess("ADMIN");
    render(<TeamScreen />);
    await screen.findByText("Lucas Gómez");
    expect(screen.getAllByRole("button", { name: "Gestionar" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Enviar invitación" })).toBeTruthy();
    expect(screen.getByLabelText("Rol de acceso").querySelector('option[value="ADMIN"]')).toBeNull();
  });

  it("keeps EMPLOYEE accounts read-only and hides member administration", async () => {
    mockAccess("EMPLOYEE");
    render(<TeamScreen />);
    await screen.findByText("Lucas Gómez");
    expect(screen.queryByRole("button", { name: "Gestionar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar invitación" })).toBeNull();
    expect(screen.getByText("Tu rol permite consultar los miembros, pero no administrar accesos.")).toBeTruthy();
  });

  it("prevents the sole OWNER from changing or revoking the only owner account", async () => {
    vi.spyOn(browserApi, "getMembers").mockResolvedValue([members[0]]);
    render(<TeamScreen />);
    await screen.findByText("Martín Silva");
    fireEvent.click(screen.getByRole("button", { name: "Gestionar" }));
    expect(screen.getByRole("dialog").textContent).toContain("No podés modificar tu propio rol");
    expect(screen.queryByRole("button", { name: "Revocar acceso" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar nuevo rol" })).toBeNull();
  });

  it("shows invitation expiry and revokes pending invitations through the API", async () => {
    vi.spyOn(browserApi, "getInvitations").mockResolvedValueOnce(invitations).mockResolvedValueOnce([]);
    render(<TeamScreen />);
    await screen.findByText("ana@example.test");
    expect(screen.getAllByText(/vence/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Revocar/ }));
    await waitFor(() => expect(browserApi.revokeInvitation).toHaveBeenCalledWith("org-1", "inv-1"));
    await waitFor(() => expect(screen.queryByText("ana@example.test")).toBeNull());
  });

  it("shows loading and a retryable error state", async () => {
    let rejectMembers!: (reason: Error) => void;
    vi.spyOn(browserApi, "getMembers").mockImplementationOnce(() => new Promise((_, reject) => { rejectMembers = reject; }));
    render(<TeamScreen />);
    expect(screen.getAllByRole("status").some((state) => state.textContent?.includes("Cargando"))).toBe(true);
    await waitFor(() => expect(rejectMembers).toBeTypeOf("function"));
    rejectMembers(new Error("No se pudo cargar"));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Reintentar" }).length).toBeGreaterThan(0);
  });
});
