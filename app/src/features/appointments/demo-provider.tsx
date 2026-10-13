"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { createDemoAppointmentSource } from "./demo-source";
import type { AppointmentSource } from "./types";
import { useWorkspaceSource } from "@/features/workspace/workspace-provider";
import { useAccess } from "@/features/access/access-provider";
import { guardAppointmentSource } from "@/features/access/guarded-sources";
import { ApiError } from "@/lib/api/errors";

const DemoAppointmentContext = createContext<AppointmentSource | null>(null);

export function DemoAppointmentProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceSource();
  const { preflight } = useAccess();
  const gate = useRef(preflight);
  const mounted = useRef(false);
  useEffect(() => { gate.current = preflight; }, [preflight]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ensureActive = useCallback(async () => {
    await gate.current();
    if (!mounted.current) throw new ApiError(0, "CONTEXT_CHANGED", "El espacio de trabajo cambió.");
  }, []);
  const [source, setSource] = useState<AppointmentSource | null>(null);
  useEffect(() => {
    let active = true;
    const guarded = guardAppointmentSource(createDemoAppointmentSource(workspace ? {
      async getSetup() {
        const [services, team] = await Promise.all([workspace.listServices(), workspace.listTeam()]);
        return {
          timeZone: "America/Argentina/Buenos_Aires",
          services: services.filter((item) => item.active).map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes })),
          staff: team.filter((item) => item.active && item.role === "professional").map(({ id, name }) => ({ id, name, initials: name.split(" ").map((part) => part[0]).slice(0, 2).join("") })),
        };
      },
    } : undefined), ensureActive);
    queueMicrotask(() => { if (active) setSource(guarded); });
    return () => { active = false; };
  }, [workspace, ensureActive]);
  return source ? <DemoAppointmentContext.Provider value={source}>{children}</DemoAppointmentContext.Provider> : null;
}

export function useDemoAppointmentSource(): AppointmentSource | null {
  return useContext(DemoAppointmentContext);
}
