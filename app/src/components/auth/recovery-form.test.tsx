/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./recovery-form";
const { apiMutation, clearCsrfToken } = vi.hoisted(() => ({ apiMutation: vi.fn(), clearCsrfToken: vi.fn() }));
vi.mock("@/lib/api/browser", () => ({ apiMutation, clearCsrfToken }));
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
  it("resets via POST without auto-login and discards CSRF", async () => {
    apiMutation.mockResolvedValue(undefined); window.history.replaceState(null, "", `/reset-password#token=${"b".repeat(43)}`); render(<RecoveryForm mode="reset" />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "new password 123" } });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Actualizar contraseña" }); await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button);
    await screen.findByText("Tu contraseña se actualizó. Iniciá sesión nuevamente."); expect(clearCsrfToken).toHaveBeenCalledOnce(); expect(apiMutation).toHaveBeenCalledWith("/auth/password-reset/confirm", { token: "b".repeat(43), password: "new password 123" });
  });
  it("does not expose tokens or an enabled native submit in SSR", () => {
    const html = renderToString(<RecoveryForm mode="verify" />); expect(html).toContain("disabled"); expect(html).not.toContain("#token"); expect(html).not.toContain("action=");
  });
});
