import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { DemoAppointmentProvider } from "@/features/appointments/demo-provider";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";

export default function InternalAppLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider><DemoAppointmentProvider><AppShell>{children}</AppShell></DemoAppointmentProvider></WorkspaceProvider>;
}
