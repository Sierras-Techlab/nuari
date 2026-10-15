export type BusinessType = "SERVICES" | "COMMERCE" | "HOSPITALITY";
export type PlanCode = "BASIC" | "PRO" | "BUSINESS" | "TOURISM";
export type OrganizationRole = "OWNER" | "ADMIN" | "EMPLOYEE";
export type UserDTO = { id: string; name: string; email: string; emailVerifiedAt: string | null };
export type OrganizationDTO = {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;
  address?: string;
  timezone: string;
  currency: string;
  confirmCurrencyChange?: boolean;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type MembershipDTO = { id: string; organizationId: string; role: OrganizationRole; status: "ACTIVE" | "INACTIVE" };
export type MemberDetailDTO = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};
export type InvitationDTO = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};
export type PublicInvitationDTO = {
  id: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
};
export type AcceptInvitationResult = {
  organization: OrganizationDTO;
  membership: MembershipDTO;
};
export type UpdateOrganizationInput = Partial<{
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  state: string | null;
  city: string | null;
  zip: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
}>;
export type CreateInvitationInput = {
  email: string;
  role: OrganizationRole;
};
export type SubscriptionDTO = { id: string; organizationId: string; planCode: PlanCode; status: "TRIALING" | "EXPIRED" | "ACTIVE" | "PAST_DUE" | "CANCELED"; trialStartedAt: string; trialEndsAt: string; paidThrough: string | null };
export type Access = { businessAllowed: boolean; reason: "TRIAL_ACTIVE" | "PAID_ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_INACTIVE"; validUntil: string | null; canManageSubscription: boolean };
export type AccessSnapshot = {
  user: UserDTO;
  memberships: { id: string; role: OrganizationRole; organization: OrganizationDTO }[];
  activeOrganizationId: string | null;
  access: Access | null;
  onboarding: { canCreateOrganization: boolean; reason: "ELIGIBLE" | "EMAIL_UNVERIFIED" | "HAS_MEMBERSHIP" | "TRIAL_ALREADY_USED" | "ACCESS_REVOKED" };
};
export type OrganizationInput = { name: string; slug: string; businessType: BusinessType; planCode: PlanCode };
export type OrganizationResult = { organization: OrganizationDTO; membership: MembershipDTO; subscription: SubscriptionDTO };
export type WorkspaceDTO = { organization: OrganizationDTO; membership: MembershipDTO; access: Access; evaluatedAt: string };
export type SubscriptionResult = { subscription: SubscriptionDTO; access: Access };
export type CustomerDTO = {
  id: string; organizationId: string; name: string; phone: string | null; email: string | null;
  active: boolean; version: number; createdAt: string; updatedAt: string; notes?: string | null;
};
export type CustomerSummaryDTO = Omit<CustomerDTO, "notes">;
export type CustomerPageDTO = { items: CustomerSummaryDTO[]; pageInfo: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; windowLimitReached: boolean } };
export type CustomerListInput = { limit?: number; offset?: number; status?: "active" | "inactive" | "all"; q?: string };
export type CreateCustomerInput = { name: string; phone?: string | null; email?: string | null; notes?: string | null };
export type UpdateCustomerInput = Partial<CreateCustomerInput> & { active?: boolean };
export type DuplicateCustomerCandidatesDTO = { items: CustomerSummaryDTO[]; hasMore: boolean };
export type ServiceCategoryDTO = {
  id: string; organizationId: string; name: string; active: boolean; sortOrder: number; version: number; createdAt: string; updatedAt: string;
};
export type ServiceDTO = {
  id: string; organizationId: string; name: string; description: string | null; durationMinutes: number;
  pricingType: "FIXED" | "FROM" | "ON_REQUEST"; price: string | null; currency: string; categoryId: string | null;
  active: boolean; sortOrder: number; staffSelectionMode: "CUSTOMER_CHOICE" | "AUTO_ASSIGN" | "NO_ASSIGNMENT";
  modality: "IN_PERSON"; version: number; createdAt: string; updatedAt: string;
};
export type StaffSummaryDTO = {
  id: string; organizationId: string; name: string; active: boolean; version: number; createdAt: string; updatedAt: string;
};
export type StaffDTO = StaffSummaryDTO & { email: string | null; phone: string | null; userId: string | null };
export type StaffServiceDTO = {
  organizationId: string; serviceId: string; staffMemberId: string; createdAt: string;
  staff: { id: string; name: string; active: boolean }; service: { id: string; name: string; active: boolean };
};
export type OperationalPageInfo = { limit: number; offset: number; hasMore: boolean; nextOffset: number | null; windowLimitReached: boolean };
export type ServicePageDTO = { items: ServiceDTO[]; pageInfo: OperationalPageInfo };
export type ServiceCategoryPageDTO = { items: ServiceCategoryDTO[]; pageInfo: OperationalPageInfo };
export type StaffPageDTO = { items: StaffSummaryDTO[]; pageInfo: OperationalPageInfo };
export type StaffServicePageDTO = { items: StaffServiceDTO[]; pageInfo: OperationalPageInfo };
export type CreateServiceCategoryInput = { name: string; sortOrder?: number };
export type UpdateServiceCategoryInput = Partial<CreateServiceCategoryInput> & { active?: boolean };
export type CreateServiceInput = {
  name: string; description?: string | null; durationMinutes: number; pricingType?: ServiceDTO["pricingType"];
  price?: string | null; categoryId?: string | null; sortOrder?: number;
  staffSelectionMode: ServiceDTO["staffSelectionMode"]; modality?: ServiceDTO["modality"];
};
export type UpdateServiceInput = Partial<CreateServiceInput> & { active?: boolean };
export type ServiceListInput = { limit?: number; offset?: number; status?: "active" | "inactive" | "all"; q?: string; categoryId?: string; staffSelectionMode?: ServiceDTO["staffSelectionMode"] };
export type ServiceCategoryListInput = { limit?: number; offset?: number; status?: "active" | "inactive" | "all"; q?: string };
export type StaffListInput = { limit?: number; offset?: number; status?: "active" | "inactive" | "all"; q?: string };
export type StaffServiceListQuery = { limit?: number; offset?: number; status?: "active" | "inactive" | "all" };
export type CreateStaffInput = { name: string; email?: string | null; phone?: string | null };
export type UpdateStaffInput = Partial<CreateStaffInput> & { active?: boolean };
export type StaffServiceMutationDTO = { association: StaffServiceDTO; serviceVersion: number };
export type StaffServiceRemoveDTO = { serviceVersion: number };
export type AppointmentDTO = {
  id: string; organizationId: string; customerId: string; serviceId: string; staffMemberId: string | null;
  startAt: string; endAt: string; durationMinutes: number; assignmentKind: "SPECIFIC" | "ANY" | "NONE";
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"; source: "INTERNAL" | "PUBLIC";
  version: number; customerNameSnapshot: string; serviceNameSnapshot: string; staffNameSnapshot: string | null; timezone: string;
  internalNotes?: string | null;
};
export type AppointmentPageDTO = { items: AppointmentDTO[]; pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null }; timeZone: string };
export type AppointmentListQuery = { fromDate: string; toDate: string; staffMemberId?: string; status?: AppointmentDTO["status"]; limit?: number; cursor?: string };
export type AppointmentAssignment = { kind: "SPECIFIC"; staffMemberId: string } | { kind: "ANY" } | { kind: "NONE" };
export type AppointmentCreateInput = { customerId: string; serviceId: string; startAt: string; assignment: AppointmentAssignment; internalNotes?: string };
export type AppointmentCancelReason = "CUSTOMER_REQUEST" | "BUSINESS_REQUEST" | "OTHER";
export type AvailabilityDTO = { slots: Array<{ startAt: string; endAt: string; localDate: string; localTime: string; offset: string; timeZone: string; staff: Array<{ id: string; name: string }> }>; hasMore: boolean; nextCursor: string | null; timeZone: string };
export type AvailabilityQuery = { serviceId: string; selection: "SPECIFIC" | "ANY" | "NONE"; staffMemberId?: string; fromDate?: string; toDate?: string; at?: string; cursor?: string };
export type BookingCalendarDTO = {
  id: string; organizationId: string; kind: "BUSINESS" | "STAFF"; staffMemberId: string | null; version: number;
  weeklyWindows: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  dayOverrides: Array<{ localDate: string; windows: Array<{ startMinute: number; endMinute: number }> }>;
  timeOff: Array<{ id: string; startAt: string; endAt: string; reasonCode: "BUSINESS_CLOSED" | "STAFF_ABSENCE" | "OTHER" }>;
};
export type SchedulingSettingsDTO = { slotStepMinutes: 5 | 10 | 15 | 30; version: number };
export type PublicBookingServiceDTO = Pick<ServiceDTO, "id" | "name" | "description" | "durationMinutes" | "pricingType" | "price" | "currency" | "staffSelectionMode"> & { staff?: Array<Pick<StaffSummaryDTO, "id" | "name">>; staffPage?: { limit: number; hasMore: boolean; nextOffset: number | null } };
export type PublicBookingCatalogDTO = {
  organization: { id: string; name: string; timezone: string; currency: string };
  timeZone: string;
  policy: { slotStepMinutes: 5 | 10 | 15 | 30; minNoticeMinutes: number; maxAdvanceDays: number; cancelNoticeMinutes: number };
  services: PublicBookingServiceDTO[];
};
export type PublicBookingStaffPageDTO = { items: Array<Pick<StaffSummaryDTO, "id" | "name">>; pageInfo: { limit: number; offset: number; hasMore: boolean; nextOffset: number | null } };
export type PublicAvailabilityQuery = { serviceId: string; selection: "SPECIFIC" | "ANY" | "NONE"; staffMemberId?: string; fromDate: string; toDate: string; cursor?: string };
export type PublicAvailabilityDTO = AvailabilityDTO;
export type PublicBookingCreateInput = { serviceId: string; startAt: string; assignment: AppointmentAssignment; customer: { name: string; phone?: string; email?: string } };
export type PublicBookingReceiptDTO = { id: string; status: "CONFIRMED"; startAt: string; endAt: string; durationMinutes: number; serviceName: string; staffName: string | null; timeZone: string; version: number; managementToken: string };
export type PublicManagedBookingDTO = {
  id: string; serviceId: string; status: AppointmentDTO["status"]; startAt: string; endAt: string; durationMinutes: number;
  serviceName: string; staffName: string | null; staffSelectionMode: "CUSTOMER_CHOICE" | "AUTO_ASSIGN" | "NO_ASSIGNMENT";
  assignment: { kind: "SPECIFIC"; staffMemberId: string } | { kind: "ANY"; staffMemberId?: string } | { kind: "NONE" }; timeZone: string; version: number;
  actions: { canCancel: boolean; canReschedule: boolean };
};
export type PublicRescheduleAvailabilityQuery = {
  selection: "SPECIFIC" | "ANY" | "NONE"; staffMemberId?: string; fromDate: string; toDate: string; cursor?: string;
};
export type PublicRescheduleInput = { token: string; startAt: string; assignment: AppointmentAssignment };
export type PublicCancelInput = { token: string; reasonCode: "CUSTOMER_REQUEST" };
export type PublicManagedBookingResultDTO = { id: string; status: AppointmentDTO["status"]; startAt: string; endAt: string; durationMinutes: number; serviceName: string; staffName: string | null; timeZone: string; version: number };
export type ApiErrorCode = "VALIDATION_ERROR" | "INVALID_TOKEN" | "INVALID_IDEMPOTENCY_KEY" | "IDEMPOTENCY_KEY_REUSED" | "UNAUTHENTICATED" | "INVALID_CREDENTIALS" | "CSRF_INVALID" | "EMAIL_UNVERIFIED" | "TRIAL_ALREADY_USED" | "PERMISSION_DENIED" | "SUBSCRIPTION_REQUIRED" | "ORGANIZATION_NOT_FOUND" | "BOOKING_NOT_AVAILABLE" | "MANAGEMENT_LINK_NOT_AVAILABLE" | "BOOKING_BUSY" | "SLUG_TAKEN" | "ONBOARDING_ALREADY_COMPLETED" | "IDEMPOTENCY_CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE" | "CONTEXT_CHANGED" | "CANNOT_REMOVE_LAST_OWNER" | "MEMBER_NOT_FOUND" | "INVITATION_NOT_FOUND" | "ALREADY_MEMBER" | "EMAIL_MISMATCH" | "INVALID_INVITATION" | "CUSTOMER_NOT_FOUND" | "SERVICE_NOT_FOUND" | "SERVICE_CATEGORY_NOT_FOUND" | "STAFF_MEMBER_NOT_FOUND" | "SERVICE_NAME_TAKEN" | "SERVICE_CATEGORY_NAME_TAKEN" | "RELATED_ENTITY_INACTIVE" | "CURRENCY_CHANGE_REQUIRES_MIGRATION" | "VERSION_CONFLICT" | "SLOT_UNAVAILABLE" | "VERSION_MISMATCH" | "INVALID_APPOINTMENT_TRANSITION" | "SCHEDULE_HAS_BOOKINGS" | "BOOKING_CONFIGURATION_CHANGED" | "APPOINTMENT_NOT_FOUND";

