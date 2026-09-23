/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
});
