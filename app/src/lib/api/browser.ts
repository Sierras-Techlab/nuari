import type { AxiosRequestConfig } from "axios";
import { getApiClient } from "./api-client";
import { isAccessSnapshot, type AccessSnapshot, type OrganizationInput, type OrganizationResult, type SubscriptionResult, type UserDTO, type WorkspaceDTO } from "./contracts";
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
export const register = (input: { name: string; email: string; password: string }) => apiMutation<{ message: string }>("/auth/register", input);
export async function login(input: { email: string; password: string }) {
  const result = await apiMutation<{ user: UserDTO; csrfToken: string }>("/auth/login", input);
  csrfToken = result.csrfToken;
  return result;
}
export async function logout() { await apiMutation<void>("/auth/logout"); clearCsrfToken(); }
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
