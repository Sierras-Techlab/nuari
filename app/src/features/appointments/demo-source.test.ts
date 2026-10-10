import { describe, expect, it } from "vitest";

import { createDemoAppointmentSource } from "./demo-source";
import { createLocalWorkspaceSource } from "@/features/workspace/local-source";

describe("demo appointment source", () => {
  it("keeps created, rescheduled and cancelled appointments in the active demo session", async () => {
    const source = createDemoAppointmentSource();
    const created = await source.create({
      customerName: "Lara Pérez",
      customerPhone: "1123456789",
      serviceId: "estandar",
      staffId: "martin",
      date: "2026-10-06",
      time: "16:00",
      notes: "",
    });

    expect(created.status).toBe("scheduled");
    expect((await source.list("2026-10-06")).some((item) => item.id === created.id)).toBe(true);

    const moved = await source.reschedule(created.id, { date: "2026-10-07", time: "10:00" });
    expect(moved.date).toBe("2026-10-07");
    expect((await source.list("2026-10-06")).some((item) => item.id === created.id)).toBe(false);

    const cancelled = await source.cancel(created.id);
    expect(cancelled.status).toBe("cancelled");
    expect((await source.list("2026-10-07")).find((item) => item.id === created.id)?.status).toBe("cancelled");
  });

  it("returns a recognizable conflict without changing the appointment", async () => {
    const source = createDemoAppointmentSource();
    const before = await source.list("2026-10-06");
    const occupied = before.find((item) => item.status === "scheduled");
    expect(occupied).toBeDefined();

    await expect(source.create({
      customerName: "Lara Pérez",
      customerPhone: "",
      serviceId: "estandar",
      staffId: occupied!.staffId,
      date: occupied!.date,
      time: occupied!.time,
      notes: "",
    })).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    expect(await source.list("2026-10-06")).toHaveLength(before.length);
  });

  it("rejects a blank customer name even when the browser accepts whitespace", async () => {
    const source = createDemoAppointmentSource();
    await expect(source.create({
      customerName: "   ",
      customerPhone: "",
      serviceId: "estandar",
      staffId: "martin",
      date: "2026-10-06",
      time: "16:00",
      notes: "",
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects invalid dates and times at the adapter boundary", async () => {
    const source = createDemoAppointmentSource();
    const valid = {
      customerName: "Lara Pérez",
      customerPhone: "",
      serviceId: "estandar",
      staffId: "martin",
      date: "2026-10-06",
      time: "16:00",
      notes: "",
    };
    await expect(source.create({ ...valid, date: "2026-02-30" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(source.create({ ...valid, time: "invalid" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(source.reschedule("demo-1", { date: "2026-10-06", time: "25:00" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(source.reschedule("demo-1", { date: "2026-13-01", time: "10:00" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await source.list("2026-10-06")).find((item) => item.id === "demo-1")?.time).toBe("09:00");
  });

  it("uses services and professionals added to the shared workspace", async () => {
    const workspace = createLocalWorkspaceSource();
    const service = await workspace.createService({ name: "Evaluación", durationMinutes: 50, description: "" });
    const person = await workspace.createTeamMember({ name: "Ana Torres", email: "ana@negocio.test", role: "professional" });
    const source = createDemoAppointmentSource({
      async getSetup() {
        const [services, team] = await Promise.all([workspace.listServices(), workspace.listTeam()]);
        return {
          timeZone: "America/Argentina/Buenos_Aires",
          services,
          staff: team.filter((item) => item.role === "professional").map((item) => ({ id: item.id, name: item.name, initials: "AT" })),
        };
      },
    });
    const created = await source.create({ customerName: "Elena Ruiz", customerPhone: "", serviceId: service.id, staffId: person.id, date: "2026-10-06", time: "16:00", notes: "" });
    expect(created.serviceId).toBe(service.id);
    expect(created.staffId).toBe(person.id);
  });
});
