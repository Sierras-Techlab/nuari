/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/access/access-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/access/access-provider")>();
  return { ...actual, useAccess: () => ({ preflight: async () => undefined }) };
});

import { AgendaScreen } from "@/features/appointments/agenda-screen";
import { DemoAppointmentProvider } from "@/features/appointments/demo-provider";

import { CashScreen } from "./cash-screen";
import { WorkspaceProvider } from "./workspace-provider";

describe("workspace sections", () => {
  afterEach(cleanup);

  it("records a manual cash movement and filters the register", async () => {
    render(<WorkspaceProvider><CashScreen /></WorkspaceProvider>);
    const filterDate = await screen.findByLabelText<HTMLInputElement>("Fecha", { selector: "input#cash-filter-date" });
    await waitFor(() => expect(filterDate.value).toBeTruthy());
    fireEvent.change(filterDate, { target: { value: "2026-10-06" } });
    await screen.findByText("Insumos");
    fireEvent.change(screen.getByLabelText("Fecha del movimiento"), { target: { value: "2026-10-07" } });
    fireEvent.change(screen.getByLabelText("Tipo", { selector: "select#cash-kind" }), { target: { value: "out" } });
    fireEvent.change(screen.getByLabelText("Concepto"), { target: { value: "Transporte" } });
    fireEvent.change(screen.getByLabelText("Importe (ARS)"), { target: { value: "1200,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar movimiento" }));
    expect(await screen.findByText("Transporte")).toBeTruthy();
    expect(filterDate.value).toBe("2026-10-07");
    expect(screen.getByText("Salida · 2026-10-07")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tipo", { selector: "select#cash-filter-kind" }), { target: { value: "out" } });
    expect(screen.queryByText("Ingreso manual")).toBeNull();
  });

  it("keeps demo services and professionals available to the local appointment prototype", async () => {
    const tree = (child: React.ReactNode) => <WorkspaceProvider><DemoAppointmentProvider>{child}</DemoAppointmentProvider></WorkspaceProvider>;
    render(tree(<AgendaScreen />));
    const newAppointment = await screen.findByRole("button", { name: "Nuevo turno" });
    await waitFor(() => expect((newAppointment as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(newAppointment);
    expect(screen.getByRole("option", { name: /Servicio estándar/ })).toBeTruthy();
    expect(screen.getAllByRole("option", { name: "Martín Ríos" })).toHaveLength(2);
  });
});
