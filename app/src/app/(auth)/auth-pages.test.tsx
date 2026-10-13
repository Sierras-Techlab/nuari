/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthLayout from "./layout";
import LoginPage from "./login/page";
import RegisterPage from "./register/page";
import { AuthForm } from "@/components/auth/auth-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/server", () => ({ guardAuthPage: async () => true }));
vi.mock("@/lib/auth/server", () => ({ guardAuthPage: vi.fn(async () => true) }));

describe("authentication routes", () => {
  afterEach(cleanup);

  it("renders each URL with only its active form mode", async () => {
    const login = render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Volvé a tu negocio" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Crear cuenta" }).getAttribute("href")).toBe("/register");
    login.unmount();

    render(await RegisterPage());
    expect(screen.getByRole("heading", { name: "Creá tu cuenta" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
  });

  it.each(["login", "register"] as const)("keeps the no-JavaScript %s submit control disabled in server-rendered HTML", (mode) => {
    const html = renderToString(<AuthForm mode={mode} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    const button = container.querySelector<HTMLButtonElement>("button[type='submit']");

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toBe(mode === "login" ? "Iniciar sesión" : "Crear mi cuenta");
    expect(container.querySelector("form")?.getAttribute("action")).toBeNull();
    expect(container.querySelector("[role='status']")).toBeNull();
  });

  it("provides a public home link in the shared auth layout", () => {
    render(<AuthLayout><p>Formulario</p></AuthLayout>);
    expect(screen.getAllByRole("link", { name: /inicio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /inicio/i })[0]?.getAttribute("href")).toBe("/");
  });
});
