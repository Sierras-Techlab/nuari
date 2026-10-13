import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessFixture } from "@/test/access-fixtures";
import { guardAuthPage, guardPage, readServerAccess } from "./server";
const { cookie, redirect } = vi.hoisted(() => ({ cookie: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("next/navigation", () => ({ redirect }));
describe("server access boundary", () => {
  beforeEach(() => { vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("API_INTERNAL_URL", "http://localhost:3001"); cookie.mockReturnValue({ value: "a".repeat(43) }); });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("forwards only the development session cookie, no-store and a bounded timeout", async () => {
    const fetch = vi.fn(async () => Response.json(accessFixture())); vi.stubGlobal("fetch", fetch);
    expect((await readServerAccess()).state).toBe("authenticated");
    expect(cookie).toHaveBeenCalledExactlyOnceWith("nuari_session");
    expect(fetch).toHaveBeenCalledWith("http://localhost:3001/api/auth/me", expect.objectContaining({ headers: { Cookie: `nuari_session=${"a".repeat(43)}`, Accept: "application/json" }, cache: "no-store", signal: expect.any(AbortSignal), redirect: "error" }));
  });
  it("selects only the host-prefixed production cookie", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("API_INTERNAL_URL", "https://api.nuari.app"); vi.stubGlobal("fetch", vi.fn(async () => Response.json(accessFixture())));
    await readServerAccess(); expect(cookie).toHaveBeenCalledWith("__Host-nuari_session");
  });
  it("accepts the explicit non-production cookie override used by the E2E harness only for valid names", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("API_INTERNAL_URL", "https://api.nuari.app"); vi.stubGlobal("fetch", vi.fn(async () => Response.json(accessFixture())));
    vi.stubEnv("NUARI_SESSION_COOKIE_NAME", "nuari_session"); await readServerAccess(); expect(cookie).toHaveBeenLastCalledWith("nuari_session");
    vi.stubEnv("NUARI_SESSION_COOKIE_NAME", "evil_cookie"); await readServerAccess(); expect(cookie).toHaveBeenLastCalledWith("__Host-nuari_session");
  });
  it("does not fetch for missing or malformed cookies", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); cookie.mockReturnValue(undefined);
    expect(await readServerAccess()).toEqual({ state: "anonymous" }); cookie.mockReturnValue({ value: "injected; other=secret" });
    expect(await readServerAccess()).toEqual({ state: "anonymous" }); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([500, 503])("fails closed without redirecting a backend %s as no membership", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    expect(await guardPage("app")).toBeNull(); expect(await guardAuthPage()).toBe(false); expect(redirect).not.toHaveBeenCalled();
  });
  it("fails closed for a network failure or invalid snapshot", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ user: {} })); vi.stubGlobal("fetch", fetch);
    expect((await readServerAccess()).state).toBe("unavailable"); expect((await readServerAccess()).state).toBe("unavailable");
  });
  it("redirects only confirmed unauthenticated access", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(guardPage("business")).rejects.toThrow("REDIRECT:/login");
  });
  it("requires backend memberships on every private page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(accessFixture(false))));
    await expect(guardPage("app")).rejects.toThrow("REDIRECT:/onboarding");
    await expect(guardPage("business")).rejects.toThrow("REDIRECT:/onboarding");
  });
  it.each(["OWNER", "ADMIN", "EMPLOYEE"] as const)("allows active %s without demanding creator onboarding", async (role) => {
    const snapshot = accessFixture(); snapshot.memberships[0].role = role;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(snapshot)));
    expect(await guardPage("business")).toEqual(snapshot);
    await expect(guardPage("onboarding")).rejects.toThrow("REDIRECT:/app");
  });
  it("retains account access but rejects business rendering at expiration", async () => {
    const snapshot = accessFixture(); if (snapshot.access) snapshot.access.businessAllowed = false;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(snapshot)));
    expect(await guardPage("app")).toEqual(snapshot); await expect(guardPage("business")).rejects.toThrow("REDIRECT:/app");
  });
});
