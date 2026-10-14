/** @vitest-environment jsdom */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { InvitationScreen } from "./invitation-screen";
import * as browserApi from "@/lib/api/browser";
import type { AccessSnapshot, PublicInvitationDTO } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockInvitation: PublicInvitationDTO = {
  id: "inv-1",
  organizationName: "Estudio Nuari",
  organizationSlug: "estudio-nuari",
  email: "martin@correo.com",
  role: "EMPLOYEE",
  expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockMatchingUserSnapshot: AccessSnapshot = {
  user: {
    id: "user-1",
    name: "Martín",
    email: "martin@correo.com",
    emailVerifiedAt: "2026-01-01T00:00:00Z",
  },
  activeOrganizationId: null,
  memberships: [],
  access: null,
  onboarding: { canCreateOrganization: true, reason: "ELIGIBLE" },
};

const mockMismatchUserSnapshot: AccessSnapshot = {
  user: {
    id: "user-2",
    name: "Otro Usuario",
    email: "otro@correo.com",
    emailVerifiedAt: "2026-01-01T00:00:00Z",
  },
  activeOrganizationId: "org-2",
  memberships: [
    {
      id: "mem-2",
      role: "EMPLOYEE",
      organization: {
        id: "org-2",
        name: "Otra Org",
        slug: "otra-org",
        businessType: "SERVICES",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
    },
  ],
  access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: true },
  onboarding: { canCreateOrganization: false, reason: "HAS_MEMBERSHIP" },
};

const mockUnverifiedUserSnapshot: AccessSnapshot = {
  user: {
    id: "user-3",
    name: "Sin Verificar",
    email: "martin@correo.com",
    emailVerifiedAt: null,
  },
  activeOrganizationId: null,
  memberships: [],
  access: null,
  onboarding: { canCreateOrganization: false, reason: "EMAIL_UNVERIFIED" },
};

describe("InvitationScreen", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders VALID_NO_AUTH state when user is not logged in", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockResolvedValue(mockInvitation);
    vi.spyOn(browserApi, "getSnapshot").mockRejectedValue(new Error("Unauthenticated"));

    render(<InvitationScreen token="test-invitation-token-12345" />);

    await waitFor(() => {
      expect(screen.getByText("Te invitaron a formar parte de un equipo")).toBeTruthy();
      expect(screen.getByText("Estudio Nuari")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Iniciar sesión" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Crear una cuenta" })).toBeTruthy();
    });
  });

  it("renders VALID_MATCH and allows accepting when user email matches and is verified", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockResolvedValue(mockInvitation);
    vi.spyOn(browserApi, "getSnapshot").mockResolvedValue(mockMatchingUserSnapshot);
    vi.spyOn(browserApi, "acceptInvitation").mockResolvedValue({
      organization: {
        id: "org-1",
        name: "Estudio Nuari",
        slug: "estudio-nuari",
        businessType: "SERVICES",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
      membership: {
        id: "mem-1",
        organizationId: "org-1",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });

    render(<InvitationScreen token="test-invitation-token-12345" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Aceptar invitación" })).toBeTruthy();
    });

    const acceptBtn = screen.getByRole("button", { name: "Aceptar invitación" });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(browserApi.acceptInvitation).toHaveBeenCalledWith("test-invitation-token-12345");
      expect(screen.getByText("¡Te uniste al equipo!")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Ingresar a Nuari" })).toBeTruthy();
    });
  });

  it("renders VALID_MISMATCH when logged in with a different email", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockResolvedValue(mockInvitation);
    vi.spyOn(browserApi, "getSnapshot").mockResolvedValue(mockMismatchUserSnapshot);

    render(<InvitationScreen token="test-invitation-token-12345" />);

    await waitFor(() => {
      expect(screen.getByText("Cuenta incorrecta")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cambiar de cuenta" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Volver a mi espacio de trabajo" })).toBeTruthy();
    });
  });

  it("renders UNVERIFIED when logged in user has unverified email and allows resending verification", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockResolvedValue(mockInvitation);
    vi.spyOn(browserApi, "getSnapshot").mockResolvedValue(mockUnverifiedUserSnapshot);
    const resendSpy = vi.spyOn(browserApi, "requestEmailVerification").mockResolvedValue({ message: "Correo de verificación enviado." });

    render(<InvitationScreen token="test-invitation-token-12345" />);

    await waitFor(() => {
      expect(screen.getByText("Verificá tu correo")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Verificar correo" })).toHaveProperty(
        "href",
        expect.stringContaining("/verify-email?returnTo=%2Finvitacion%2Ftest-invitation-token-12345")
      );
      expect(screen.getByRole("button", { name: "Reenviar correo de verificación" })).toBeTruthy();
    });

    const resendBtn = screen.getByRole("button", { name: "Reenviar correo de verificación" });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalled();
      expect(resendSpy).toHaveBeenCalledWith({ returnTo: "/invitacion/test-invitation-token-12345" });
      expect(screen.getByText("Correo de verificación enviado.")).toBeTruthy();
    });
  });

  it("rechecks the real verification state from the invitation", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockResolvedValue(mockInvitation);
    const snapshotSpy = vi.spyOn(browserApi, "getSnapshot")
      .mockResolvedValueOnce(mockUnverifiedUserSnapshot)
      .mockResolvedValueOnce(mockMatchingUserSnapshot);

    render(<InvitationScreen token="test-invitation-token-12345" />);
    await screen.findByText("Verificá tu correo");
    fireEvent.click(screen.getByRole("button", { name: "Ya verifiqué mi correo (actualizar)" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Aceptar invitación" })).toBeTruthy());
    expect(snapshotSpy).toHaveBeenCalledTimes(2);
  });

  it("renders EXPIRED when invitation has expired or API indicates expiration", async () => {
    vi.spyOn(browserApi, "getPublicInvitation").mockRejectedValue(
      new ApiError(400, "INVALID_INVITATION", "La invitación ya expiró.")
    );

    render(<InvitationScreen token="test-invitation-token-12345" />);

    await waitFor(() => {
      expect(screen.getByText("La invitación expiró")).toBeTruthy();
      expect(screen.getAllByRole("link", { name: "Volver al inicio" }).length).toBeGreaterThan(0);
    });
  });
});
