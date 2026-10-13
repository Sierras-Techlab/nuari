export type BusinessType = "SERVICES" | "COMMERCE" | "HOSPITALITY";
export type PlanCode = "BASIC" | "PRO" | "BUSINESS" | "TOURISM";
export type OrganizationRole = "OWNER" | "ADMIN" | "EMPLOYEE";
export type UserDTO = { id: string; name: string; email: string; emailVerifiedAt: string | null };
export type OrganizationDTO = { id: string; name: string; slug: string; businessType: BusinessType; createdAt: string; updatedAt: string };
export type MembershipDTO = { id: string; organizationId: string; role: OrganizationRole; status: "ACTIVE" | "INACTIVE" };
export type SubscriptionDTO = { id: string; organizationId: string; planCode: PlanCode; status: "TRIALING" | "EXPIRED" | "ACTIVE" | "PAST_DUE" | "CANCELED"; trialStartedAt: string; trialEndsAt: string; paidThrough: string | null };
export type Access = { businessAllowed: boolean; reason: "TRIAL_ACTIVE" | "PAID_ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_INACTIVE"; validUntil: string | null; canManageSubscription: boolean };
export type AccessSnapshot = {
  user: UserDTO;
  memberships: { id: string; role: OrganizationRole; organization: OrganizationDTO }[];
  activeOrganizationId: string | null;
  access: Access | null;
  onboarding: { canCreateOrganization: boolean; reason: "ELIGIBLE" | "EMAIL_UNVERIFIED" | "HAS_MEMBERSHIP" | "TRIAL_ALREADY_USED" };
};
export type OrganizationInput = { name: string; slug: string; businessType: BusinessType; planCode: PlanCode };
export type OrganizationResult = { organization: OrganizationDTO; membership: MembershipDTO; subscription: SubscriptionDTO };
export type WorkspaceDTO = { organization: OrganizationDTO; membership: MembershipDTO; access: Access; evaluatedAt: string };
export type SubscriptionResult = { subscription: SubscriptionDTO; access: Access };
export type ApiErrorCode = "VALIDATION_ERROR" | "INVALID_TOKEN" | "INVALID_IDEMPOTENCY_KEY" | "UNAUTHENTICATED" | "INVALID_CREDENTIALS" | "CSRF_INVALID" | "EMAIL_UNVERIFIED" | "TRIAL_ALREADY_USED" | "PERMISSION_DENIED" | "SUBSCRIPTION_REQUIRED" | "ORGANIZATION_NOT_FOUND" | "SLUG_TAKEN" | "ONBOARDING_ALREADY_COMPLETED" | "IDEMPOTENCY_CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE" | "CONTEXT_CHANGED";
export type ApiErrorDTO = { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string[]> };
const errorCodes = new Set<string>(["VALIDATION_ERROR", "INVALID_TOKEN", "INVALID_IDEMPOTENCY_KEY", "UNAUTHENTICATED", "INVALID_CREDENTIALS", "CSRF_INVALID", "EMAIL_UNVERIFIED", "TRIAL_ALREADY_USED", "PERMISSION_DENIED", "SUBSCRIPTION_REQUIRED", "ORGANIZATION_NOT_FOUND", "SLUG_TAKEN", "ONBOARDING_ALREADY_COMPLETED", "IDEMPOTENCY_CONFLICT", "RATE_LIMITED", "INTERNAL_ERROR", "SERVICE_UNAVAILABLE", "CONTEXT_CHANGED"]);

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function nullableString(value: unknown): boolean { return value === null || typeof value === "string"; }
function role(value: unknown): boolean { return value === "OWNER" || value === "ADMIN" || value === "EMPLOYEE"; }
function organization(value: unknown): boolean {
  return record(value) && [value.id, value.name, value.slug, value.createdAt, value.updatedAt].every((field) => typeof field === "string") && ["SERVICES", "COMMERCE", "HOSPITALITY"].includes(String(value.businessType));
}
function access(value: unknown): boolean {
  return record(value) && typeof value.businessAllowed === "boolean" && typeof value.canManageSubscription === "boolean" && nullableString(value.validUntil) && ["TRIAL_ACTIVE", "PAID_ACTIVE", "TRIAL_EXPIRED", "SUBSCRIPTION_INACTIVE"].includes(String(value.reason));
}
export function isAccessSnapshot(value: unknown): value is AccessSnapshot {
  if (!record(value) || !record(value.user) || !record(value.onboarding) || !Array.isArray(value.memberships)) return false;
  return [value.user.id, value.user.name, value.user.email].every((field) => typeof field === "string") && nullableString(value.user.emailVerifiedAt)
    && value.memberships.every((member: unknown) => record(member) && typeof member.id === "string" && role(member.role) && organization(member.organization))
    && nullableString(value.activeOrganizationId) && (value.access === null || access(value.access))
    && typeof value.onboarding.canCreateOrganization === "boolean" && ["ELIGIBLE", "EMAIL_UNVERIFIED", "HAS_MEMBERSHIP", "TRIAL_ALREADY_USED"].includes(String(value.onboarding.reason))
    && (value.activeOrganizationId === null ? value.access === null : value.memberships.some((member: unknown) => record(member) && record(member.organization) && member.organization.id === value.activeOrganizationId));
}
export function isApiErrorDTO(value: unknown): value is ApiErrorDTO {
  return record(value) && typeof value.code === "string" && errorCodes.has(value.code) && typeof value.message === "string" && (value.fieldErrors === undefined || (record(value.fieldErrors) && Object.values(value.fieldErrors).every((errors) => Array.isArray(errors) && errors.every((error: unknown) => typeof error === "string"))));
}
