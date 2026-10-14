/** @vitest-environment jsdom */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MembersScreen } from "./members-screen";
import * as browserApi from "@/lib/api/browser";
import type { InvitationDTO, MemberDetailDTO } from "@/lib/api/contracts";

vi.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({
    snapshot: {
      user: { id: "user-1", name: "Martín Silva", email: "martin@estudionuari.com" },
      activeOrganizationId: "org-1",
      memberships: [
        {
          id: "mem-1",
          role: "OWNER",
          organization: { id: "org-1", name: "Estudio Nuari", slug: "estudio-nuari" },
        },
      ],
      access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: true },
      onboarding: { canCreateOrganization: false, reason: "ELIGIBLE" },
    },
  }),
}));

const mockMembers: MemberDetailDTO[] = [
  {
    id: "mem-1",
    userId: "user-1",
    name: "Martín Silva",
    email: "martin@estudionuari.com",
    role: "OWNER",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "mem-2",
    userId: "user-2",
    name: "Sofía Romano",
    email: "sofia@estudionuari.com",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "mem-3",
    userId: "user-3",
    name: "Lucas Gómez",
    email: "lucas@estudionuari.com",
    role: "EMPLOYEE",
    status: "ACTIVE",
    createdAt: "2026-01-03T00:00:00Z",
    updatedAt: "2026-01-03T00:00:00Z",
  },
];

const mockInvitations: InvitationDTO[] = [
  {
    id: "inv-1",
    organizationId: "org-1",
    email: "ana.lopez@gmail.com",
    role: "EMPLOYEE",
    createdAt: "2026-01-04T00:00:00Z",
    expiresAt: "2026-01-11T00:00:00Z",
    acceptedAt: null,
    revokedAt: null,
  },
];

describe("MembersScreen", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.spyOn(browserApi, "getMembers").mockResolvedValue(mockMembers);
    vi.spyOn(browserApi, "getInvitations").mockResolvedValue(mockInvitations);
    vi.spyOn(browserApi, "createInvitation").mockResolvedValue({
      invitation: mockInvitations[0],
      token: "dummy-token",
    });
    vi.spyOn(browserApi, "updateMemberRole").mockResolvedValue(mockMembers[1]);
    vi.spyOn(browserApi, "removeMember").mockResolvedValue(mockMembers[2]);
    vi.spyOn(browserApi, "revokeInvitation").mockResolvedValue({ success: true });
  });

  it("renders active members and invitations cards", async () => {
    render(<MembersScreen />);

    expect(screen.getByRole("heading", { name: "Miembros y accesos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invitar miembro" })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Martín Silva")).toBeTruthy();
      expect(screen.getByText("Sofía Romano")).toBeTruthy();
      expect(screen.getByText("Lucas Gómez")).toBeTruthy();
      expect(screen.getByText("ana.lopez@gmail.com")).toBeTruthy();
    });
  });

  it("filters members by search query", async () => {
    render(<MembersScreen />);

    await waitFor(() => {
      expect(screen.getByText("Sofía Romano")).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText("Buscar por nombre o correo...");
    fireEvent.change(searchInput, { target: { value: "Sofía" } });

    expect(screen.getByText("Sofía Romano")).toBeTruthy();
    expect(screen.queryByText("Lucas Gómez")).toBeNull();
  });

  it("opens invite modal and submits invitation", async () => {
    render(<MembersScreen />);

    const inviteBtn = screen.getByRole("button", { name: "Invitar miembro" });
    fireEvent.click(inviteBtn);

    expect(screen.getByText("Enviaremos un correo electrónico con un enlace seguro para unirse a tu organización. Expira en 7 días.")).toBeTruthy();

    const emailInput = screen.getByLabelText("Correo electrónico");
    fireEvent.change(emailInput, { target: { value: "nuevo@correo.com" } });

    const submitBtn = screen.getByRole("button", { name: "Enviar invitación" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(browserApi.createInvitation).toHaveBeenCalledWith("org-1", {
        email: "nuevo@correo.com",
        role: "EMPLOYEE",
      });
    });
  });

  it("opens manage access modal for an editable member", async () => {
    render(<MembersScreen />);

    await waitFor(() => {
      expect(screen.getByText("Lucas Gómez")).toBeTruthy();
    });

    const manageButtons = screen.getAllByRole("button", { name: "Gestionar" });
    // Lucas is the third member (index 2)
    fireEvent.click(manageButtons[2]);

    expect(screen.getByRole("button", { name: "Revocar acceso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar nuevo rol" })).toBeTruthy();
  });

  it("removes a revoked member from the active list after refreshing", async () => {
    const getMembers = vi.spyOn(browserApi, "getMembers");
    getMembers.mockResolvedValueOnce(mockMembers).mockResolvedValueOnce(mockMembers.filter((member) => member.id !== "mem-3"));
    render(<MembersScreen />);
    await screen.findByText("Lucas Gómez");
    fireEvent.click(screen.getAllByRole("button", { name: "Gestionar" })[2]!);
    fireEvent.click(screen.getByRole("button", { name: "Revocar acceso" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, revocar" }));
    await waitFor(() => expect(screen.queryByText("Lucas Gómez")).toBeNull());
    expect(browserApi.removeMember).toHaveBeenCalledWith("org-1", "mem-3");
    expect(getMembers.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
