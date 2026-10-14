"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { apiMutation, clearCsrfToken, getSnapshot, requestEmailVerification } from "@/lib/api/browser";
import { toApiError } from "@/lib/api/errors";
import { isSafeReturnTo } from "@/lib/navigation/return-to";

type RecoveryMode = "forgot" | "reset" | "verify";
type ResendState = "idle" | "sending" | "success" | "error" | "rate-limited";
const titles = { forgot: "Recuperá tu contraseña", reset: "Elegí una nueva contraseña" };
const inputClass = "block min-h-11 w-full rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm text-[#182026] outline-none focus:border-[#182026] focus:ring-1 focus:ring-[#182026]";

export function RecoveryForm({ mode, initialReturnTo, registered = false }: { mode: RecoveryMode; initialReturnTo?: string; registered?: boolean }) {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [token, setToken] = useState<string | null>(null);
  const extracted = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [resending, setResending] = useState(false);
  const resendBusy = useRef(false);
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [recipient, setRecipient] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "forgot" || extracted.current) return;
    extracted.current = true;
    const url = new URL(window.location.href);
    const fragmentToken = new URLSearchParams(url.hash.slice(1)).get("token");
    const queryToken = url.searchParams.get("token");
    const presentedToken = fragmentToken || queryToken;
    const validToken = presentedToken && /^[A-Za-z0-9_-]{43}$/.test(presentedToken) ? presentedToken : null;
    if (queryToken) url.searchParams.delete("token");
    if (fragmentToken) url.hash = "";
    if (queryToken || fragmentToken) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    let storedRecipient: string | null = null;
    if (mode === "verify" && registered) {
      try {
        const storedValue = sessionStorage.getItem("nuari_verify_email");
        if (storedValue && storedValue.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(storedValue)) storedRecipient = storedValue;
        sessionStorage.removeItem("nuari_verify_email");
      } catch { /* Email display is optional; verification does not depend on browser storage. */ }
    }
    queueMicrotask(() => {
      setRecipient(storedRecipient);
      setToken(validToken ?? "");
      setInvalidToken(Boolean(presentedToken) && !validToken);
    });
  }, [mode, registered]);

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
        setToken(""); setComplete(true); setAlreadyVerified(false); setInvalidToken(false); setMessage(null);
      }
    } catch (error) {
      const failure = toApiError(error);
      if (mode === "verify" && failure.code === "INVALID_TOKEN") {
        setToken(""); setInvalidToken(true);
        try {
          const snapshot = await getSnapshot();
          if (snapshot.user.emailVerifiedAt) { setAlreadyVerified(true); setInvalidToken(false); setMessage(null); return; }
        } catch { /* Keep the invalid-link state when the current session cannot be checked. */ }
      }
      setMessage(failure.message);
    }
    finally { busy.current = false; setPending(false); }
  }

  async function handleResendVerification() {
    if (resendBusy.current || busy.current) return;
    resendBusy.current = true; setResending(true); setResendState("sending"); setMessage(null);
    try {
      const result = await requestEmailVerification(returnTo && isSafeReturnTo(returnTo) ? { returnTo } : {});
      setResendState("success"); setMessage(result.message || "Te enviamos un nuevo correo de verificación. Revisá tu casilla.");
    } catch (error) {
      const failure = toApiError(error);
      setResendState(failure.code === "RATE_LIMITED" ? "rate-limited" : "error");
      setMessage(failure.message);
    } finally {
      resendBusy.current = false; setResending(false);
    }
  }

  const [returnTo, setReturnTo] = useState<string | null>(initialReturnTo && isSafeReturnTo(initialReturnTo) ? initialReturnTo : null);
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

  if (mode === "verify") {
    const completed = complete || alreadyVerified;
    const verifying = Boolean(token);
    const feedbackClass = resendState === "success"
      ? "border-[#BFE8CE] bg-[#EFFBF4] text-[#2B6E4A]"
      : resendState === "rate-limited"
        ? "border-[#F1D8A8] bg-[#FFF8E8] text-[#775510]"
        : resendState === "error" || invalidToken
          ? "border-[#F1C8C2] bg-[#FFF5F3] text-[#A04439]"
          : "border-[#E4E9E7] bg-white text-[#536068]";

    return (
      <div className="auth-form-transition">
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-[#DCE9E0] bg-[#EFFBF4] text-[#438C78]">
          {completed ? <CheckCircle aria-hidden="true" size={28} weight="fill" /> : <EnvelopeSimple aria-hidden="true" size={27} weight="regular" />}
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#182026]">
          {complete ? "¡Correo verificado!" : alreadyVerified ? "Tu correo ya está verificado" : verifying ? "Confirmá tu correo" : "Revisá tu correo"}
        </h1>
        {completed ? (
          <>
            <p className="mb-6 text-sm leading-relaxed text-[#667078]">{complete ? "Tu cuenta está lista para utilizarse." : "Tu cuenta ya puede utilizarse."}</p>
            <Link href={returnTo && isSafeReturnTo(returnTo) ? returnTo : "/onboarding"} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2A3742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">
              {returnTo ? "Continuar con la invitación" : "Continuar a Nuari"}
            </Link>
          </>
        ) : verifying ? (
          <>
            <p className="mb-6 text-sm leading-relaxed text-[#667078]">Reconocimos el enlace de verificación. Confirmá para activar tu cuenta.</p>
            <form onSubmit={submit} aria-busy={pending} className="space-y-4">
              <button type="submit" disabled={!hydrated || pending || complete || !token} className="min-h-12 w-full rounded-xl bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2A3742] disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? "Confirmando…" : "Confirmar verificación"}
              </button>
            </form>
            {message ? <p role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 text-sm ${feedbackClass}`}>{message}</p> : null}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-[#667078]">
              {invalidToken ? "El enlace no es válido o venció. Podés solicitar uno nuevo." : "Abrí el enlace que enviamos a tu correo desde tu bandeja de entrada para confirmar tu cuenta."}
            </p>
            {recipient ? <p className="mb-6 break-all rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#182026]" aria-label="Correo destinatario">{recipient}</p> : null}
            <button type="button" onClick={handleResendVerification} disabled={resending || pending || alreadyVerified} className="min-h-11 w-full rounded-xl border border-[#D9E2DD] bg-white px-4 py-3 text-sm font-semibold text-[#182026] transition-colors hover:bg-[#F8FAF9] disabled:cursor-not-allowed disabled:opacity-50">
              {resending ? "Enviando correo…" : "Reenviar correo de verificación"}
            </button>
            {message ? <p role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 text-sm ${feedbackClass}`}>{message}</p> : null}
          </>
        )}
        {!completed && returnTo ? <Link href={returnTo} className="mt-6 inline-block text-sm font-semibold text-[#182026] hover:underline">Continuar con la invitación</Link> : !completed ? <Link href="/onboarding" className="mt-6 inline-block text-sm font-semibold text-[#182026] hover:underline">Volver a Nuari</Link> : null}
      </div>
    );
  }

  return (
    <div className="auth-form-transition">
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#182026]">{titles[mode]}</h1>
      <p className="mb-8 text-sm text-[#667078]">
        Seguí los pasos para volver a tu cuenta.
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
          disabled={!hydrated || pending || complete || (mode === "reset" && !token)}
          className="min-h-12 w-full rounded-xl bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Procesando…" : mode === "reset" ? "Actualizar contraseña" : "Enviar enlace"}
        </button>

        {mode === "reset" && token === "" && !complete ? (
          <div className="space-y-3">
            <p role="status" className="text-sm text-[#A04439]">
              El enlace es inválido o no contiene un token válido.
            </p>
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
          href="/login"
          className="inline-block text-sm font-semibold text-[#182026]"
        >
          Volver a Nuari
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
