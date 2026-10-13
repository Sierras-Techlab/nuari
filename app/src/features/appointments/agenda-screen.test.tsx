/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/access/access-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/access/access-provider")>();
  return { ...actual, useAccess: () => ({ preflight: async () => undefined }) };
});

import { AgendaScreen } from "./agenda-screen";
import { DemoAppointmentProvider } from "./demo-provider";
import { createDemoAppointmentSource } from "./demo-source";

describe("AgendaScreen", () => {
  afterEach(cleanup);

  it("loads a demo day, filters by professional and shows an empty day", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);

    expect(await screen.findByRole("button", { name: "Ver turno de Nicolás García" })).toBeTruthy();
    expect(screen.getByText("4 turnos")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Filtrar por profesional"), { target: { value: "juli" } });
    expect(screen.queryByRole("button", { name: "Ver turno de Nicolás García" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ver turno de Sofía Romano" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente día" }));
    expect(await screen.findByText("No hay turnos para esta fecha")).toBeTruthy();
  });

  it("creates, reschedules and cancels a turn during the demo session", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);
    await screen.findByRole("button", { name: "Ver turno de Nicolás García" });

    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Lara Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "1123456789" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "estandar" } });
    fireEvent.change(screen.getByLabelText("Profesional"), { target: { value: "martin" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar turno" }));

    expect(await screen.findByRole("button", { name: "Ver turno de Lara Pérez" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver turno de Lara Pérez" }));
    fireEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-07" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambio" }));

    await screen.findByText("Turno reprogramado");
    expect(await screen.findByRole("button", { name: "Ver turno de Lara Pérez" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver turno de Lara Pérez" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));

    await waitFor(() => {
      expect(screen.getByText("Turno cancelado")).toBeTruthy();
    });
  });

  it("shows an occupied-slot error and preserves form values", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);
    await screen.findByRole("button", { name: "Ver turno de Nicolás García" });

    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Lara Pérez" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "estandar" } });
    fireEvent.change(screen.getByLabelText("Profesional"), { target: { value: "martin" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar turno" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("ocupado");
    expect((screen.getByLabelText("Nombre del cliente") as HTMLInputElement).value).toBe("Lara Pérez");
  });

  it("keeps the selected day when the native date input is cleared", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);
    await screen.findByRole("button", { name: "Ver turno de Nicolás García" });

    fireEvent.change(screen.getByLabelText("Ir a fecha"), { target: { value: "" } });

    expect((screen.getByLabelText("Ir a fecha") as HTMLInputElement).value).toBe("2026-10-06");
    expect(screen.getByRole("button", { name: "Ver turno de Nicolás García" })).toBeTruthy();
  });

  it("lets the operator retry after a failed agenda load", async () => {
    const backing = createDemoAppointmentSource();
    let firstRead = true;
    const source = {
      ...backing,
      list(date: string) {
        if (firstRead) {
          firstRead = false;
          return Promise.reject(new Error("Sin conexión"));
        }
        return backing.list(date);
      },
    };
    render(<AgendaScreen source={source} />);

    expect(await screen.findByText("Sin conexión")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Nuevo turno" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("button", { name: "Ver turno de Nicolás García" })).toBeTruthy();
  });

  it("reveals a newly created turn even when a different professional was filtered", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);
    await screen.findByRole("button", { name: "Ver turno de Nicolás García" });
    fireEvent.change(screen.getByLabelText("Filtrar por profesional"), { target: { value: "juli" } });

    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Lara Pérez" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "estandar" } });
    fireEvent.change(screen.getByLabelText("Profesional"), { target: { value: "martin" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar turno" }));

    expect(await screen.findByRole("button", { name: "Ver turno de Lara Pérez" })).toBeTruthy();
  });

  it("keeps reverse keyboard navigation inside the detail and confirmation dialogs", async () => {
    render(<AgendaScreen source={createDemoAppointmentSource()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver turno de Nicolás García" }));

    const detail = screen.getByRole("dialog");
    const detailTitle = screen.getByRole("heading", { name: "Detalle del turno" });
    expect(document.activeElement).toBe(detailTitle);
    fireEvent.keyDown(detailTitle, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reprogramar" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
    const confirmation = screen.getByRole("dialog");
    const confirmationTitle = screen.getByRole("heading", { name: "Cancelar turno" });
    expect(document.activeElement).toBe(confirmationTitle);
    fireEvent.keyDown(confirmationTitle, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirmar cancelación" }));
    expect(detail).not.toBe(confirmation);
  });

  it("keeps demo changes when the agenda unmounts during internal navigation", async () => {
    const view = render(<DemoAppointmentProvider><AgendaScreen /></DemoAppointmentProvider>);
    await screen.findByRole("button", { name: "Ver turno de Nicolás García" });
    fireEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Lara Pérez" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "estandar" } });
    fireEvent.change(screen.getByLabelText("Profesional"), { target: { value: "martin" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar turno" }));
    await screen.findByRole("button", { name: "Ver turno de Lara Pérez" });

    view.rerender(<DemoAppointmentProvider><div>Otra pantalla interna</div></DemoAppointmentProvider>);
    view.rerender(<DemoAppointmentProvider><AgendaScreen /></DemoAppointmentProvider>);
    expect(await screen.findByRole("button", { name: "Ver turno de Lara Pérez" })).toBeTruthy();
  });
});
