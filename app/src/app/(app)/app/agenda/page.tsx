import type { Metadata } from "next";

import { AgendaScreen } from "@/features/appointments/agenda-screen";

export const metadata: Metadata = {
  title: "Agenda de turnos | Nuari",
  description: "Agenda de turnos del módulo Turnero de Nuari.",
};

export default function AgendaPage() {
  return <AgendaScreen />;
}
