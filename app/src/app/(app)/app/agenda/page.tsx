import type { Metadata } from "next";

import { AgendaScreen } from "@/features/appointments/agenda-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = {
  title: "Agenda de turnos | Nuari",
  description: "Agenda de turnos del módulo Turnero de Nuari.",
};

export default async function AgendaPage() {
  if (!await guardPage("business")) return <AccessError />;
  return <AgendaScreen />;
}
