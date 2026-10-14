import type { Metadata } from "next";

import { AccessError } from "@/features/access/access-error";
import { ProfessionalsScreen } from "@/features/staff/professionals-screen";
import { guardPage } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Profesionales | Nuari", description: "Administrá el personal operativo de tu organización." };

export default async function ProfessionalsPage() {
  if (!await guardPage("business")) return <AccessError />;
  return <ProfessionalsScreen />;
}
