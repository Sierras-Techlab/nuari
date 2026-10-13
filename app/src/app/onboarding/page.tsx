import type { Metadata } from "next";

import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { AccessProvider } from "@/features/access/access-provider";
import { AccessError } from "@/features/access/access-error";
import { guardPage } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Configura tu negocio - Nuari",
  description: "Prepará el espacio de tu negocio en Nuari.",
};

export default async function OnboardingPage() {
  const snapshot = await guardPage("onboarding");
  if (!snapshot) return <AccessError />;
  return <AccessProvider initialSnapshot={snapshot}><OnboardingScreen /></AccessProvider>;
}
