/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accessFixture } from "@/test/access-fixtures";
import type { AccessSnapshot } from "@/lib/api/contracts";
import { ApiError } from "@/lib/api/errors";
import { AccessProvider, PrivateWorkspace, useAccess } from "./access-provider";
import { ServicesScreen } from "@/features/workspace/services-screen";
import { useWorkspaceSource } from "@/features/workspace/workspace-provider";
import type { WorkspaceSource } from "@/features/workspace/types";
const mocks = vi.hoisted(() => ({ getSnapshot: vi.fn(), getWorkspace: vi.fn(), selectOrganization: vi.fn(), logout: vi.fn(), replace: vi.fn(), refresh: vi.fn(), pathname: "/app" }));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => mocks.pathname }));
vi.mock("@/lib/api/browser", () => ({ getSnapshot: mocks.getSnapshot, getWorkspace: mocks.getWorkspace, selectOrganization: mocks.selectOrganization, logout: mocks.logout }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("./subscription-panel", () => ({ SubscriptionPanel: () => <p>Regularización de suscripción</p> }));
function Controls() {
  const access = useAccess();
  return <><p data-testid="identity">{access.snapshot?.user.id ?? "closed"}:{access.snapshot?.activeOrganizationId ?? "none"}</p><button onClick={() => void access.refresh()}>Refresh</button><button onClick={() => void access.select("other-org")}>Select</button><button onClick={() => void access.signOut()}>Logout</button><button onClick={() => void access.preflight().catch(() => undefined)}>Preflight</button></>;
}
function tree(snapshot = accessFixture(), business: ReactNode = <p>Business content</p>) {
  return <AccessProvider initialSnapshot={snapshot}><Controls /><PrivateWorkspace>{business}</PrivateWorkspace></AccessProvider>;
}
describe("live authorized context", () => {
  beforeEach(() => { mocks.pathname = "/app"; mocks.getSnapshot.mockResolvedValue(accessFixture()); mocks.logout.mockResolvedValue(undefined); mocks.selectOrganization.mockResolvedValue(accessFixture()); mocks.getWorkspace.mockResolvedValue({ organization: accessFixture().memberships[0].organization, membership: { id: accessFixture().memberships[0].id, role: "OWNER", organizationId: accessFixture().activeOrganizationId, status: "ACTIVE" }, access: accessFixture().access }); });
  afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });
  it("revalidates on focus and closes business on backend failure without a no-membership redirect", async () => {
    render(tree()); await waitFor(() => expect(mocks.getSnapshot).toHaveBeenCalledOnce());
    mocks.getSnapshot.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "Servicio no disponible"));
    fireEvent.focus(window);
    await screen.findByText("Servicio no disponible"); expect(screen.queryByText("Business content")).toBeNull(); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("ignores an older response after logout, even if the transport ignores abort", async () => {
    let resolve: ((value: AccessSnapshot) => void) | undefined;
    mocks.getSnapshot.mockImplementation(() => new Promise<AccessSnapshot>((complete) => { resolve = complete; }));
    render(tree()); fireEvent.click(screen.getByText("Logout"));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
    await act(async () => { resolve?.(accessFixture()); });
    expect(screen.queryByText("Business content")).toBeNull(); expect(screen.getByTestId("identity").textContent).toBe("closed:none");
  });
  it("cannot reopen the old context from focus while logout is still pending", async () => {
    let complete: (() => void) | undefined;
    mocks.logout.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    render(tree()); await waitFor(() => expect(mocks.getSnapshot).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText("Logout")); fireEvent.focus(window);
    expect(mocks.getSnapshot).toHaveBeenCalledOnce(); expect(screen.queryByText("Business content")).toBeNull();
    await act(async () => { complete?.(); }); expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
  it("unmounts local business immediately on a subscription denial", async () => {
    const expired = accessFixture(); if (expired.access) { expired.access.businessAllowed = false; expired.access.reason = "TRIAL_EXPIRED"; }
    render(tree()); await waitFor(() => expect(mocks.getSnapshot).toHaveBeenCalledOnce());
    mocks.getSnapshot.mockResolvedValue(expired); fireEvent.focus(window);
    await screen.findByText("Regularización de suscripción"); expect(screen.queryByText("Business content")).toBeNull();
  });
  it("checks workspace before local reads and clears local arrays on an organization switch", async () => {
    render(tree(accessFixture(), <ServicesScreen />)); await screen.findByText("Servicio estándar");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Private service" } }); fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" })); await screen.findByText("Private service");
    const next = accessFixture(); next.memberships[0].organization.id = "other-org"; next.activeOrganizationId = "other-org";
    mocks.getSnapshot.mockResolvedValue(next); mocks.getWorkspace.mockResolvedValue({ organization: next.memberships[0].organization, membership: { id: next.memberships[0].id, role: "OWNER", organizationId: "other-org", status: "ACTIVE" }, access: next.access });
    fireEvent.click(screen.getByText("Select")); await screen.findByText("Servicio estándar"); expect(screen.queryByText("Private service")).toBeNull(); expect(mocks.selectOrganization).toHaveBeenCalledWith("other-org");
  });
  it("does not run local reads when the backend workspace preflight is denied", async () => {
    mocks.getWorkspace.mockRejectedValue(new ApiError(403, "SUBSCRIPTION_REQUIRED", "Denegado"));
    const expired = accessFixture(); if (expired.access) expired.access.businessAllowed = false; mocks.getSnapshot.mockResolvedValue(expired);
    render(tree(accessFixture(), <ServicesScreen />)); await screen.findByText("Regularización de suscripción"); expect(screen.queryByText("Servicio estándar")).toBeNull();
  });
  it("revalidates visible tabs at sixty seconds and ignores hidden tabs", async () => {
    vi.useFakeTimers(); render(tree()); await act(async () => undefined); expect(mocks.getSnapshot).toHaveBeenCalledOnce();
    await act(async () => { vi.advanceTimersByTime(60_000); }); expect(mocks.getSnapshot).toHaveBeenCalledTimes(2);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => { vi.advanceTimersByTime(60_000); }); expect(mocks.getSnapshot).toHaveBeenCalledTimes(2); visibility.mockRestore();
  });
  it("closes the business exactly at validUntil before a slow server revalidation", async () => {
    vi.useFakeTimers(); const snapshot = accessFixture(); if (snapshot.access) snapshot.access.validUntil = new Date(Date.now() + 1_000).toISOString(); mocks.getSnapshot.mockResolvedValue(snapshot);
    render(tree(snapshot)); await act(async () => undefined); mocks.getSnapshot.mockImplementation(() => new Promise<AccessSnapshot>(() => undefined));
    await act(async () => { vi.advanceTimersByTime(1_000); }); expect(screen.queryByText("Business content")).toBeNull(); expect(screen.getByText("Regularización de suscripción")).toBeTruthy();
  });
  it("clears business on confirmed session revocation", async () => {
    render(tree()); await waitFor(() => expect(mocks.getSnapshot).toHaveBeenCalledOnce()); mocks.getSnapshot.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sin sesión")); fireEvent.focus(window);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login")); expect(screen.queryByText("Business content")).toBeNull();
  });
  it("invalidates retained local source capabilities after unmount", async () => {
    let retained: WorkspaceSource | null = null;
    function Probe() { const source = useWorkspaceSource(); useEffect(() => { retained = source; }, [source]); return <p>Source mounted</p>; }
    const view = render(tree(accessFixture(), <Probe />));
    await screen.findByText("Source mounted");
    const source = retained as WorkspaceSource | null;
    expect(source).not.toBeNull(); view.unmount();
    await expect(source?.createService({ name: "Must not execute", durationMinutes: 30, description: "" })).rejects.toMatchObject({ code: "CONTEXT_CHANGED" });
  });
  it("revalidates navigation and resets context when the identity changes", async () => {
    const view = render(tree(accessFixture(), <ServicesScreen />)); await screen.findByText("Servicio estándar");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Old user's service" } }); fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" })); await screen.findByText("Old user's service");
    const next = accessFixture(); next.user.id = "another-user"; next.memberships[0].id = "another-member";
    mocks.getSnapshot.mockResolvedValue(next); mocks.getWorkspace.mockResolvedValue({ organization: next.memberships[0].organization, membership: { id: "another-member", role: "OWNER", status: "ACTIVE", organizationId: next.activeOrganizationId }, access: next.access });
    mocks.pathname = "/app/servicios"; view.rerender(tree(accessFixture(), <ServicesScreen />));
    await waitFor(() => expect(screen.getByTestId("identity").textContent).toContain("another-user"));
    await screen.findByText("Servicio estándar"); expect(screen.queryByText("Old user's service")).toBeNull();
  });
});
