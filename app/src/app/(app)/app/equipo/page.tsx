import type { Metadata } from "next";

import { TeamScreen } from "@/features/workspace/team-screen";

export const metadata: Metadata = { title: "Equipo | Nuari", description: "Equipo operativo y administración de Nuari." };

export default function TeamPage() { return <TeamScreen />; }
