import type { AxiosRequestConfig } from "axios";
import { getApiClient } from "./api-client";
import {
  isAccessSnapshot,
  type AccessSnapshot,
  type CreateCustomerInput,
  type CustomerDTO,
  type CustomerListInput,
  type CustomerPageDTO,
  type DuplicateCustomerCandidatesDTO,
  type CreateServiceCategoryInput,
  type UpdateServiceCategoryInput,
  type ServiceCategoryDTO,
  type ServiceCategoryListInput,
  type ServiceCategoryPageDTO,
  type CreateServiceInput,
  type UpdateServiceInput,
  type ServiceDTO,
  type ServiceListInput,
  type ServicePageDTO,
  type StaffListInput,
  type StaffDTO,
  type StaffPageDTO,
  type CreateStaffInput,
  type UpdateStaffInput,
  type StaffServiceListQuery,
  type StaffServicePageDTO,
  type StaffServiceMutationDTO,
  type StaffServiceRemoveDTO,
  type UpdateCustomerInput,
  type CreateInvitationInput,
  type InvitationDTO,
  type MemberDetailDTO,
  type MembershipDTO,
  type OrganizationDTO,
  type OrganizationInput,
  type OrganizationResult,
  type OrganizationRole,
  type PublicInvitationDTO,
  type SubscriptionResult,
  type UpdateOrganizationInput,
  type UserDTO,
  type WorkspaceDTO,
  type AppointmentDTO,
  type AppointmentPageDTO,
  type AppointmentListQuery,
  type AppointmentCreateInput,
  type AppointmentCancelReason,
  type AvailabilityDTO,
  type AvailabilityQuery,
  type BookingCalendarDTO,
  type SchedulingSettingsDTO,
  type PublicBookingCatalogDTO,
  type PublicBookingStaffPageDTO,
  type PublicAvailabilityQuery,
  type PublicAvailabilityDTO,
  type PublicBookingCreateInput,
  type PublicBookingReceiptDTO,
  type PublicManagedBookingDTO,
  type PublicRescheduleAvailabilityQuery,
  type PublicRescheduleInput,
  type PublicCancelInput,
  type PublicManagedBookingResultDTO,
} from "./contracts";

import { ApiError, toApiError } from "./errors";

