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
import { ClientsScreen } from "./clients-screen";
import { ServicesScreen } from "./services-screen";
import { TeamScreen } from "./team-screen";
import { WorkspaceProvider } from "./workspace-provider";

describe("workspace sections", () => {
  afterEach(cleanup);

  it("adds a service and keeps validation errors in the form", async () => {
    render(<WorkspaceProvider><ServicesScreen /></WorkspaceProvider>);
    await screen.findByText("Servicio estándar");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Evaluación" } });
    fireEvent.change(screen.getByLabelText("Duración en minutos"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    expect(await screen.findByText("Evaluación")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Evaluación" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Evaluación");
  });

  it("searches clients, adds one and opens the contact card", async () => {
    render(<WorkspaceProvider><ClientsScreen /></WorkspaceProvider>);
    await screen.findByRole("button", { name: /Nicolás García/ });
    fireEvent.change(screen.getByLabelText("Buscar clientes"), { target: { value: "Sofía" } });
    expect(screen.queryByRole("button", { name: /Nicolás García/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Elena Ruiz" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "11 5555 9090" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar cliente" }));
    expect(await screen.findByRole("button", { name: /Elena Ruiz/ })).toBeTruthy();
    expect(screen.getAllByText("11 5555 9090")).toHaveLength(2);
  });

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

  it("adds a professional to the team directory", async () => {
    render(<WorkspaceProvider><TeamScreen /></WorkspaceProvider>);
    await screen.findByText("Martín Ríos");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Torres" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@negocio.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar integrante" }));
    await waitFor(() => expect(screen.getByText("Ana Torres")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Filtrar por función"), { target: { value: "admin" } });
    expect(screen.queryByText("Ana Torres")).toBeNull();
  });

  it("offers newly added services and professionals when creating a turn", async () => {
    const tree = (child: React.ReactNode) => <WorkspaceProvider><DemoAppointmentProvider>{child}</DemoAppointmentProvider></WorkspaceProvider>;
    const view = render(tree(<ServicesScreen />));
    await screen.findByText("Servicio estándar");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Evaluación" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    await screen.findByText("Evaluación");

    view.rerender(tree(<TeamScreen />));
    await screen.findByText("Martín Ríos");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Torres" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@negocio.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar integrante" }));
    await screen.findByText("Ana Torres");

    view.rerender(tree(<AgendaScreen />));
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo turno" }));
    expect(screen.getByRole("option", { name: /Evaluación/ })).toBeTruthy();
    expect(screen.getAllByRole("option", { name: "Ana Torres" })).toHaveLength(2);
  });
});
