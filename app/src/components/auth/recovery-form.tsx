"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { apiMutation, clearCsrfToken, requestEmailVerification } from "@/lib/api/browser";
import { toApiError } from "@/lib/api/errors";
import { isSafeReturnTo } from "@/lib/navigation/return-to";

type RecoveryMode = "forgot" | "reset" | "verify";
const titles = { forgot: "Recuperá tu contraseña", reset: "Elegí una nueva contraseña", verify: "Verificá tu correo" };
const inputClass = "block min-h-11 w-full rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm text-[#182026] outline-none focus:border-[#182026] focus:ring-1 focus:ring-[#182026]";

export function RecoveryForm({ mode, initialReturnTo, registered = false }: { mode: RecoveryMode; initialReturnTo?: string; registered?: boolean }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [token, setToken] = useState<string | null>(null);
  const extracted = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (mode === "forgot" || extracted.current) return;
    extracted.current = true;
    let value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!value) {
      value = new URLSearchParams(window.location.search).get("token");
    }
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    queueMicrotask(() => setToken(value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : ""));
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!hydrated || busy.current || !form.checkValidity()) { form.reportValidity(); return; }
    if (mode !== "forgot" && !token) { setMessage("El enlace es inválido. Solicitá uno nuevo."); return; }
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    if (mode === "reset" && (password.length < 12 || password.length > 128 || new TextEncoder().encode(password).length > 1024)) { setMessage("Usá entre 12 y 128 caracteres."); return; }
    busy.current = true; setPending(true); setMessage(null);
    try {
      if (mode === "forgot") {
        const result = await apiMutation<{ message: string }>("/auth/password-reset/request", { email: String(data.get("email") ?? "").trim().toLowerCase() });
        setMessage(result.message);
      } else if (mode === "reset") {
        await apiMutation<void>("/auth/password-reset/confirm", { token, password });
        clearCsrfToken(); form.reset(); setToken(""); setComplete(true); setMessage("Tu contraseña se actualizó. Iniciá sesión nuevamente.");
      } else {
        await apiMutation<void>("/auth/email-verification/confirm", { token });
        if (returnTo && isSafeReturnTo(returnTo)) {
          router.replace(returnTo);
          return;
        }
        setToken(""); setComplete(true); setMessage("Correo verificado. Volvé a Nuari para continuar.");
      }
    } catch (error) {
      const failure = toApiError(error);
      if (mode === "verify" && failure.code === "INVALID_TOKEN") setToken("");
      setMessage(failure.message);
    }
    finally { busy.current = false; setPending(false); }
  }

  async function handleResendVerification() {
    if (resending || busy.current) return;
    setResending(true); setMessage(null);
    try {
      const result = await requestEmailVerification(returnTo && isSafeReturnTo(returnTo) ? { returnTo } : {});
      setMessage(result.message || "Te enviamos un nuevo correo de verificación. Revisá tu casilla.");
    } catch (error) {
      setMessage(toApiError(error).message);
    } finally {
      setResending(false);
    }
  }

  const [returnTo, setReturnTo] = useState<string | null>(initialReturnTo ?? null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const queryReturn = new URLSearchParams(window.location.search).get("returnTo");
      const stored = sessionStorage.getItem("nuari_invite_return");
      const chosen = (queryReturn && isSafeReturnTo(queryReturn))
        ? queryReturn
        : (stored && isSafeReturnTo(stored))
        ? stored
        : null;
      if (chosen) {
        queueMicrotask(() => setReturnTo(chosen));
      }
    }
  }, []);

  return (
    <div className="auth-form-transition">
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#182026]">{titles[mode]}</h1>
      <p className="mb-8 text-sm text-[#667078]">
        {mode === "verify" ? "Confirmá explícitamente para verificar tu cuenta." : "Seguí los pasos para volver a tu cuenta."}
      </p>
      <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
        {mode === "forgot" ? (
          <div>
            <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} />
          </div>
        ) : mode === "reset" ? (
          <div>
            <label htmlFor="recovery-password" className="mb-1.5 block text-sm font-medium">Nueva contraseña</label>
            <input id="recovery-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Mínimo 12 caracteres" className={inputClass} />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!hydrated || pending || complete || (mode !== "forgot" && !token)}
          className="min-h-12 w-full rounded-xl bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Procesando…" : mode === "verify" ? "Confirmar verificación" : mode === "reset" ? "Actualizar contraseña" : "Enviar enlace"}
        </button>

        {mode !== "forgot" && token === "" && !complete ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-[#A04439]">
              {mode === "verify" && registered ? "Cuenta creada. Revisá tu correo para verificarla." : "El enlace es inválido o no contiene un token válido."}
            </p>
            {mode === "verify" ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full min-h-11 rounded-xl border border-[#E4E9E7] bg-white px-4 py-2.5 text-sm font-medium text-[#182026] hover:bg-[#F8FAF9] disabled:opacity-50 transition-colors"
              >
                {resending ? "Enviando…" : "Reenviar correo de verificación"}
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p role="status" aria-live="polite" className="rounded-xl border border-[#E4E9E7] bg-white p-4 text-sm text-[#536068]">
            {message}
          </p>
        ) : null}
      </form>

      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={mode === "verify" ? (returnTo ?? "/onboarding") : "/login"}
          className="inline-block text-sm font-semibold text-[#182026]"
        >
          {returnTo && mode === "verify" ? "Continuar con la invitación" : "Volver a Nuari"}
        </Link>
        {mode === "reset" ? (
          <Link href="/forgot-password" className="text-sm text-[#536068]">
            Solicitar otro enlace
          </Link>
        ) : null}
      </div>
    </div>
  );
}
