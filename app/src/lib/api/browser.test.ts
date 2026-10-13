import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiMutation, clearCsrfToken, createOrganization, getSnapshot, login, logout } from "./browser";
import { ApiError } from "./errors";
import { accessFixture } from "@/test/access-fixtures";
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./api-client", () => ({ getApiClient: () => ({ get, post }) }));
describe("same-origin mutation transport", () => {
  beforeEach(() => { clearCsrfToken(); get.mockResolvedValue({ data: { csrfToken: "csrf-1" } }); post.mockResolvedValue({ data: { ok: true } }); });
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
});
