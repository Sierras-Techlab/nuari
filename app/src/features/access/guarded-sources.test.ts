import { describe, expect, it, vi } from "vitest";
import { createLocalWorkspaceSource } from "@/features/workspace/local-source";
import { createDemoAppointmentSource, DEMO_DATE } from "@/features/appointments/demo-source";
import { guardAppointmentSource, guardWorkspaceSource } from "./guarded-sources";
describe("local operations authorized preflight", () => {
  it("checks all workspace reads and writes before touching local data", async () => {
    const raw = createLocalWorkspaceSource(); const gate = vi.fn(async () => { throw new Error("denied"); }); const source = guardWorkspaceSource(raw, gate);
    const methods = [vi.spyOn(raw, "listServices"), vi.spyOn(raw, "createService"), vi.spyOn(raw, "listTeam"), vi.spyOn(raw, "createTeamMember"), vi.spyOn(raw, "listCashMovements"), vi.spyOn(raw, "createCashMovement")];
    const operations = [() => source.listServices(), () => source.createService({ name: "Test", durationMinutes: 30, description: "" }), () => source.listTeam(), () => source.createTeamMember({ name: "Test", email: "test@example.com", role: "professional" }), () => source.listCashMovements(), () => source.createCashMovement({ date: DEMO_DATE, kind: "in", concept: "Test", amountCents: 100 })];
    for (const operation of operations) await expect(operation()).rejects.toThrow("denied");
    methods.forEach((method) => expect(method).not.toHaveBeenCalled()); expect(gate).toHaveBeenCalledTimes(6);
  });
  it("checks all appointment reads and mutations and never falls back after a denial", async () => {
    const raw = createDemoAppointmentSource(); const source = guardAppointmentSource(raw, async () => { throw new Error("offline"); });
    const methods = [vi.spyOn(raw, "getSetup"), vi.spyOn(raw, "list"), vi.spyOn(raw, "create"), vi.spyOn(raw, "reschedule"), vi.spyOn(raw, "cancel")];
    const operations = [() => source.getSetup(), () => source.list(DEMO_DATE), () => source.create({ customerName: "Test", customerPhone: "123", serviceId: "service", staffId: "staff", date: DEMO_DATE, time: "10:00", notes: "" }), () => source.reschedule("id", { date: DEMO_DATE, time: "10:00" }), () => source.cancel("id")];
    for (const operation of operations) await expect(operation()).rejects.toThrow("offline"); methods.forEach((method) => expect(method).not.toHaveBeenCalled());
  });
  it("executes existing algorithms only after the backend gate allows access", async () => {
    const raw = createLocalWorkspaceSource(); const order: string[] = []; const method = vi.spyOn(raw, "listServices").mockImplementation(async () => { order.push("local"); return []; });
    const source = guardWorkspaceSource(raw, async () => { order.push("backend"); });
    await source.listServices(); expect(order).toEqual(["backend", "local"]); expect(method).toHaveBeenCalledOnce();
  });
});
