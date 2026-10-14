import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { guardAuthPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";
import { isSafeReturnTo } from "@/lib/navigation/return-to";

export const metadata: Metadata = {
  title: "Crear cuenta en Nuari - Todo tu negocio en un solo lugar",
  description: "Prepará tu cuenta de Nuari para organizar tu negocio.",
};

export default async function RegisterPage(props?: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const params = props?.searchParams ? await props.searchParams : undefined;
  const safeReturnTo = isSafeReturnTo(params?.returnTo) ? params?.returnTo : undefined;

  if (!(await guardAuthPage(safeReturnTo))) return <AccessError />;
  return <AuthForm mode="register" returnTo={safeReturnTo} />;
}
