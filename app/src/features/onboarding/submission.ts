import type { OrganizationInput } from "@/lib/api/contracts";
export type OnboardingAttempt = Readonly<{ key: string; payload: Readonly<OrganizationInput> }>;
export function freezeOnboardingAttempt(payload: OrganizationInput): OnboardingAttempt {
  return Object.freeze({ key: crypto.randomUUID(), payload: Object.freeze({ ...payload }) });
}
