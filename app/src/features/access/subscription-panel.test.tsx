/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessFixture } from "@/test/access-fixtures";
import { SubscriptionPanel } from "./subscription-panel";
import { ApiError } from "@/lib/api/errors";
const mocks = vi.hoisted(() => ({ getSubscription: vi.fn(), refresh: vi.fn(), canManage: true }));
vi.mock("@/lib/api/browser", () => ({ getSubscription: mocks.getSubscription }));
vi.mock("./access-provider", () => ({ useAccess: () => ({ snapshot: accessFixture(), refresh: mocks.refresh }) }));
describe("subscription account access without business providers", () => {
  beforeEach(() => { mocks.getSubscription.mockResolvedValue({ subscription: { planCode: "PRO", trialEndsAt: "2026-10-26T00:00:00.000Z" }, access: { canManageSubscription: true } }); });
  afterEach(() => { cleanup(); vi.resetAllMocks(); });
  it("lets owners/admins inspect the plan and contact support without a fake payment action", async () => {
    render(<SubscriptionPanel />); await screen.findByText(/Plan PRO/);
    expect(screen.getByRole("link", { name: "hola@nuari.app" }).getAttribute("href")).toBe("mailto:hola@nuari.app"); expect(screen.queryByRole("button", { name: /pagar|activar/i })).toBeNull();
  });
  it("tells employees to contact their administrator", async () => {
    mocks.getSubscription.mockResolvedValue({ subscription: { planCode: "BASIC", trialEndsAt: "2026-10-26T00:00:00.000Z" }, access: { canManageSubscription: false } });
    render(<SubscriptionPanel />); await screen.findByText(/Contactá al administrador/); expect(screen.queryByRole("link", { name: "hola@nuari.app" })).toBeNull();
  });
  it("reconciles a lost membership/session without retaining business context", async () => {
    mocks.getSubscription.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "La sesión venció")); render(<SubscriptionPanel />);
    await screen.findByRole("alert"); await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
  it("aborts prior subscription reads on unmount", async () => {
    mocks.getSubscription.mockImplementation(() => new Promise(() => undefined)); const view = render(<SubscriptionPanel />);
    const signal: AbortSignal = mocks.getSubscription.mock.calls[0]?.[1]; view.unmount(); expect(signal.aborted).toBe(true);
  });
});
