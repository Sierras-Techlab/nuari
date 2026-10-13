import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { guardAuthPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = {
  title: "Crear cuenta en Nuari - Todo tu negocio en un solo lugar",
  description: "Prepará tu cuenta de Nuari para organizar tu negocio.",
};

export default async function RegisterPage() {
  if (!await guardAuthPage()) return <AccessError />;
  return <AuthForm mode="register" />;
}
