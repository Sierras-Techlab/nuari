import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAccessSnapshot, type AccessSnapshot } from "@/lib/api/contracts";
import { getInternalApiOrigin } from "@/lib/api/internal-origin";

export type ServerAccess = { state: "authenticated"; snapshot: AccessSnapshot } | { state: "anonymous" } | { state: "unavailable" };
// Debe coincidir con la cookie que emite la API. Sólo el harness E2E (web en `next start`, API no productiva) usa el override; sólo se aceptan los dos nombres válidos.
function sessionCookieName(): "__Host-nuari_session" | "nuari_session" {
  const override = process.env.NUARI_SESSION_COOKIE_NAME;
  if (override === "nuari_session" || override === "__Host-nuari_session") return override;
  return process.env.NODE_ENV === "production" ? "__Host-nuari_session" : "nuari_session";
}
export async function readServerAccess(): Promise<ServerAccess> {
  const store = await cookies();
  const name = sessionCookieName();
  const token = store.get(name)?.value;
  if (!token) return { state: "anonymous" };
  // Session tokens are base64url; never forward arbitrary cookie/header content.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { state: "anonymous" };
  try {
    const response = await fetch(`${getInternalApiOrigin()}/api/auth/me`, { headers: { Cookie: `${name}=${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (response.status === 401) return { state: "anonymous" };
    if (!response.ok) return { state: "unavailable" };
    const snapshot: unknown = await response.json();
    return isAccessSnapshot(snapshot) ? { state: "authenticated", snapshot } : { state: "unavailable" };
  } catch { return { state: "unavailable" }; }
}
export async function guardPage(mode: "auth" | "onboarding" | "app" | "business"): Promise<AccessSnapshot | null> {
  const result = await readServerAccess();
  if (result.state === "unavailable") return null;
  if (result.state === "anonymous") {
    if (mode !== "auth") redirect("/login");
    return null;
  }
  const snapshot = result.snapshot;
  if (mode === "auth") redirect(snapshot.memberships.length ? "/app" : "/onboarding");
  if (mode === "onboarding" && snapshot.memberships.length) redirect("/app");
  if ((mode === "app" || mode === "business") && !snapshot.memberships.length) redirect("/onboarding");
  if (mode === "business" && !snapshot.access?.businessAllowed) redirect("/app");
  return snapshot;
}
export async function guardAuthPage(): Promise<boolean> {
  const result = await readServerAccess();
  if (result.state === "authenticated") redirect(result.snapshot.memberships.length ? "/app" : "/onboarding");
  return result.state !== "unavailable";
}
