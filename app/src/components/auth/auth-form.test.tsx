/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";
import { accessFixture } from "@/test/access-fixtures";
import { ApiError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  getSnapshot: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/api/browser", () => ({ register: mocks.register, login: mocks.login, getSnapshot: mocks.getSnapshot }));

describe("AuthForm", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders login fields and toggles password visibility", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { name: "Volvé a tu negocio" })).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("current-password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(screen.getByLabelText("Contraseña").getAttribute("type")).toBe("text");
  });

  it("registers, creates a session, and directs to email verification", async () => {
    mocks.register.mockResolvedValue({ message: "ok" });
    mocks.login.mockResolvedValue({});
    render(<AuthForm mode="register" />);
    fillValidRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ name: "Juan Pérez", email: "juan@example.com", password: "correct horse battery" }));
    expect(mocks.login).toHaveBeenCalledWith({ email: "juan@example.com", password: "correct horse battery" });
    expect(mocks.replace).toHaveBeenCalledWith("/verify-email?registered=1");
  });

  it("passes a safe invitation return path through registration, login, and verification", async () => {
    mocks.register.mockResolvedValue({ message: "ok" });
    mocks.login.mockResolvedValue({});
    render(<AuthForm mode="register" returnTo="/invitacion/invitation-token-123456789" />);
    fillValidRegistration();
    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({
      name: "Juan Pérez",
      email: "juan@example.com",
      password: "correct horse battery",
      returnTo: "/invitacion/invitation-token-123456789",
    }));
    expect(mocks.login).toHaveBeenCalledWith({ email: "juan@example.com", password: "correct horse battery" });
    expect(mocks.replace).toHaveBeenCalledWith("/verify-email?registered=1&returnTo=%2Finvitacion%2Finvitation-token-123456789");
  });

  it("routes a logged-in user based on their memberships", async () => {
    mocks.login.mockResolvedValue({});
    mocks.getSnapshot.mockResolvedValue({ memberships: [] });
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "correct horse battery" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("does not submit a password shorter than the server contract", () => {
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "short" } });
    fireEvent.submit(screen.getByRole("button", { name: "Iniciar sesión" }).closest("form") as HTMLFormElement);
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("12 y 128");
  });
  it.each(["Nombre", "Apellido", "Email", "Contraseña"])("keeps required %s validation before registration", (label) => {
    render(<AuthForm mode="register" />); fillValidRegistration(); fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    const form = screen.getByRole("button", { name: "Crear mi cuenta" }).closest("form") as HTMLFormElement;
    const report = vi.spyOn(form, "reportValidity"); expect(fireEvent.submit(form)).toBe(false); expect(report).toHaveBeenCalledOnce(); expect(mocks.register).not.toHaveBeenCalled(); report.mockRestore();
  });
  it("blocks duplicate submissions until the registration response is confirmed", async () => {
    let confirm: ((value: { message: string }) => void) | undefined;
    mocks.register.mockImplementation(() => new Promise<{ message: string }>((resolve) => { confirm = resolve; }));
    render(<AuthForm mode="register" />); fillValidRegistration();
    const form = screen.getByRole("button", { name: "Crear mi cuenta" }).closest("form") as HTMLFormElement;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mocks.register).toHaveBeenCalledOnce(); expect(mocks.replace).not.toHaveBeenCalled(); expect(screen.getByRole<HTMLButtonElement>("button", { name: "Procesando…" }).disabled).toBe(true);
    mocks.login.mockResolvedValue({});
    confirm?.({ message: "Revisá tu correo" }); await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/verify-email?registered=1"));
  });
  it("routes active employees to the app without their own onboarding", async () => {
    mocks.login.mockResolvedValue({}); const snapshot = accessFixture(); snapshot.memberships[0].role = "EMPLOYEE"; mocks.getSnapshot.mockResolvedValue(snapshot);
    render(<AuthForm mode="login" />); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } }); fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "correct horse battery" } }); fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/app"));
  });
  it("does not redirect a successful login with an unavailable snapshot to onboarding", async () => {
    mocks.login.mockResolvedValue({}); mocks.getSnapshot.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "Servicio no disponible"));
    render(<AuthForm mode="login" />); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } }); fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "correct horse battery" } }); fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect((await screen.findByRole("status")).textContent).toBe("Servicio no disponible"); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("associates typed backend field errors with the existing inputs", async () => {
    mocks.register.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "Revisá los campos", { email: ["Email inválido"], password: ["Contraseña inválida"] }));
    render(<AuthForm mode="register" />); fillValidRegistration(); fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    await screen.findByText("Email inválido"); expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true"); expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBe("register-email-error"); expect(screen.getByLabelText("Contraseña").getAttribute("aria-describedby")).toBe("register-password-error");
  });
});

function fillValidRegistration() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Juan" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Juan@Example.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "correct horse battery" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Acepto los/ }));
}
