import type { Metadata } from "next";

import { OrganizationSettingsScreen } from "@/features/workspace/organization-settings-screen";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = {
  title: "Configuración de organización | Nuari",
  description: "Administrá la información general y las preferencias de tu negocio.",
};

export default async function SettingsPage() {
  if (!await guardPage("business")) return <AccessError />;
  return <OrganizationSettingsScreen />;
}
