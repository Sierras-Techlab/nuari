import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { guardAuthPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

export const metadata: Metadata = {
  title: "Ingresar a Nuari - Todo tu negocio en un solo lugar",
  description: "Ingresá a tu espacio de trabajo de Nuari.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  if (!await guardAuthPage()) return <AccessError />;
  const params = await searchParams;
  return <AuthForm mode="login" registered={params.registered === "1"} />;
}
