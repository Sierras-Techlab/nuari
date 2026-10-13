"use client";
import { useEffect, useState } from "react";
import { getSubscription } from "@/lib/api/browser";
import type { SubscriptionResult } from "@/lib/api/contracts";
import { toApiError } from "@/lib/api/errors";
import { useAccess } from "./access-provider";

export function SubscriptionPanel() {
  const { snapshot, refresh } = useAccess();
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const id = snapshot?.activeOrganizationId;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getSubscription(id, controller.signal).then((next) => { if (!controller.signal.aborted) { setResult(next); setError(null); } }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      const failure = toApiError(reason);
      setError(failure.message);
      if (failure.status === 401 || failure.status === 404) void refresh();
    });
    return () => controller.abort();
  }, [id, revision, refresh]);
  const canManage = result?.access.canManageSubscription ?? snapshot?.access?.canManageSubscription;
  return <section className="rounded-2xl border border-[#E4E9E7] bg-white p-7" aria-labelledby="subscription-title"><h1 id="subscription-title" className="text-2xl font-bold">Tu suscripción necesita atención</h1><p className="mt-3 text-sm text-[#667078]">El acceso a las herramientas está suspendido. Tus datos se conservan.</p>{result ? <p className="mt-4 text-sm">Plan {result.subscription.planCode} · Prueba hasta {new Date(result.subscription.trialEndsAt).toLocaleDateString("es-AR")}</p> : null}<p className="mt-4 text-sm">{canManage ? <>La contratación todavía no está disponible. Contactanos en <a href="mailto:hola@nuari.app" className="font-semibold underline">hola@nuari.app</a>.</> : "Contactá al administrador de tu negocio para regularizar la suscripción."}</p>{error ? <p role="alert" className="mt-4 text-sm">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button></p> : null}</section>;
}
