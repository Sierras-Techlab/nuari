"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSnapshot, getWorkspace, logout, selectOrganization } from "@/lib/api/browser";
import type { AccessSnapshot } from "@/lib/api/contracts";
import { ApiError, toApiError } from "@/lib/api/errors";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceProvider } from "@/features/workspace/workspace-provider";
import { SubscriptionPanel } from "./subscription-panel";

type AccessContextValue = {
  snapshot: AccessSnapshot | null;
  error: string | null;
  refresh(): Promise<AccessSnapshot | null>;
  select(id: string): Promise<void>;
  signOut(): Promise<void>;
  preflight(): Promise<void>;
};
const AccessContext = createContext<AccessContextValue | null>(null);
export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error("Authorized access context is required.");
  return context;
}
export function AccessProvider({ initialSnapshot, children }: { initialSnapshot: AccessSnapshot; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<AccessSnapshot | null>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<AccessSnapshot | null>(initialSnapshot);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const transitioning = useRef(false);
  const live = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const publish = useCallback((next: AccessSnapshot | null) => { latest.current = next; setSnapshot(next); }, []);
  const routeSnapshot = useCallback((next: AccessSnapshot) => {
    if (!next.memberships.length && pathname !== "/onboarding") { router.replace("/onboarding"); router.refresh(); }
    else if (next.memberships.length && pathname === "/onboarding") { router.replace("/app"); router.refresh(); }
    else if (!next.access?.businessAllowed && pathname.startsWith("/app/")) { router.replace("/app"); router.refresh(); }
  }, [pathname, router]);
  const refresh = useCallback(async () => {
    if (transitioning.current) return null;
    const version = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const next = await getSnapshot(controller.signal);
      if (version !== generation.current || controller.signal.aborted) return null;
      publish(next); setError(null); routeSnapshot(next);
      return next;
    } catch (reason) {
      if (version !== generation.current || controller.signal.aborted) return null;
      publish(null);
      const failure = toApiError(reason);
      if (failure.status === 401) { router.replace("/login"); router.refresh(); }
      else setError(failure.message);
      return null;
    }
  }, [publish, routeSnapshot, router]);
  useEffect(() => {
    const sequence = generation;
    const revalidate = () => { if (document.visibilityState === "visible") void refresh(); };
    revalidate();
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    const timer = window.setInterval(revalidate, 60_000);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", revalidate); document.removeEventListener("visibilitychange", revalidate); pending.current?.abort(); sequence.current++; };
  }, [refresh]);
  useEffect(() => {
    const deadline = snapshot?.access?.validUntil;
    if (!deadline || !snapshot?.access?.businessAllowed) return;
    const remaining = new Date(deadline).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = window.setTimeout(() => {
      const current = latest.current;
      if (Date.now() >= new Date(deadline).getTime() && current?.access) publish({ ...current, access: { ...current.access, businessAllowed: false } });
      void refresh();
    }, Math.min(Math.max(remaining, 0), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [snapshot, publish, refresh]);
  async function select(id: string) {
    if (transitioning.current) return;
    transitioning.current = true;
    generation.current++; pending.current?.abort(); publish(null); setError(null);
    try {
      await selectOrganization(id);
      if (!live.current) return;
      transitioning.current = false;
      await refresh(); router.refresh();
    } catch (reason) {
      if (!live.current) return;
      transitioning.current = false;
      setError(toApiError(reason).message);
      await refresh();
    } finally { transitioning.current = false; }
  }
  async function signOut() {
    if (transitioning.current) return;
    transitioning.current = true;
    generation.current++; pending.current?.abort(); publish(null); setError(null);
    try { await logout(); router.replace("/login"); router.refresh(); }
    catch (reason) { setError(toApiError(reason).message); }
    finally { transitioning.current = false; }
  }
  async function preflight() {
    const current = latest.current;
    const id = current?.activeOrganizationId;
    if (!current || !id || !current.access?.businessAllowed) throw new ApiError(403, "SUBSCRIPTION_REQUIRED", "El acceso al negocio no está habilitado.");
    const version = generation.current;
    try {
      const workspace = await getWorkspace(id);
      if (version !== generation.current || latest.current?.user.id !== current.user.id || latest.current?.activeOrganizationId !== id) throw new ApiError(0, "CONTEXT_CHANGED", "El espacio de trabajo cambió.");
      if (workspace.organization.id !== id || workspace.membership.organizationId !== id || workspace.membership.status !== "ACTIVE" || !workspace.access.businessAllowed) throw new ApiError(403, "SUBSCRIPTION_REQUIRED", "El acceso al negocio no está habilitado.");
      const member = current.memberships.find((candidate) => candidate.organization.id === id);
      if (!member || workspace.membership.id !== member.id || workspace.membership.role !== member.role) throw new ApiError(404, "ORGANIZATION_NOT_FOUND", "Tu contexto de acceso cambió.");
    } catch (reason) {
      const failure = toApiError(reason);
      if (version === generation.current) {
        publish(null);
        if (failure.status === 401) { router.replace("/login"); router.refresh(); }
        else if (failure.status === 403 || failure.status === 404) await refresh();
        else setError(failure.message);
      }
      throw failure;
    }
  }
  return <AccessContext.Provider value={{ snapshot, error, refresh, select, signOut, preflight }}>{children}</AccessContext.Provider>;
}
export function PrivateWorkspace({ children }: { children: ReactNode }) {
  const { snapshot, error, refresh } = useAccess();
  if (!snapshot) return <div className="min-h-screen bg-[#F8FAF9] p-8"><section role="status" className="rounded-2xl border border-[#E4E9E7] bg-white p-6"><p>{error ?? "Comprobando tu acceso…"}</p>{error ? <button type="button" className="mt-4 text-sm font-bold" onClick={() => void refresh()}>Reintentar</button> : null}</section></div>;
  const key = `${snapshot.user.id}:${snapshot.activeOrganizationId}`;
  return <AppShell>{snapshot.access?.businessAllowed && snapshot.activeOrganizationId ? <WorkspaceProvider key={key}>{children}</WorkspaceProvider> : <SubscriptionPanel key={key} />}</AppShell>;
}
