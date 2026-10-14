/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingScreen } from "./onboarding-screen";
import { accessFixture } from "@/test/access-fixtures";
import { ApiError } from "@/lib/api/errors";

const { replace, refresh, context, getSnapshot, createOrganization, apiMutation } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), context: { snapshot: undefined as import("@/lib/api/contracts").AccessSnapshot | undefined }, getSnapshot: vi.fn(), createOrganization: vi.fn(), apiMutation: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ snapshot: context.snapshot, refresh, signOut: vi.fn(), select: vi.fn() }) }));
vi.mock("@/lib/api/browser", () => ({ getSnapshot, createOrganization, apiMutation }));

function next() { fireEvent.click(screen.getByRole("button", { name: "Continuar" })); }
function back() { fireEvent.click(screen.getByRole("button", { name: "Volver" })); }
function select(name: string) { fireEvent.click(screen.getByRole("radio", { name })); }
function start() {
  fireEvent.change(screen.getByLabelText("Nombre del negocio"), { target: { value: "Estética Ñandú" } });
  next();
}
function toSummary() { start(); select("Servicios"); next(); select("Pro"); next(); }

describe("onboarding", () => {
  beforeEach(() => { context.snapshot = accessFixture(false); getSnapshot.mockResolvedValue(accessFixture(false)); createOrganization.mockResolvedValue({}); refresh.mockResolvedValue(accessFixture()); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("provides a standalone route, metadata, home link and initial input focus", () => {
    render(<OnboardingScreen />);
    expect(screen.getByRole("link", { name: "nuari, inicio" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("status").textContent).toBe("Paso 1 de 4");
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre del negocio"));
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("blocks invalid identity even through Enter and associates inline errors", () => {
    render(<OnboardingScreen />);
    const name = screen.getByLabelText("Nombre del negocio");
    const slug = screen.getByLabelText("Tu enlace será:");
    fireEvent.keyDown(name, { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("Paso 1 de 4");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe("business-name-error");
    fireEvent.change(name, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Continuar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(name, { target: { value: "✨!!!" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(slug.getAttribute("aria-invalid")).toBe("true");
    expect(slug.getAttribute("aria-describedby")).toBe("business-slug-error");
    expect(replace).not.toHaveBeenCalled();
  });

  it("generates the slug until manually edited and rejects invalid manual values", () => {
    render(<OnboardingScreen />);
    const name = screen.getByLabelText("Nombre del negocio");
    const slug = screen.getByLabelText("Tu enlace será:");
    fireEvent.change(name, { target: { value: "Estética Ñandú" } });
    expect((slug as HTMLInputElement).value).toBe("estetica-nandu");
    fireEvent.change(slug, { target: { value: "mi-estudio" } });
    fireEvent.change(name, { target: { value: "Estudio nuevo" } });
    expect((slug as HTMLInputElement).value).toBe("mi-estudio");
    for (const value of ["", "Mayúsculas", "mi--estudio"]) {
      fireEvent.change(slug, { target: { value } });
      fireEvent.keyDown(slug, { key: "Enter" });
      expect(screen.getByRole("status").textContent).toBe("Paso 1 de 4");
    }
    fireEvent.change(slug, { target: { value: "mi-estudio" } });
    next();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    back();
    expect((screen.getByLabelText("Nombre del negocio") as HTMLInputElement).value).toBe("Estudio nuevo");
    expect((screen.getByLabelText("Tu enlace será:") as HTMLInputElement).value).toBe("mi-estudio");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("requires a type and plan, recalculates suggestions and allows non-suggested plans", () => {
    render(<OnboardingScreen />);
    start();
    expect(screen.getByRole("button", { name: "Continuar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(screen.getByRole("heading", { level: 1 }), { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("Paso 2 de 4");
    select("Servicios"); next();
    expect(screen.getByRole("button", { name: "Continuar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: "Turismo" }).nextElementSibling?.className).toContain("bg-white/60");
    back(); select("Hostelería"); next();
    expect(screen.getByRole("radio", { name: "Turismo" }).nextElementSibling?.className).not.toContain("bg-white/60");
    expect(screen.getByRole("radio", { name: "Básico" }).nextElementSibling?.className).toContain("bg-white/60");
    select("Básico"); next();
    expect(screen.getByText("Plan Básico")).toBeTruthy();
    expect(screen.getByText("Hostelería")).toBeTruthy();
  });

  it("retains selection and updates summary after going back and editing", () => {
    render(<OnboardingScreen />);
    toSummary();
    expect(screen.getByText("Estética Ñandú")).toBeTruthy();
    back();
    expect((screen.getByRole("radio", { name: "Pro" }) as HTMLInputElement).checked).toBe(true);
    back(); select("Hostelería"); next();
    expect((screen.getByRole("radio", { name: "Pro" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("radio", { name: "Pro" }).nextElementSibling?.className).not.toContain("bg-white/60");
    back(); back();
    fireEvent.change(screen.getByLabelText("Nombre del negocio"), { target: { value: "Cabañas del Sur" } });
    next(); next(); next();
    expect(screen.getByText("Cabañas del Sur")).toBeTruthy();
    expect(screen.getByText("cabanas-del-sur")).toBeTruthy();
    expect(screen.getByText("Hostelería")).toBeTruthy();
    expect(screen.getByText("Plan Pro")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("does not hijack radio, back or link Enter; ignores held keys and double clicks", () => {
    render(<OnboardingScreen />);
    const name = screen.getByLabelText("Nombre del negocio");
    fireEvent.change(name, { target: { value: "Estudio Nuari" } });
    fireEvent.keyDown(name, { key: "Enter", repeat: true });
    expect(screen.getByRole("status").textContent).toBe("Paso 1 de 4");
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "Comercio" }), { key: "Enter" });
    expect((screen.getByRole("radio", { name: "Comercio" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.keyDown(screen.getByRole("button", { name: "Volver" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("Paso 2 de 4");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }), { detail: 2 });
    expect(screen.getByRole("status").textContent).toBe("Paso 2 de 4");
    fireEvent.keyDown(screen.getByRole("heading", { level: 1 }), { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("Paso 3 de 4");
  });

  it("submits once and navigates only after confirmed creation", async () => {
    render(<OnboardingScreen />);
    toSummary();
    expect(screen.getByText("Revisá la configuración de tu espacio antes de continuar")).toBeTruthy();
    expect(screen.queryByText("Negocio configurado")).toBeNull();
    fireEvent.keyDown(screen.getByRole("heading", { level: 1 }), { key: "Enter" });
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith("/app"));
    expect(createOrganization).toHaveBeenCalledOnce();
    expect(createOrganization.mock.calls[0]?.[0]).toEqual({ name: "Estética Ñandú", slug: "estetica-nandu", businessType: "SERVICES", planCode: "PRO" });
  });

  it("resets on reentry and does not expose a native form in SSR", () => {
    const view = render(<OnboardingScreen />);
    toSummary();
    view.unmount();
    render(<OnboardingScreen />);
    expect(screen.getByRole("status").textContent).toBe("Paso 1 de 4");
    expect((screen.getByLabelText("Nombre del negocio") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Tu enlace será:") as HTMLInputElement).value).toBe("");
    const html = renderToString(<OnboardingScreen />);
    expect(html).not.toContain("<form");
    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
    expect(html).not.toContain("business-plan-PRO");
  });
  it("retains the exact frozen payload and key after an uncertain result", async () => {
    createOrganization.mockRejectedValueOnce(new ApiError(0, "SERVICE_UNAVAILABLE", "Timeout"));
    render(<OnboardingScreen />); toSummary();
    fireEvent.click(screen.getByRole("button", { name: "Entrar a mi espacio" }));
    await screen.findByRole("button", { name: "Reintentar creación" });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Volver" }).disabled).toBe(true);
    const first = createOrganization.mock.calls[0];
    fireEvent.click(screen.getByRole("button", { name: "Reintentar creación" }));
    await waitFor(() => expect(createOrganization).toHaveBeenCalledTimes(2));
    expect(createOrganization.mock.calls[1]?.[0]).toBe(first?.[0]);
    expect(createOrganization.mock.calls[1]?.[1]).toBe(first?.[1]);
    expect(Object.isFrozen(first?.[0])).toBe(true);
  });
  it("reconciles a committed creation whose response was lost", async () => {
    createOrganization.mockRejectedValue(new ApiError(0, "SERVICE_UNAVAILABLE", "Timeout"));
    getSnapshot.mockResolvedValueOnce(accessFixture(false)).mockResolvedValue(accessFixture());
    render(<OnboardingScreen />); toSummary();
    fireEvent.click(screen.getByRole("button", { name: "Entrar a mi espacio" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    expect(createOrganization).toHaveBeenCalledOnce();
  });
  it("returns slug conflicts to step one without losing type or plan", async () => {
    createOrganization.mockRejectedValue(new ApiError(409, "SLUG_TAKEN", "Ese enlace ya está ocupado"));
    render(<OnboardingScreen />); toSummary();
    fireEvent.click(screen.getByRole("button", { name: "Entrar a mi espacio" }));
    await screen.findByLabelText("Nombre del negocio");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tu enlace será:"), { target: { value: "otro-estudio" } });
    next(); next(); next();
    expect(screen.getByText("Plan Pro")).toBeTruthy();
    expect(screen.getByText("Servicios")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it("allows fields but blocks the final submission until email verification", () => {
    const snapshot = accessFixture(false); snapshot.user.emailVerifiedAt = null; snapshot.onboarding = { canCreateOrganization: false, reason: "EMAIL_UNVERIFIED" }; context.snapshot = snapshot;
    render(<OnboardingScreen />); toSummary();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Entrar a mi espacio" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Reenviar verificación" })).toBeTruthy();
    expect(createOrganization).not.toHaveBeenCalled();
  });
  it("offers help and logout without granting another trial", () => {
    const snapshot = accessFixture(false); snapshot.onboarding = { canCreateOrganization: false, reason: "TRIAL_ALREADY_USED" }; context.snapshot = snapshot;
    render(<OnboardingScreen />);
    expect(screen.getByRole("heading", { name: "Tu prueba ya fue utilizada" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
    expect(screen.queryByLabelText("Nombre del negocio")).toBeNull();
  });

  it("explains revoked access and offers organization creation only when eligible", () => {
    const snapshot = accessFixture(false);
    snapshot.onboarding = { canCreateOrganization: false, reason: "ACCESS_REVOKED" };
    context.snapshot = snapshot;
    render(<OnboardingScreen />);
    expect(screen.getByRole("heading", { name: "Ya no tenés acceso a esta organización" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
    expect(screen.queryByLabelText("Nombre del negocio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Crear una organización nueva" })).toBeNull();
  });

  it("offers creating a new organization as a secondary action when a revoked account is eligible", () => {
    const snapshot = accessFixture(false);
    snapshot.onboarding = { canCreateOrganization: true, reason: "ACCESS_REVOKED" };
    context.snapshot = snapshot;
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Crear una organización nueva" }));
    expect(screen.getByLabelText("Nombre del negocio")).toBeTruthy();
  });
});
