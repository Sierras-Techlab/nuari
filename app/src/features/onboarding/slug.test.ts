import { describe, expect, it } from "vitest";

import { isPlanSuggested } from "./catalog";
import { generateSlug, isValidIdentity, isValidSlug } from "./slug";

describe("onboarding identity", () => {
  it("normalizes accents, whitespace, punctuation and repeated hyphens", () => {
    expect(generateSlug("  Estética Ñandú  ")).toBe("estetica-nandu");
    expect(generateSlug("---Estudio & Nuari__ -- Centro! ---")).toBe("estudio-nuari-centro");
    expect(generateSlug("✨!!!")).toBe("");
  });

  it("accepts only canonical slugs of at least three characters", () => {
    for (const value of ["", "   ", "ab", "-nuari", "nuari-", "nuari--app", "Nuari", "nuári", "nuari_app", "nuari/app", "nuari"]) {
      expect(isValidSlug(value), value).toBe(false);
    }
    expect(isValidSlug("nuari-2026")).toBe(true);
    expect(isValidSlug("a-b")).toBe(true);
  });

  it("requires both a trimmed name and a valid slug", () => {
    expect(isValidIdentity("   ", "nuari")).toBe(false);
    expect(isValidIdentity("Nuari", "")).toBe(false);
    expect(isValidIdentity(" Nuari ", "mi-negocio")).toBe(true);
  });

  it("suggests tourism only for hospitality without restricting selection", () => {
    expect(isPlanSuggested("HOSPITALITY", "TOURISM")).toBe(true);
    expect(isPlanSuggested("HOSPITALITY", "BASIC")).toBe(false);
    expect(isPlanSuggested("SERVICES", "TOURISM")).toBe(false);
    expect(isPlanSuggested("COMMERCE", "PRO")).toBe(true);
  });
});
