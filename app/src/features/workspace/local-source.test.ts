import { describe, expect, it } from "vitest";

import { createLocalWorkspaceSource } from "./local-source";

describe("local workspace source", () => {
  it("adds services and team members to the active session", async () => {
    const source = createLocalWorkspaceSource();
    await source.createService({ name: "Evaluación", durationMinutes: 50, description: "Primera visita" });
    await source.createTeamMember({ name: "Ana Torres", email: "ana@negocio.test", role: "professional" });
    expect((await source.listServices()).some((item) => item.name === "Evaluación")).toBe(true);
    expect((await source.listTeam()).some((item) => item.name === "Ana Torres")).toBe(true);
  });

  it("rejects invalid and duplicate entries without changing the lists", async () => {
    const source = createLocalWorkspaceSource();
    const count = (await source.listServices()).length;
    await expect(source.createService({ name: " ", durationMinutes: 30, description: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(source.createService({ name: "Servicio estándar", durationMinutes: 30, description: "" })).rejects.toMatchObject({ code: "DUPLICATE" });
    await expect(source.createClient({ name: "Juan", phone: "", email: "bad", notes: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(source.createCashMovement({ date: "2026-10-06", kind: "in", concept: "Ajuste", amountCents: 0 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await source.listServices()).toHaveLength(count);
  });

  it("keeps clients and cash movements distinct from appointments, sales and payments", async () => {
    const source = createLocalWorkspaceSource();
    const client = await source.createClient({ name: "Elena Ruiz", phone: "11 5555 3456", email: "elena@test.local", notes: "" });
    const movement = await source.createCashMovement({ date: "2026-10-06", kind: "out", concept: "Insumos", amountCents: 250000 });
    expect((await source.listClients()).find((item) => item.id === client.id)?.name).toBe("Elena Ruiz");
    expect((await source.listCashMovements()).find((item) => item.id === movement.id)?.kind).toBe("out");
  });
});