export type ApiErrorDTO = { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string[]> };
const errorCodes = new Set<string>([
  "VALIDATION_ERROR",
  "INVALID_TOKEN",
  "INVALID_IDEMPOTENCY_KEY",
  "IDEMPOTENCY_KEY_REUSED",
  "BOOKING_NOT_AVAILABLE",
  "MANAGEMENT_LINK_NOT_AVAILABLE",
  "BOOKING_BUSY",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "CSRF_INVALID",
  "EMAIL_UNVERIFIED",
  "TRIAL_ALREADY_USED",
  "PERMISSION_DENIED",
  "SUBSCRIPTION_REQUIRED",
  "ORGANIZATION_NOT_FOUND",
  "SLUG_TAKEN",
  "ONBOARDING_ALREADY_COMPLETED",
  "IDEMPOTENCY_CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "CONTEXT_CHANGED",
  "CANNOT_REMOVE_LAST_OWNER",
  "MEMBER_NOT_FOUND",
  "INVITATION_NOT_FOUND",
  "ALREADY_MEMBER",
  "EMAIL_MISMATCH",
  "INVALID_INVITATION",
  "CUSTOMER_NOT_FOUND",
  "SERVICE_NOT_FOUND",
  "SERVICE_CATEGORY_NOT_FOUND",
  "STAFF_MEMBER_NOT_FOUND",
  "SERVICE_NAME_TAKEN",
  "SERVICE_CATEGORY_NAME_TAKEN",
  "RELATED_ENTITY_INACTIVE",
  "CURRENCY_CHANGE_REQUIRES_MIGRATION",
  "VERSION_CONFLICT",
  "SLOT_UNAVAILABLE",
  "VERSION_MISMATCH",
  "INVALID_APPOINTMENT_TRANSITION",
  "SCHEDULE_HAS_BOOKINGS",
  "BOOKING_CONFIGURATION_CHANGED",
  "APPOINTMENT_NOT_FOUND",
]);

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
    && typeof value.onboarding.canCreateOrganization === "boolean" && ["ELIGIBLE", "EMAIL_UNVERIFIED", "HAS_MEMBERSHIP", "TRIAL_ALREADY_USED", "ACCESS_REVOKED"].includes(String(value.onboarding.reason))
    && (value.activeOrganizationId === null ? value.access === null : value.memberships.some((member: unknown) => record(member) && record(member.organization) && member.organization.id === value.activeOrganizationId));
}
export function isApiErrorDTO(value: unknown): value is ApiErrorDTO {
  return record(value) && typeof value.code === "string" && errorCodes.has(value.code) && typeof value.message === "string" && (value.fieldErrors === undefined || (record(value.fieldErrors) && Object.values(value.fieldErrors).every((errors) => Array.isArray(errors) && errors.every((error: unknown) => typeof error === "string"))));
}
