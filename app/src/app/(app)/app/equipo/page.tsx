import type { Metadata } from "next";

import { TeamScreen } from "@/features/workspace/team-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = { title: "Equipo | Nuari", description: "Equipo operativo y administración de Nuari." };

export default async function TeamPage() { if (!await guardPage("business")) return <AccessError />; return <TeamScreen />; }
