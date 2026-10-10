"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import { createDemoAppointmentSource } from "./demo-source";
import type { AppointmentSource } from "./types";
import { useWorkspaceSource } from "@/features/workspace/workspace-provider";

const DemoAppointmentContext = createContext<AppointmentSource | null>(null);

export function DemoAppointmentProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceSource();
  const [source] = useState(() => createDemoAppointmentSource(workspace ? {
    async getSetup() {
      const [services, team] = await Promise.all([workspace.listServices(), workspace.listTeam()]);
      return {
        timeZone: "America/Argentina/Buenos_Aires",
        services: services.filter((item) => item.active).map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes })),
        staff: team.filter((item) => item.active && item.role === "professional").map(({ id, name }) => ({ id, name, initials: name.split(" ").map((part) => part[0]).slice(0, 2).join("") })),
      };
    },
  } : undefined));
  return <DemoAppointmentContext.Provider value={source}>{children}</DemoAppointmentContext.Provider>;
}

export function useDemoAppointmentSource(): AppointmentSource | null {
  return useContext(DemoAppointmentContext);
}
