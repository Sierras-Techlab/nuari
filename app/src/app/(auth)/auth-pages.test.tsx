/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import AuthLayout from "./layout";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import { AuthForm } from "@/components/auth/auth-form";

describe("authentication routes", () => {
  afterEach(cleanup);

  it("renders each URL with only its active form mode", () => {
    const login = render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Volvé a tu negocio" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Crear cuenta" }).getAttribute("href")).toBe("/register");
    login.unmount();

    render(<RegisterPage />);
    expect(screen.getByRole("heading", { name: "Creá tu cuenta" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
  });

  it("keeps the no-JavaScript submit control disabled in server-rendered HTML", () => {
    const html = renderToString(<AuthForm mode="login" />);
    expect(html).toContain("disabled");
    expect(html).toContain("Iniciar sesión");
  });

  it("provides a public home link in the shared auth layout", () => {
    render(<AuthLayout><p>Formulario</p></AuthLayout>);
    expect(screen.getAllByRole("link", { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /inicio/i })[0]?.getAttribute("href")).toBe("/");
  });
});
