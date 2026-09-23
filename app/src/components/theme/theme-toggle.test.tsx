/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark", "light");
    localStorage.clear();
  });

  it("changes the theme and persists the preference", async () => {
    render(<ThemeToggle />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("nuari-theme")).toBe("dark");
  });
});