let csrfToken: string | undefined;
let csrfRequest: Promise<string> | undefined;
export function clearCsrfToken() { csrfToken = undefined; }
export async function refreshCsrfToken(): Promise<string> {
  csrfRequest ??= getApiClient().get<{ csrfToken: string }>("/auth/csrf").then(({ data }) => {
    if (typeof data.csrfToken !== "string") throw new ApiError(0, "SERVICE_UNAVAILABLE", "Respuesta de seguridad inválida.");
    csrfToken = data.csrfToken;
    return csrfToken;
  }).catch((error: unknown) => { throw toApiError(error); }).finally(() => { csrfRequest = undefined; });
  return csrfRequest;
}
export async function apiMutation<T>(path: string, body: unknown = {}, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().post<T>(path, body, { ...config, headers: { ...config.headers, "X-CSRF-Token": token } });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function getSnapshot(signal?: AbortSignal): Promise<AccessSnapshot> {
  try {
    const { data } = await getApiClient().get<unknown>("/auth/me", { signal });
    if (!isAccessSnapshot(data)) throw new ApiError(0, "SERVICE_UNAVAILABLE", "No pudimos validar tu acceso.");
    return data;
  } catch (error) { throw toApiError(error); }
}
export const register = (input: { name: string; email: string; password: string; returnTo?: string }) => apiMutation<{ message: string }>("/auth/register", input);
export async function login(input: { email: string; password: string }) {
  const result = await apiMutation<{ user: UserDTO; csrfToken: string }>("/auth/login", input);
  csrfToken = result.csrfToken;
  return result;
}
export async function logout() { await apiMutation<void>("/auth/logout"); clearCsrfToken(); }
export const requestEmailVerification = (input: { returnTo?: string } = {}) => apiMutation<{ message: string }>("/auth/email-verification/request", input);
export const selectOrganization = (organizationId: string) => apiMutation<AccessSnapshot>("/auth/active-organization", { organizationId });
export const createOrganization = (input: Readonly<OrganizationInput>, key: string) => apiMutation<OrganizationResult>("/organizations", input, { headers: { "Idempotency-Key": key } });
export async function getWorkspace(organizationId: string, signal?: AbortSignal): Promise<WorkspaceDTO> {
  try { return (await getApiClient().get<WorkspaceDTO>(`/organizations/${encodeURIComponent(organizationId)}/workspace`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getSubscription(organizationId: string, signal?: AbortSignal): Promise<SubscriptionResult> {
  try { return (await getApiClient().get<SubscriptionResult>(`/organizations/${encodeURIComponent(organizationId)}/subscription`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}

export async function apiPatch<T>(path: string, body: unknown = {}, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().patch<T>(path, body, { ...config, headers: { ...config.headers, "X-CSRF-Token": token } });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function apiPatchVersioned<T>(path: string, body: unknown, version: number, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().patch<T>(path, body, {
        ...config,
        headers: { ...config.headers, "If-Match": `"${version}"`, "X-CSRF-Token": token },
      });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function apiPut<T>(path: string, body: unknown = {}, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().put<T>(path, body, { ...config, headers: { ...config.headers, "X-CSRF-Token": token } });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function apiPutVersioned<T>(path: string, body: unknown, version: number, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().put<T>(path, body, {
        ...config,
        headers: { ...config.headers, "If-Match": `"${version}"`, "X-CSRF-Token": token },
      });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function apiDeleteVersioned<T>(path: string, version: number, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().delete<T>(path, {
        ...config,
        headers: { ...config.headers, "If-Match": `"${version}"`, "X-CSRF-Token": token },
      });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}
export async function apiDelete<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = csrfToken ?? await refreshCsrfToken();
    try {
      const response = await getApiClient().delete<T>(path, { ...config, headers: { ...config.headers, "X-CSRF-Token": token } });
      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      if (failure.code !== "CSRF_INVALID" || attempt === 1) throw failure;
      csrfToken = undefined;
      await refreshCsrfToken();
    }
  }
  throw new ApiError(403, "CSRF_INVALID", "No pudimos verificar la solicitud.");
}

export async function getOrganization(organizationId: string, signal?: AbortSignal): Promise<{ organization: OrganizationDTO; membership: MembershipDTO }> {
  try { return (await getApiClient().get<{ organization: OrganizationDTO; membership: MembershipDTO }>(`/organizations/${encodeURIComponent(organizationId)}`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}

export const updateOrganization = (organizationId: string, input: UpdateOrganizationInput) =>
  apiPatch<{ organization: OrganizationDTO; membership: MembershipDTO }>(`/organizations/${encodeURIComponent(organizationId)}`, input);

export async function getMembers(organizationId: string, signal?: AbortSignal): Promise<MemberDetailDTO[]> {
  try { return (await getApiClient().get<MemberDetailDTO[]>(`/organizations/${encodeURIComponent(organizationId)}/members`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}

export async function getCustomers(organizationId: string, query: CustomerListInput = {}, signal?: AbortSignal): Promise<CustomerPageDTO> {
  try {
    return (await getApiClient().get<CustomerPageDTO>(`/organizations/${encodeURIComponent(organizationId)}/customers`, { params: query, signal })).data;
  } catch (error) { throw toApiError(error); }
}

export async function getCustomer(organizationId: string, customerId: string, signal?: AbortSignal): Promise<CustomerDTO> {
  try {
    return (await getApiClient().get<CustomerDTO>(`/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}`, { signal })).data;
  } catch (error) { throw toApiError(error); }
}

export const createCustomer = (organizationId: string, input: CreateCustomerInput) =>
  apiMutation<CustomerDTO>(`/organizations/${encodeURIComponent(organizationId)}/customers`, input);

export const updateCustomer = (organizationId: string, customerId: string, input: UpdateCustomerInput, version: number) =>
  apiPatchVersioned<CustomerDTO>(`/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}`, input, version);

export async function getDuplicateCustomerCandidates(organizationId: string, query: { email?: string; phone?: string; excludeId?: string }, signal?: AbortSignal): Promise<DuplicateCustomerCandidatesDTO> {
  try {
    return (await getApiClient().get<DuplicateCustomerCandidatesDTO>(`/organizations/${encodeURIComponent(organizationId)}/customers/duplicate-candidates`, { params: query, signal })).data;
  } catch (error) { throw toApiError(error); }
}

export async function getServiceCategories(organizationId: string, query: ServiceCategoryListInput = {}, signal?: AbortSignal): Promise<ServiceCategoryPageDTO> {
  try { return (await getApiClient().get<ServiceCategoryPageDTO>(`/organizations/${encodeURIComponent(organizationId)}/service-categories`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export const createServiceCategory = (organizationId: string, input: CreateServiceCategoryInput) =>
  apiMutation<ServiceCategoryDTO>(`/organizations/${encodeURIComponent(organizationId)}/service-categories`, input);
export const updateServiceCategory = (organizationId: string, categoryId: string, input: UpdateServiceCategoryInput, version: number) =>
  apiPatchVersioned<ServiceCategoryDTO>(`/organizations/${encodeURIComponent(organizationId)}/service-categories/${encodeURIComponent(categoryId)}`, input, version);
export async function getServices(organizationId: string, query: ServiceListInput = {}, signal?: AbortSignal): Promise<ServicePageDTO> {
  try { return (await getApiClient().get<ServicePageDTO>(`/organizations/${encodeURIComponent(organizationId)}/services`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getService(organizationId: string, serviceId: string, signal?: AbortSignal): Promise<ServiceDTO> {
  try { return (await getApiClient().get<ServiceDTO>(`/organizations/${encodeURIComponent(organizationId)}/services/${encodeURIComponent(serviceId)}`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export const createService = (organizationId: string, input: CreateServiceInput) =>
  apiMutation<ServiceDTO>(`/organizations/${encodeURIComponent(organizationId)}/services`, input);
export const updateService = (organizationId: string, serviceId: string, input: UpdateServiceInput, version: number) =>
  apiPatchVersioned<ServiceDTO>(`/organizations/${encodeURIComponent(organizationId)}/services/${encodeURIComponent(serviceId)}`, input, version);
export async function getStaff(organizationId: string, query: StaffListInput = {}, signal?: AbortSignal): Promise<StaffPageDTO> {
  try { return (await getApiClient().get<StaffPageDTO>(`/organizations/${encodeURIComponent(organizationId)}/staff`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getStaffMember(organizationId: string, staffMemberId: string, signal?: AbortSignal): Promise<StaffDTO> {
  try { return (await getApiClient().get<StaffDTO>(`/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffMemberId)}`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export const createStaffMember = (organizationId: string, input: CreateStaffInput) =>
  apiMutation<StaffDTO>(`/organizations/${encodeURIComponent(organizationId)}/staff`, input);
export const updateStaffMember = (organizationId: string, staffMemberId: string, input: UpdateStaffInput, version: number) =>
  apiPatchVersioned<StaffDTO>(`/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffMemberId)}`, input, version);
export async function getStaffMemberServices(organizationId: string, staffMemberId: string, query: StaffServiceListQuery = {}, signal?: AbortSignal): Promise<StaffServicePageDTO> {
  try { return (await getApiClient().get<StaffServicePageDTO>(`/organizations/${encodeURIComponent(organizationId)}/staff/${encodeURIComponent(staffMemberId)}/services`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getServiceStaff(organizationId: string, serviceId: string, query: StaffServiceListQuery = {}, signal?: AbortSignal): Promise<StaffServicePageDTO> {
  try { return (await getApiClient().get<StaffServicePageDTO>(`/organizations/${encodeURIComponent(organizationId)}/services/${encodeURIComponent(serviceId)}/staff`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}

export async function getAppointments(organizationId: string, query: AppointmentListQuery, signal?: AbortSignal): Promise<AppointmentPageDTO> {
  try { return (await getApiClient().get<AppointmentPageDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getAppointment(organizationId: string, appointmentId: string, signal?: AbortSignal): Promise<AppointmentDTO> {
  try { return (await getApiClient().get<AppointmentDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments/${encodeURIComponent(appointmentId)}`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getAvailability(organizationId: string, query: AvailabilityQuery, signal?: AbortSignal): Promise<AvailabilityDTO> {
  try { return (await getApiClient().get<AvailabilityDTO>(`/organizations/${encodeURIComponent(organizationId)}/availability`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getSchedulingSettings(organizationId: string, signal?: AbortSignal): Promise<SchedulingSettingsDTO> {
  try { return (await getApiClient().get<SchedulingSettingsDTO>(`/organizations/${encodeURIComponent(organizationId)}/scheduling/settings`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getBookingCalendars(organizationId: string, signal?: AbortSignal): Promise<BookingCalendarDTO[]> {
  try { return (await getApiClient().get<BookingCalendarDTO[]>(`/organizations/${encodeURIComponent(organizationId)}/scheduling/calendars`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export const createAppointment = (organizationId: string, input: AppointmentCreateInput, idempotencyKey: string) =>
  apiMutation<AppointmentDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments`, input, { headers: { "Idempotency-Key": idempotencyKey } });
export const cancelAppointment = (organizationId: string, appointmentId: string, version: number, reasonCode: AppointmentCancelReason) =>
  apiMutation<AppointmentDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`, { reasonCode }, { headers: { "If-Match": `"${version}"` } });
export const rescheduleAppointment = (organizationId: string, appointmentId: string, input: Pick<AppointmentCreateInput, "startAt" | "assignment">, version: number) =>
  apiMutation<AppointmentDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments/${encodeURIComponent(appointmentId)}/reschedule`, input, { headers: { "If-Match": `"${version}"` } });
export const closeAppointment = (organizationId: string, appointmentId: string, status: "complete" | "no-show", version: number) =>
  apiMutation<AppointmentDTO>(`/organizations/${encodeURIComponent(organizationId)}/appointments/${encodeURIComponent(appointmentId)}/${status}`, {}, { headers: { "If-Match": `"${version}"` } });

export async function getPublicBookingCatalog(slug: string, signal?: AbortSignal): Promise<PublicBookingCatalogDTO> {
  try { return (await getApiClient().get<PublicBookingCatalogDTO>(`/public/booking/${encodeURIComponent(slug)}/catalog`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getPublicBookingStaff(slug: string, serviceId: string, offset: number, signal?: AbortSignal): Promise<PublicBookingStaffPageDTO> {
  try { return (await getApiClient().get<PublicBookingStaffPageDTO>(`/public/booking/${encodeURIComponent(slug)}/services/${encodeURIComponent(serviceId)}/staff`, { params: { offset }, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export async function getPublicAvailability(slug: string, query: PublicAvailabilityQuery, signal?: AbortSignal): Promise<PublicAvailabilityDTO> {
  try { return (await getApiClient().get<PublicAvailabilityDTO>(`/public/booking/${encodeURIComponent(slug)}/availability`, { params: query, signal })).data; }
  catch (error) { throw toApiError(error); }
}
export const createPublicBooking = (slug: string, input: PublicBookingCreateInput, idempotencyKey: string) =>
  apiMutation<PublicBookingReceiptDTO>(`/public/booking/${encodeURIComponent(slug)}/appointments`, input, { headers: { "Idempotency-Key": idempotencyKey } });
export const getPublicManagedBooking = (slug: string, token: string, signal?: AbortSignal) =>
  apiMutation<PublicManagedBookingDTO>(`/public/booking/${encodeURIComponent(slug)}/manage/resolve`, { token }, signal ? { signal } : {});
export const getPublicRescheduleAvailability = (slug: string, appointmentId: string, token: string, query: PublicRescheduleAvailabilityQuery, version: number, signal?: AbortSignal) =>
  apiMutation<PublicAvailabilityDTO>(`/public/booking/${encodeURIComponent(slug)}/manage/${encodeURIComponent(appointmentId)}/availability`, { token, ...query }, { headers: { "If-Match": `"${version}"` }, ...(signal ? { signal } : {}) });
export const reschedulePublicBooking = (slug: string, appointmentId: string, input: PublicRescheduleInput, version: number) =>
  apiMutation<PublicManagedBookingResultDTO>(`/public/booking/${encodeURIComponent(slug)}/manage/${encodeURIComponent(appointmentId)}/reschedule`, input, { headers: { "If-Match": `"${version}"` } });
export const cancelPublicBooking = (slug: string, appointmentId: string, input: PublicCancelInput, version: number) =>
  apiMutation<PublicManagedBookingResultDTO>(`/public/booking/${encodeURIComponent(slug)}/manage/${encodeURIComponent(appointmentId)}/cancel`, input, { headers: { "If-Match": `"${version}"` } });

export const addStaffToService = (organizationId: string, serviceId: string, staffMemberId: string, version: number) =>
  apiPutVersioned<StaffServiceMutationDTO>(`/organizations/${encodeURIComponent(organizationId)}/services/${encodeURIComponent(serviceId)}/staff/${encodeURIComponent(staffMemberId)}`, {}, version);
export const removeStaffFromService = (organizationId: string, serviceId: string, staffMemberId: string, version: number) =>
  apiDeleteVersioned<StaffServiceRemoveDTO>(`/organizations/${encodeURIComponent(organizationId)}/services/${encodeURIComponent(serviceId)}/staff/${encodeURIComponent(staffMemberId)}`, version);

export const updateMemberRole = (organizationId: string, memberId: string, role: OrganizationRole) =>
  apiPatch<MemberDetailDTO>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`, { role });

export const removeMember = (organizationId: string, memberId: string) =>
  apiDelete<MemberDetailDTO>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`);

export async function getInvitations(organizationId: string, signal?: AbortSignal): Promise<InvitationDTO[]> {
  try { return (await getApiClient().get<InvitationDTO[]>(`/organizations/${encodeURIComponent(organizationId)}/invitations`, { signal })).data; }
  catch (error) { throw toApiError(error); }
}

export const createInvitation = (organizationId: string, input: CreateInvitationInput) =>
  apiMutation<{ invitation: InvitationDTO; token: string }>(`/organizations/${encodeURIComponent(organizationId)}/invitations`, input);

export const revokeInvitation = (organizationId: string, invitationId: string) =>
  apiDelete<{ success: boolean }>(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`);

export async function getPublicInvitation(token: string, signal?: AbortSignal): Promise<PublicInvitationDTO> {
  try {
    return (await getApiClient().get<PublicInvitationDTO>(`/invitations/${encodeURIComponent(token)}`, { signal })).data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const acceptInvitation = (token: string) =>
  apiMutation<{ organization: OrganizationDTO; membership: MembershipDTO }>(`/invitations/${encodeURIComponent(token)}/accept`);
