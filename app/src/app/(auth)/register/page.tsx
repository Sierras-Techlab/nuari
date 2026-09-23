import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Crear cuenta en Nuari - Todo tu negocio en un solo lugar",
  description: "Prepará tu cuenta de Nuari para organizar tu negocio.",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
