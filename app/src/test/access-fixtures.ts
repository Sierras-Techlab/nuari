import type { AccessSnapshot } from "@/lib/api/contracts";
export function accessFixture(withMembership = true): AccessSnapshot {
  return {
    user: { id: "10000000-0000-4000-8000-000000000001", name: "Juan Pérez", email: "juan@example.com", emailVerifiedAt: "2026-10-12T00:00:00.000Z" },
    memberships: withMembership ? [{ id: "20000000-0000-4000-8000-000000000001", role: "OWNER", organization: { id: "30000000-0000-4000-8000-000000000001", name: "Estudio", slug: "estudio", businessType: "SERVICES", timezone: "America/Argentina/Buenos_Aires", currency: "ARS", createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z" } }] : [],

    activeOrganizationId: withMembership ? "30000000-0000-4000-8000-000000000001" : null,
    access: withMembership ? { businessAllowed: true, reason: "TRIAL_ACTIVE", validUntil: "2099-10-26T00:00:00.000Z", canManageSubscription: true } : null,
    onboarding: { canCreateOrganization: !withMembership, reason: withMembership ? "HAS_MEMBERSHIP" : "ELIGIBLE" },
  };
}
