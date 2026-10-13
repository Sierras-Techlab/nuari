"use client";

import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { getSnapshot, login, register } from "@/lib/api/browser";
import { toApiError } from "@/lib/api/errors";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
  registered?: boolean;
};

export function AuthForm({ mode, registered = false }: AuthFormProps) {
  const router = useRouter();
  const navigating = useRef(false);
  const hydrated = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(registered ? "Si la cuenta puede registrarse, recibirás un correo de verificación. Iniciá sesión para continuar." : null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const isLogin = mode === "login";
  const statusId = `${mode}-status`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || navigating.current) return;
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (password.length < 12 || password.length > 128 || new TextEncoder().encode(password).length > 1024) { setMessage("La contraseña debe tener entre 12 y 128 caracteres."); return; }
    navigating.current = true; setPending(true); setMessage(null); setFieldErrors(undefined);
    try {
      if (!isLogin) {
        const name = `${String(data.get("firstName") ?? "").trim()} ${String(data.get("lastName") ?? "").trim()}`.trim();
        if (name.length > 100) { setMessage("El nombre completo no puede superar 100 caracteres."); return; }
        await register({ name, email, password });
        form.reset();
        router.replace("/login?registered=1");
      } else {
        await login({ email, password });
        form.reset();
        const snapshot = await getSnapshot();
        router.replace(snapshot.memberships.length ? "/app" : "/onboarding");
      }
      router.refresh();
    } catch (error) {
      const failure = toApiError(error);
      setMessage(failure.message); setFieldErrors(failure.fieldErrors);
    } finally { navigating.current = false; setPending(false); }
  }

  return (
    <div key={mode} className="auth-form-transition">
      <div className="mb-8">
        {isLogin ? <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E4E9E7] bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#667078] shadow-sm">Bienvenido a Nuari</div> : null}
        <h2 className="mb-2 text-3xl font-bold tracking-tight text-[#182026]">{isLogin ? "Volvé a tu negocio" : "Creá tu cuenta"}</h2>
        <p className="text-sm text-[#667078]">{isLogin ? "Ingresá a tu cuenta para continuar operando." : "Empezá a organizar tu negocio con Nuari en minutos."}</p>
      </div>

      <form id={`${mode}-form`} className="space-y-4" onSubmit={handleSubmit} aria-busy={pending} aria-describedby={message ? statusId : undefined}>
        {isLogin ? <LoginFields errors={fieldErrors} passwordVisible={passwordVisible} onTogglePassword={() => setPasswordVisible((value) => !value)} /> : <RegisterFields errors={fieldErrors} passwordVisible={passwordVisible} onTogglePassword={() => setPasswordVisible((value) => !value)} />}

        <button
          type="submit"
          disabled={!hydrated || pending}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-transparent bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgb(24,32,38,0.15)] transition-all hover:bg-[#2A3742] hover:shadow-[0_6px_20px_rgba(24,32,38,0.2)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:hover:shadow-[0_4px_14px_0_rgb(24,32,38,0.15)]"
        >
          {pending ? "Procesando…" : isLogin ? "Iniciar sesión" : "Crear mi cuenta"}
        </button>
        {message ? <p id={statusId} role="status" aria-live="polite" className="rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm leading-relaxed text-[#536068]">{message}</p> : null}
        {fieldErrors ? <ul aria-live="polite" className="text-sm text-[#A04439]">{Object.entries(fieldErrors).map(([field, errors]) => <li id={`${mode}-${field}-error`} key={field}>{errors.join(" ")}</li>)}</ul> : null}
      </form>

      <p className="mt-8 text-center text-sm text-[#667078]">
        {isLogin ? "¿Todavía no tenés una cuenta? " : "¿Ya tenés una cuenta? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-bold text-[#182026] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">{isLogin ? "Crear cuenta" : "Iniciar sesión"}</Link>
      </p>

      <div className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#667078] md:hidden"><LockKey aria-hidden="true" weight="fill" /> Acceso seguro a tu espacio de trabajo.</div>
    </div>
  );
}

