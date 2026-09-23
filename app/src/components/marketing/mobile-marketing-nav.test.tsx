/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MobileMarketingNav } from "./mobile-marketing-nav";

describe("MobileMarketingNav", () => {
  afterEach(cleanup);

  it("opens with aria-expanded and closes the menu with Escape", () => {
    render(<MobileMarketingNav />);
    const button = screen.getByRole("button", { name: "Abrir menú" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir menú" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes after selecting a link", () => {
    render(<MobileMarketingNav />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(screen.getByRole("link", { name: "Soluciones" }));
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).toBeNull();
  });

  it("routes mobile access and signup CTAs to the auth pages", () => {
    render(<MobileMarketingNav />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByRole("link", { name: "Ingresar" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Comenzar gratis" }).getAttribute("href")).toBe("/register");
  });
});
