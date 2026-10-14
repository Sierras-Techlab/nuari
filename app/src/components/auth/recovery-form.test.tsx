/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./recovery-form";
import { ApiError } from "@/lib/api/errors";
const { apiMutation, clearCsrfToken, requestEmailVerification, getSnapshot } = vi.hoisted(() => ({
  apiMutation: vi.fn(),
  clearCsrfToken: vi.fn(),
  requestEmailVerification: vi.fn(),
  getSnapshot: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api/browser", () => ({ apiMutation, clearCsrfToken, requestEmailVerification, getSnapshot }));

describe("explicit email-token confirmation", () => {
  afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); window.history.replaceState(null, "", "/"); });
  it("shows a clear waiting state without an unusable confirm button", async () => {
    render(<RecoveryForm mode="verify" registered />);
    expect(await screen.findByRole("heading", { name: "Revisá tu correo" })).toBeTruthy();
    expect(screen.getByText(/Abrí el enlace que enviamos a tu correo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar verificación" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reenviar correo de verificación" })).toBeTruthy();
  });
  it("shows the recipient from the one-time post-registration handoff", async () => {
    sessionStorage.setItem("nuari_verify_email", "juan@example.com");
    render(<RecoveryForm mode="verify" registered />);
    expect(await screen.findByText("juan@example.com")).toBeTruthy();
    expect(sessionStorage.getItem("nuari_verify_email")).toBeNull();
  });
  it.each(["verify", "reset"] as const)("removes %s fragment without consuming the token on GET or hydration", async (mode) => {
    window.history.replaceState(null, "", `/${mode}#token=${"a".repeat(43)}`); render(<RecoveryForm mode={mode} />);
    expect(window.location.hash).toBe(""); expect(apiMutation).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: mode === "verify" ? "Confirmar verificación" : "Actualizar contraseña" }).disabled).toBe(false));
  });
  it("posts verification only after explicit user confirmation", async () => {
    apiMutation.mockResolvedValue(undefined); window.history.replaceState(null, "", `/verify-email#token=${"a".repeat(43)}`); render(<RecoveryForm mode="verify" />);
    expect(await screen.findByRole("heading", { name: "Confirmá tu correo" })).toBeTruthy();
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" }); await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeTruthy(); expect(apiMutation).toHaveBeenCalledExactlyOnceWith("/auth/email-verification/confirm", { token: "a".repeat(43) });
  });
  it("disables confirmation while the explicit request is pending", async () => {
    let finish!: () => void;
    apiMutation.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    window.history.replaceState(null, "", `/verify-email#token=${"f".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Confirmando…" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmando…" }));
    expect(apiMutation).toHaveBeenCalledOnce();
    finish();
    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeTruthy();
  });
  it("returns directly to the invitation after verification", async () => {
    apiMutation.mockResolvedValue(undefined);
    window.history.replaceState(null, "", `/verify-email?returnTo=${encodeURIComponent("/invitacion/tok-123")}&token=${"e".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);

    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);

    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continuar con la invitación" })).toHaveProperty("href", expect.stringContaining("/invitacion/tok-123"));
    expect(router.replace).not.toHaveBeenCalled();
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
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("shows invalid token message and allows resending verification email", async () => {
    requestEmailVerification.mockResolvedValueOnce({ message: "Te enviamos un nuevo correo de verificación." });
    window.history.replaceState(null, "", "/verify-email");
    render(<RecoveryForm mode="verify" initialReturnTo="/invitacion/tok-123" />);

    await screen.findByRole("heading", { name: "Revisá tu correo" });
    expect(screen.getByText(/Abrí el enlace que enviamos a tu correo/)).toBeTruthy();
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

    const confirm = await screen.findByRole<HTMLButtonElement>("button", { name: "Confirmar verificación" });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await screen.findByText("El enlace no es válido o venció.");

    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo de verificación" }));
    await screen.findByText("Te enviamos un nuevo correo de verificación.");
    expect(requestEmailVerification).toHaveBeenCalledWith({ returnTo: "/invitacion/tok-123" });
  });
  it("offers continuation without resend when the signed-in account is already verified", async () => {
    apiMutation.mockRejectedValueOnce(new ApiError(400, "INVALID_TOKEN", "El enlace no es válido o venció."));
    getSnapshot.mockResolvedValueOnce({ user: { emailVerifiedAt: "2026-10-14T00:00:00.000Z" } });
    window.history.replaceState(null, "", `/verify-email?token=${"g".repeat(43)}`);
    render(<RecoveryForm mode="verify" />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar verificación" }));
    expect(await screen.findByRole("heading", { name: "Tu correo ya está verificado" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reenviar correo de verificación" })).toBeNull();
    expect(screen.getByRole("link", { name: "Continuar a Nuari" })).toHaveProperty("href", expect.stringContaining("/onboarding"));
  });
  it("keeps rate-limit feedback visible and prevents duplicate resend submissions", async () => {
    let finish!: (value: { message: string }) => void;
    requestEmailVerification.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<RecoveryForm mode="verify" registered />);
    const resend = await screen.findByRole("button", { name: "Reenviar correo de verificación" });
    fireEvent.click(resend);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Enviando correo…" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Enviando correo…" }));
    expect(requestEmailVerification).toHaveBeenCalledOnce();
    finish({ message: "Correo enviado." });
    expect(await screen.findByText("Correo enviado.")).toBeTruthy();
    requestEmailVerification.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "Esperá antes de volver a solicitarlo."));
    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo de verificación" }));
    expect(await screen.findByText("Esperá antes de volver a solicitarlo.")).toBeTruthy();
  });
  it("does not expose unsafe return destinations", () => {
    render(<RecoveryForm mode="verify" initialReturnTo="https://example.com/steal" />);
    expect(screen.getByRole("link", { name: "Volver a Nuari" })).toHaveProperty("href", expect.stringContaining("/onboarding"));
  });
});