function LoginFields({ passwordVisible, onTogglePassword, errors }: { passwordVisible: boolean; onTogglePassword: () => void; errors?: Record<string, string[]> }) {
  return <>
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="login-email">Email</label>
      <input id="login-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(errors?.email?.length)} aria-describedby={errors?.email?.length ? "login-email-error" : undefined} placeholder="tucorreo@ejemplo.com" className={inputClassName} />
    </div>
    <div>
      <div className="mb-1.5 flex items-center justify-between"><label className="block text-sm font-medium text-[#182026]" htmlFor="login-password">Contraseña</label><Link href="/forgot-password" className="text-xs font-semibold text-[#536068]">¿Olvidaste tu contraseña?</Link></div>
      <PasswordField id="login-password" name="password" error={Boolean(errors?.password?.length)} autoComplete="current-password" passwordVisible={passwordVisible} onTogglePassword={onTogglePassword} placeholder="••••••••" />
    </div>
  </>;
}

function RegisterFields({ passwordVisible, onTogglePassword, errors }: { passwordVisible: boolean; onTogglePassword: () => void; errors?: Record<string, string[]> }) {
  return <>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-first-name">Nombre</label><input id="register-first-name" name="firstName" type="text" autoComplete="given-name" required maxLength={100} aria-invalid={Boolean(errors?.name?.length)} aria-describedby={errors?.name?.length ? "register-name-error" : undefined} placeholder="Juan" className={inputClassName} /></div>
      <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-last-name">Apellido</label><input id="register-last-name" name="lastName" type="text" autoComplete="family-name" required maxLength={100} aria-invalid={Boolean(errors?.name?.length)} aria-describedby={errors?.name?.length ? "register-name-error" : undefined} placeholder="Pérez" className={inputClassName} /></div>
    </div>
    <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-email">Email</label><input id="register-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} aria-invalid={Boolean(errors?.email?.length)} aria-describedby={errors?.email?.length ? "register-email-error" : undefined} placeholder="tucorreo@ejemplo.com" className={inputClassName} /></div>
    <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-password">Contraseña</label><PasswordField id="register-password" name="password" error={Boolean(errors?.password?.length)} autoComplete="new-password" passwordVisible={passwordVisible} onTogglePassword={onTogglePassword} placeholder="Mínimo 12 caracteres" /></div>
    <div className="flex items-start gap-3 pt-2"><div className="flex h-5 items-center"><input id="terms" name="terms" type="checkbox" required className="h-4 w-4 cursor-pointer rounded border-[#E4E9E7] accent-[#182026] focus:ring-2 focus:ring-[#182026]" /></div><div className="text-sm"><label htmlFor="terms" className="font-medium leading-relaxed text-[#536068]">Acepto los <span className="font-semibold text-[#182026]">Términos</span> y la <span className="font-semibold text-[#182026]">Política de Privacidad</span>.</label></div></div>
  </>;
}

function PasswordField({ id, name, autoComplete, passwordVisible, onTogglePassword, placeholder, error = false }: { id: string; name: string; autoComplete: string; passwordVisible: boolean; onTogglePassword: () => void; placeholder: string; error?: boolean }) {
  return <div className="relative"><input id={id} name={name} type={passwordVisible ? "text" : "password"} autoComplete={autoComplete} required minLength={12} maxLength={128} aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined} placeholder={placeholder} className={`${inputClassName} pr-12`} /><button type="button" className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center pr-3 text-[#536068] transition-colors hover:text-[#182026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-[-2px]" onClick={onTogglePassword} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeSlash aria-hidden="true" className="text-lg" /> : <Eye aria-hidden="true" className="text-lg" />}</button></div>;
}

const inputClassName = "block min-h-11 w-full rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm text-[#182026] outline-none placeholder:text-[#667078]/60 transition-shadow focus:border-[#182026] focus:ring-1 focus:ring-[#182026]";

function noopSubscribe() {
  return () => undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}
