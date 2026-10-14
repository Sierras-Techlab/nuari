/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./recovery-form";
import { ApiError } from "@/lib/api/errors";
const { apiMutation, clearCsrfToken, requestEmailVerification } = vi.hoisted(() => ({
  apiMutation: vi.fn(),
  clearCsrfToken: vi.fn(),
  requestEmailVerification: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api/browser", () => ({ apiMutation, clearCsrfToken, requestEmailVerification }));

describe("explicit email-token confirmation", () => {
  afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState(null, "", "/"); });
  it.each(["verify", "reset"] as const)("removes %s fragment without consuming the token on GET or hydration", async (mode) => {
    window.history.replaceState(null, "", `/${mode}#token=${"a".repeat(43)}`); render(<RecoveryForm mode={mode} />);
    expect(window.location.hash).toBe(""); expect(apiMutation).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: mode === "verify" ? "Confirmar verificación" : "Actualizar contraseña" }).disabled).toBe(false));
  });
  it("posts verification only after explicit user confirmation", async () => {
    apiMutation.mockResolvedValue(undefined); window.history.replaceState(null, "", `/verify-email#token=${"a".repeat(43)}`); render(<RecoveryForm mode="verify" />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" }); await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button);
    await screen.findByText("Correo verificado. Volvé a Nuari para continuar."); expect(apiMutation).toHaveBeenCalledExactlyOnceWith("/auth/email-verification/confirm", { token: "a".repeat(43) });
  });
  it("returns directly to the invitation after verification", async () => {
    apiMutation.mockResolvedValue(undefined);
    window.history.replaceState(null, "", `/verify-email?returnTo=${encodeURIComponent("/invitacion/tok-123")}&token=${"e".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);

    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/invitacion/tok-123"));
    expect(apiMutation).toHaveBeenCalledWith("/auth/email-verification/confirm", { token: "e".repeat(43) });
  });
  it("resets via POST without auto-login and discards CSRF", async () => {
    apiMutation.mockResolvedValue(undefined); window.history.replaceState(null, "", `/reset-password#token=${"b".repeat(43)}`); render(<RecoveryForm mode="reset" />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "new password 123" } });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Actualizar contraseña" }); await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button);
    await screen.findByText("Tu contraseña se actualizó. Iniciá sesión nuevamente."); expect(clearCsrfToken).toHaveBeenCalledOnce(); expect(apiMutation).toHaveBeenCalledWith("/auth/password-reset/confirm", { token: "b".repeat(43), password: "new password 123" });
  });
  it("does not expose tokens or an enabled native submit in SSR", () => {
    const html = renderToString(<RecoveryForm mode="verify" />); expect(html).toContain("disabled"); expect(html).not.toContain("#token"); expect(html).not.toContain("action=");
  });

  it("extracts token from search query param if hash is missing", async () => {
    window.history.replaceState(null, "", `/verify-email?token=${"c".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("shows invalid token message and allows resending verification email", async () => {
    requestEmailVerification.mockResolvedValueOnce({ message: "Te enviamos un nuevo correo de verificación." });
    window.history.replaceState(null, "", "/verify-email");
    render(<RecoveryForm mode="verify" initialReturnTo="/invitacion/tok-123" />);

    await screen.findByText("El enlace es inválido o no contiene un token válido.");
    const resendBtn = screen.getByRole("button", { name: "Reenviar correo de verificación" });
    fireEvent.click(resendBtn);

    await screen.findByText("Te enviamos un nuevo correo de verificación.");
    expect(requestEmailVerification).toHaveBeenCalledOnce();
    expect(requestEmailVerification).toHaveBeenCalledWith({ returnTo: "/invitacion/tok-123" });
    expect(screen.getByRole("link", { name: "Continuar con la invitación" })).toHaveProperty(
      "href",
      expect.stringContaining("/invitacion/tok-123")
    );
  });

  it("offers resend after a verification token is rejected as expired or consumed", async () => {
    apiMutation.mockRejectedValueOnce(new ApiError(400, "INVALID_TOKEN", "El enlace no es válido o venció."));
    requestEmailVerification.mockResolvedValueOnce({ message: "Te enviamos un nuevo correo de verificación." });
    window.history.replaceState(null, "", `/verify-email?returnTo=${encodeURIComponent("/invitacion/tok-123")}&token=${"d".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);

    const confirm = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await screen.findByText("El enlace no es válido o venció.");

    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo de verificación" }));
    await screen.findByText("Te enviamos un nuevo correo de verificación.");
    expect(requestEmailVerification).toHaveBeenCalledWith({ returnTo: "/invitacion/tok-123" });
  });
});
