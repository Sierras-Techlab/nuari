import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiMutation, apiPatchVersioned, apiPut, clearCsrfToken, createOrganization, createStaffMember, getSnapshot, getStaffMember, getStaffMemberServices, login, logout, updateStaffMember } from "./browser";
import { ApiError } from "./errors";
import { isApiErrorDTO } from "./contracts";
import { accessFixture } from "@/test/access-fixtures";
const { get, post, patch, put, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("./api-client", () => ({ getApiClient: () => ({ get, post, patch, put, delete: del }) }));
describe("same-origin mutation transport", () => {
  beforeEach(() => { clearCsrfToken(); get.mockResolvedValue({ data: { csrfToken: "csrf-1" } }); post.mockResolvedValue({ data: { ok: true } }); patch.mockResolvedValue({ data: { ok: true } }); put.mockResolvedValue({ data: { ok: true } }); del.mockResolvedValue({ data: { ok: true } }); });
  afterEach(() => vi.resetAllMocks());
  it("initializes CSRF in memory and sends it in a header", async () => {
    await apiMutation("/auth/register", { name: "Juan" }); await apiMutation("/auth/logout");
    expect(get).toHaveBeenCalledExactlyOnceWith("/auth/csrf");
    expect(post).toHaveBeenCalledWith("/auth/register", { name: "Juan" }, { headers: { "X-CSRF-Token": "csrf-1" } });
  });
  it("retries exactly once only for CSRF_INVALID with the same payload/key", async () => {
    post.mockRejectedValueOnce(new ApiError(403, "CSRF_INVALID", "Invalid"));
    get.mockResolvedValueOnce({ data: { csrfToken: "old" } }).mockResolvedValueOnce({ data: { csrfToken: "new" } });
    const payload = Object.freeze({ name: "Estudio", slug: "estudio", businessType: "SERVICES" as const, planCode: "PRO" as const });
    await createOrganization(payload, "immutable-key");
    expect(post).toHaveBeenCalledTimes(2); expect(get).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]?.[1]).toBe(payload); expect(post.mock.calls[1]?.[1]).toBe(payload);
    expect(post.mock.calls[1]?.[2]).toEqual({ headers: { "Idempotency-Key": "immutable-key", "X-CSRF-Token": "new" } });
  });
  it("does not loop after the second CSRF rejection", async () => {
    post.mockRejectedValue(new ApiError(403, "CSRF_INVALID", "Invalid"));
    await expect(apiMutation("/auth/login", {})).rejects.toMatchObject({ code: "CSRF_INVALID" }); expect(post).toHaveBeenCalledTimes(2);
  });
  it("adds If-Match to versioned patches and retries a put only after CSRF_INVALID", async () => {
    await apiPatchVersioned("/organizations/org-1/customers/customer-1", { name: "Elena" }, 4);
    expect(patch).toHaveBeenCalledWith("/organizations/org-1/customers/customer-1", { name: "Elena" }, { headers: { "If-Match": '\"4\"', "X-CSRF-Token": "csrf-1" } });
    clearCsrfToken();
    put.mockRejectedValueOnce(new ApiError(403, "CSRF_INVALID", "Expired"));
    get.mockResolvedValueOnce({ data: { csrfToken: "csrf-old" } }).mockResolvedValueOnce({ data: { csrfToken: "csrf-new" } });
    await apiPut("/organizations/org-1/services/service-1/staff/staff-1", {});
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1]?.[2]).toEqual({ headers: { "X-CSRF-Token": "csrf-new" } });
  });
  it("attaches the current service version to association PUT and DELETE", async () => {
    const { apiDeleteVersioned, apiPutVersioned } = await import("./browser");
    await apiPutVersioned("/organizations/org-1/services/service-1/staff/staff-1", {}, 7);
    expect(put).toHaveBeenCalledWith("/organizations/org-1/services/service-1/staff/staff-1", {}, { headers: { "If-Match": '\"7\"', "X-CSRF-Token": "csrf-1" } });
    await apiDeleteVersioned("/organizations/org-1/services/service-1/staff/staff-1", 8);
    expect(del).toHaveBeenCalledWith("/organizations/org-1/services/service-1/staff/staff-1", { headers: { "If-Match": '\"8\"', "X-CSRF-Token": "csrf-1" } });
  });
  it("uses staff detail, association, create and versioned update API routes without membership payloads", async () => {
    get.mockResolvedValueOnce({ data: { id: "staff-1" } }).mockResolvedValueOnce({ data: { items: [] } });
    await getStaffMember("org/1", "staff-1");
    await getStaffMemberServices("org/1", "staff-1", { limit: 25, offset: 0, status: "all" });
    await createStaffMember("org/1", { name: "Sofía", email: null, phone: null });
    await updateStaffMember("org/1", "staff-1", { active: false }, 7);
    expect(get.mock.calls[0]?.[0]).toBe("/organizations/org%2F1/staff/staff-1");
    expect(get.mock.calls[1]?.[0]).toBe("/organizations/org%2F1/staff/staff-1/services");
    expect(post).toHaveBeenCalledWith("/organizations/org%2F1/staff", { name: "Sofía", email: null, phone: null }, { headers: { "X-CSRF-Token": "csrf-1" } });
    expect(patch).toHaveBeenCalledWith("/organizations/org%2F1/staff/staff-1", { active: false }, { headers: { "If-Match": '"7"', "X-CSRF-Token": "csrf-1" } });
  });
  it.each(["CUSTOMER_NOT_FOUND", "VERSION_CONFLICT", "SERVICE_NOT_FOUND", "RELATED_ENTITY_INACTIVE", "CURRENCY_CHANGE_REQUIRES_MIGRATION"] as const)("recognizes operational API error %s", (code) => {
    expect(isApiErrorDTO({ code, message: "No se pudo completar la operación." })).toBe(true);
  });
  it.each([new ApiError(401, "INVALID_CREDENTIALS", "Invalid"), new ApiError(503, "SERVICE_UNAVAILABLE", "Offline"), new Error("timeout")])("never automatically retries credentials, backend failures or timeout", async (error) => {
    post.mockRejectedValue(error); await expect(apiMutation("/auth/login", {})).rejects.toBeInstanceOf(ApiError); expect(post).toHaveBeenCalledOnce();
  });
  it("uses rotated login CSRF and discards it on logout", async () => {
    post.mockResolvedValueOnce({ data: { user: accessFixture().user, csrfToken: "rotated" } }).mockResolvedValue({ data: undefined });
    await login({ email: "juan@example.com", password: "a secure password" }); await logout(); await apiMutation("/auth/register");
    expect(post.mock.calls[1]?.[2]).toEqual({ headers: { "X-CSRF-Token": "rotated" } }); expect(get).toHaveBeenCalledTimes(2);
  });
  it("validates snapshot shape instead of assuming missing memberships", async () => {
    get.mockResolvedValueOnce({ data: accessFixture() }).mockResolvedValueOnce({ data: { user: {} } });
    expect(await getSnapshot()).toEqual(accessFixture()); await expect(getSnapshot()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
  it("accepts a revoked-access snapshot while retaining the authenticated user", async () => {
    const revoked = accessFixture(false);
    revoked.onboarding = { canCreateOrganization: false, reason: "ACCESS_REVOKED" };
    get.mockResolvedValueOnce({ data: revoked });
    await expect(getSnapshot()).resolves.toEqual(revoked);
  });
});
