/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Faq } from "./faq";

describe("Faq", () => {
  afterEach(cleanup);

  it("renders the four reference questions with usable no-JS answers", () => {
    render(<Faq />);

    expect(screen.getByText("¿Qué es Nuari?")).toBeTruthy();
    expect(screen.getByText("¿Para qué tipo de negocios sirve?")).toBeTruthy();
    expect(screen.getByText("¿Necesito instalar algo?")).toBeTruthy();
    expect(screen.getByText("¿Puedo cancelar cuando quiera?")).toBeTruthy();
    expect(screen.getByText(/Nuari es una plataforma web/)).toBeTruthy();
    expect(screen.getByText(/No. Nuari funciona 100% en la nube/)).toBeTruthy();
  });

  it("opens and closes a native details item", () => {
    render(<Faq />);

    const summary = screen.getByText("¿Necesito instalar algo?").closest("summary");
    expect(summary).toBeTruthy();
    expect(summary?.parentElement?.hasAttribute("open")).toBe(false);

    fireEvent.click(summary as HTMLElement);
    expect(summary?.parentElement?.hasAttribute("open")).toBe(true);

    fireEvent.click(summary as HTMLElement);
    expect(summary?.parentElement?.hasAttribute("open")).toBe(false);
  });
});
