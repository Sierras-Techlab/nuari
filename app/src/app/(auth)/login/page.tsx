import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Ingresar a Nuari - Todo tu negocio en un solo lugar",
  description: "Ingresá a tu espacio de trabajo de Nuari.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
