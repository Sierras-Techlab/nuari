/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  afterEach(cleanup);

  it("renders login fields, toggles password visibility and shows a non-authenticating status", () => {
    render(<AuthForm mode="login" />);

    expect(screen.getByRole("heading", { name: "Volvé a tu negocio" })).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("current-password");

    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Contraseña").getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    fireEvent.submit(screen.getByRole("button", { name: "Iniciar sesión" }).closest("form") as HTMLFormElement);
    expect(screen.getByRole("status").textContent).toContain("Tus datos no se enviaron");
  });

  it("renders register-only fields and the reciprocal login route", () => {
    render(<AuthForm mode="register" />);

    expect(screen.getByRole("heading", { name: "Creá tu cuenta" })).toBeTruthy();
    expect(screen.getByLabelText("Nombre").getAttribute("autocomplete")).toBe("given-name");
    expect(screen.getByLabelText("Apellido").getAttribute("autocomplete")).toBe("family-name");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByRole("checkbox", { name: /Acepto los/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
  });
});
