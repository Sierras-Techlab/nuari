import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = {
  title: "Miembros y accesos | Nuari",
  description: "Administrá quién puede acceder a tu organización y qué permisos tiene.",
};

export default async function MembersPage() {
  if (!(await guardPage("business"))) return <AccessError />;
  redirect("/app/equipo");
}
