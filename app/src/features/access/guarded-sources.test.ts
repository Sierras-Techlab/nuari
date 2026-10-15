import { describe, expect, it, vi } from "vitest";
import { createLocalWorkspaceSource } from "@/features/workspace/local-source";
import { guardWorkspaceSource } from "./guarded-sources";
describe("local operations authorized preflight", () => {
  it("checks all workspace reads and writes before touching local data", async () => {
    const raw = createLocalWorkspaceSource(); const gate = vi.fn(async () => { throw new Error("denied"); }); const source = guardWorkspaceSource(raw, gate);
    const methods = [vi.spyOn(raw, "listServices"), vi.spyOn(raw, "createService"), vi.spyOn(raw, "listTeam"), vi.spyOn(raw, "createTeamMember"), vi.spyOn(raw, "listCashMovements"), vi.spyOn(raw, "createCashMovement")];
    const operations = [() => source.listServices(), () => source.createService({ name: "Test", durationMinutes: 30, description: "" }), () => source.listTeam(), () => source.createTeamMember({ name: "Test", email: "test@example.com", role: "professional" }), () => source.listCashMovements(), () => source.createCashMovement({ date: "2026-10-14", kind: "in", concept: "Test", amountCents: 100 })];
    for (const operation of operations) await expect(operation()).rejects.toThrow("denied");
    methods.forEach((method) => expect(method).not.toHaveBeenCalled()); expect(gate).toHaveBeenCalledTimes(6);
  });
  it("executes existing algorithms only after the backend gate allows access", async () => {
    const raw = createLocalWorkspaceSource(); const order: string[] = []; const method = vi.spyOn(raw, "listServices").mockImplementation(async () => { order.push("local"); return []; });
    const source = guardWorkspaceSource(raw, async () => { order.push("backend"); });
    await source.listServices(); expect(order).toEqual(["backend", "local"]); expect(method).toHaveBeenCalledOnce();
  });
});
