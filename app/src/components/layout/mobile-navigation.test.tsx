/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/agenda" }));

import { MobileNavigation } from "./mobile-navigation";

describe("MobileNavigation", () => {
  afterEach(cleanup);

  it("opens and closes with the toggle and Escape", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    expect(screen.getByRole("navigation", { name: "Navegación de la aplicación" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("closes after choosing a navigation item", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    fireEvent.click(screen.getByRole("link", { name: "Inicio" }));
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("exposes the appointment agenda from the application navigation", () => {
    render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    expect(screen.getByRole("link", { name: "Agenda" }).getAttribute("href")).toBe("/app/agenda");
    expect(screen.getByRole("link", { name: "Agenda" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Servicios" }).getAttribute("href")).toBe("/app/servicios");
    expect(screen.getByRole("link", { name: "Profesionales" }).getAttribute("href")).toBe("/app/profesionales");
    expect(screen.getByRole("link", { name: "Profesionales" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Clientes" }).getAttribute("href")).toBe("/app/clientes");
    expect(screen.getByRole("link", { name: "Caja" }).getAttribute("href")).toBe("/app/caja");
    expect(screen.getByRole("link", { name: "Equipo" }).getAttribute("href")).toBe("/app/equipo");
  });
});
