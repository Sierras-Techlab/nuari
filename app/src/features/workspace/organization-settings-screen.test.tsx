/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/access/access-provider", () => ({
  useAccess: () => ({
    snapshot: {
      user: { id: "u-1", name: "Usuario Test", email: "test@example.com", emailVerifiedAt: null },
      memberships: [
        {
          id: "m-1",
          role: "OWNER",
          organization: {
            id: "org-1",
            name: "Estudio Nuari",
            slug: "estudio-nuari",
            businessType: "SERVICES",
            createdAt: "2026-10-12T00:00:00Z",
            updatedAt: "2026-10-12T00:00:00Z",
          },
        },
      ],
      activeOrganizationId: "org-1",
      access: { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: null, canManageSubscription: true },
      onboarding: { canCreateOrganization: false, reason: "HAS_MEMBERSHIP" },
    },
  }),
}));

vi.mock("@/lib/api/browser", () => ({
  getOrganization: vi.fn().mockResolvedValue({
    organization: {
      id: "org-1",
      name: "Estudio Nuari",
      slug: "estudio-nuari",
      businessType: "SERVICES",
      description: "Estudio de diseño",
      email: "contacto@estudionuari.com",
      phone: "1123456789",
      website: "https://estudionuari.com",
      country: "AR",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
      createdAt: "2026-10-12T00:00:00Z",
      updatedAt: "2026-10-12T00:00:00Z",
    },
    membership: { id: "m-1", organizationId: "org-1", role: "OWNER", status: "ACTIVE" },
  }),
  updateOrganization: vi.fn().mockImplementation((_id, data) => Promise.resolve({
    organization: {
      id: "org-1",
      name: data.name || "Estudio Nuari",
      slug: data.slug || "estudio-nuari",
      businessType: "SERVICES",
      description: data.description || "",
      country: data.country || "AR",
      timezone: data.timezone || "America/Argentina/Buenos_Aires",
      currency: data.currency || "ARS",
      createdAt: "2026-10-12T00:00:00Z",
      updatedAt: "2026-10-12T00:00:00Z",
    },
    membership: { id: "m-1", organizationId: "org-1", role: "OWNER", status: "ACTIVE" },
  })),
}));

import { OrganizationSettingsScreen } from "./organization-settings-screen";


describe("OrganizationSettingsScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders with initial data and banner heading", () => {
    render(<OrganizationSettingsScreen />);
    expect(screen.getByRole("heading", { name: "Configuración de organización" })).toBeTruthy();
    expect(screen.getByText("Perfil comercial")).toBeTruthy();
    expect(screen.getByText("Contacto y Ubicación")).toBeTruthy();
    expect(screen.getByText("Preferencias")).toBeTruthy();
    expect(screen.getByText("Enlace público")).toBeTruthy();
    expect(screen.getByDisplayValue("Estudio Nuari")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Equipo y accesos" }).getAttribute("href")).toBe("/app/equipo");
  });

  it("shows floating action bar on unsaved changes and allows discarding", () => {
    render(<OrganizationSettingsScreen />);
    expect(screen.getByText("Cambios sin guardar")).toBeTruthy();
    const nameInput = screen.getByLabelText("Nombre de la organización");
    fireEvent.change(nameInput, { target: { value: "Estudio Modificado" } });
    expect(screen.getByDisplayValue("Estudio Modificado")).toBeTruthy();

    const discardBtn = screen.getByRole("button", { name: "Descartar" });
    fireEvent.click(discardBtn);
    expect(screen.getByDisplayValue("Estudio Nuari")).toBeTruthy();
  });

  it("changes country, updates regional labels and timezones", () => {
    render(<OrganizationSettingsScreen />);
    const countrySelect = screen.getByLabelText("País");
    fireEvent.change(countrySelect, { target: { value: "UY" } });
    expect(screen.getByLabelText("Departamento")).toBeTruthy();
    expect(screen.getByDisplayValue("UYU - Peso Uruguayo")).toBeTruthy();
  });

  it("prompts modal confirmation when changing slug and saves", async () => {
    render(<OrganizationSettingsScreen />);
    const slugInput = screen.getByLabelText("Identificador (Slug)");
    fireEvent.change(slugInput, { target: { value: "nuevo-slug" } });
    expect(screen.getByText("Atención")).toBeTruthy();

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(saveBtn);

    expect(screen.getByText("¿Cambiar enlace público?")).toBeTruthy();
    const confirmBtn = screen.getByRole("button", { name: "Sí, cambiar enlace" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Configuración guardada exitosamente en el servidor")).toBeTruthy();
    }, { timeout: 2000 });
  });

  it("sends only changed fields in PATCH payload and allows clearing optional fields", async () => {
    const { updateOrganization } = await import("@/lib/api/browser");
    render(<OrganizationSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Estudio de diseño")).toBeTruthy();
    });

    const emailInput = screen.getByLabelText("Correo electrónico");
    fireEvent.change(emailInput, { target: { value: "" } });

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith("org-1", {
        email: "",
      });
    });
  });

  it("displays field errors returned by the API under the corresponding fields", async () => {
    const { updateOrganization } = await import("@/lib/api/browser");
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(updateOrganization).mockRejectedValueOnce(
      new ApiError(400, "VALIDATION_ERROR", "Revisá los campos indicados.", {
        email: ["El correo electrónico no es válido."],
        name: ["El nombre es obligatorio."],
      })
    );

    render(<OrganizationSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Estudio de diseño")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText("Nombre de la organización");
    fireEvent.change(nameInput, { target: { value: "Nuevo Nombre" } });

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("El correo electrónico no es válido.")).toBeTruthy();
      expect(screen.getByText("El nombre es obligatorio.")).toBeTruthy();
    });

    // Editing clears the specific field error
    fireEvent.change(nameInput, { target: { value: "Otro Nombre" } });
    expect(screen.queryByText("El nombre es obligatorio.")).toBeNull();
  });

  it("confirms currency changes and explains when saved prices require an explicit migration", async () => {
    const { updateOrganization } = await import("@/lib/api/browser");
    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(updateOrganization).mockRejectedValueOnce(new ApiError(409, "CURRENCY_CHANGE_REQUIRES_MIGRATION", "El catálogo contiene importes."));
    render(<OrganizationSettingsScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Estudio de diseño")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("País"), { target: { value: "UY" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("¿Confirmar cambio de moneda?")).toBeTruthy();
    expect(screen.getByText(/no convierte importes guardados/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => expect(updateOrganization).toHaveBeenCalledWith("org-1", expect.objectContaining({
      country: "UY", currency: "UYU", confirmCurrencyChange: true,
    })));
    expect(await screen.findByText(/hace falta una migración explícita/i)).toBeTruthy();
    expect((screen.getByLabelText("País") as HTMLSelectElement).value).toBe("UY");
    expect(screen.getByDisplayValue("UYU - Peso Uruguayo")).toBeTruthy();
  });
});

