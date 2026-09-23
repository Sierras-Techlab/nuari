/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingNavbar } from "./marketing-navbar";

describe("MarketingNavbar CTA routing", () => {
  afterEach(cleanup);

  it("points desktop access and signup CTAs to the auth routes", () => {
    render(<MarketingNavbar />);

    expect(screen.getByRole("link", { name: "Ingresar" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Comenzar gratis" }).getAttribute("href")).toBe("/register");
  });

  it("keeps informational navigation as internal anchors", () => {
    render(<MarketingNavbar />);

    expect(screen.getByRole("link", { name: "Soluciones" }).getAttribute("href")).toBe("#soluciones");
    expect(screen.getByRole("link", { name: "Características" }).getAttribute("href")).toBe("#caracteristicas");
    expect(screen.getByRole("link", { name: "Precios" }).getAttribute("href")).toBe("#precios");
    expect(screen.getByRole("link", { name: "Preguntas" }).getAttribute("href")).toBe("#faq");
  });
});
