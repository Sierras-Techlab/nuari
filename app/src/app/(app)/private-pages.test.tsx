import { describe, expect, it, vi } from "vitest";
import { accessFixture } from "@/test/access-fixtures";
import { AccessError } from "@/features/access/access-error";
import HomePage from "./app/page";
import AgendaPage from "./app/agenda/page";
import ServicesPage from "./app/servicios/page";
import ClientsPage from "./app/clientes/page";
import ProfessionalsPage from "./app/profesionales/page";
import CashPage from "./app/caja/page";
import TeamPage from "./app/equipo/page";
import SettingsPage from "./app/configuracion/page";
import LegacyMembersPage from "./app/configuracion/miembros/page";
const { guardPage } = vi.hoisted(() => ({ guardPage: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ guardPage }));
vi.mock("next/navigation", () => ({ redirect: (destination: string) => { throw new Error(`NEXT_REDIRECT:${destination}`); } }));
describe("private page entrypoints (not just layout)", () => {
  it.each([AgendaPage, ServicesPage, ClientsPage, ProfessionalsPage, CashPage, TeamPage, SettingsPage])("checks business access before constructing private content for %s", async (page) => {
    guardPage.mockResolvedValueOnce(null); const closed = await page(); expect(guardPage).toHaveBeenLastCalledWith("business"); expect(closed.type).toBe(AccessError);
    guardPage.mockResolvedValueOnce(accessFixture()); const allowed = await page(); expect(allowed.type).not.toBe(AccessError);
  });
  it("keeps only the subscription shell on an expired app root", async () => {
    const snapshot = accessFixture(); if (snapshot.access) snapshot.access.businessAllowed = false; guardPage.mockResolvedValueOnce(snapshot);
    expect(await HomePage()).toBeNull(); expect(guardPage).toHaveBeenLastCalledWith("app");
  });
  it("protects the legacy member URL before redirecting to Equipo", async () => {
    guardPage.mockResolvedValueOnce(null);
    const closed = await LegacyMembersPage();
    expect(guardPage).toHaveBeenLastCalledWith("business");
    expect(closed.type).toBe(AccessError);

    guardPage.mockResolvedValueOnce(accessFixture());
    await expect(LegacyMembersPage()).rejects.toThrow("NEXT_REDIRECT:/app/equipo");
    expect(guardPage).toHaveBeenLastCalledWith("business");
  });
});
