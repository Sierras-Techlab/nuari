/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Reveal } from "./reveal";

describe("Reveal", () => {
  afterEach(cleanup);

  it("keeps content visible when IntersectionObserver is unavailable", () => {
    render(<Reveal><p>Contenido visible</p></Reveal>);
    expect(screen.getByText("Contenido visible").parentElement?.className).toContain("reveal-visible");
  });

  it("keeps content visible when reduced motion is enabled", () => {
    const originalMatchMedia = window.matchMedia;
    const originalIntersectionObserver = window.IntersectionObserver;
    try {
      window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
      window.IntersectionObserver = class {
        disconnect() {}
        observe() {}
        unobserve() {}
        takeRecords() { return []; }
      } as unknown as typeof IntersectionObserver;
      render(<Reveal><p>Movimiento reducido</p></Reveal>);
      expect(screen.getByText("Movimiento reducido").parentElement?.className).toContain("reveal-visible");
    } finally {
      window.matchMedia = originalMatchMedia;
      window.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
