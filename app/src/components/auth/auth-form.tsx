"use client";

import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const isLogin = mode === "login";
  const statusId = `${mode}-demo-status`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div key={mode} className="auth-form-transition">
      <div className="mb-8">
        {isLogin ? <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E4E9E7] bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#667078] shadow-sm">Bienvenido a Nuari</div> : null}
        <h2 className="mb-2 text-3xl font-bold tracking-tight text-[#182026]">{isLogin ? "Volvé a tu negocio" : "Creá tu cuenta"}</h2>
        <p className="text-sm text-[#667078]">{isLogin ? "Ingresá a tu cuenta para continuar operando." : "Empezá a organizar tu negocio con Nuari en minutos."}</p>
      </div>

      <form id={`${mode}-form`} className="space-y-4" onSubmit={handleSubmit} aria-describedby={submitted ? statusId : undefined}>
        {isLogin ? <LoginFields passwordVisible={passwordVisible} onTogglePassword={() => setPasswordVisible((value) => !value)} /> : <RegisterFields passwordVisible={passwordVisible} onTogglePassword={() => setPasswordVisible((value) => !value)} />}

        <button
          type="submit"
          disabled={!hydrated}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-transparent bg-[#182026] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgb(24,32,38,0.15)] transition-all hover:bg-[#2A3742] hover:shadow-[0_6px_20px_rgba(24,32,38,0.2)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:hover:shadow-[0_4px_14px_0_rgb(24,32,38,0.15)]"
        >
          {isLogin ? "Iniciar sesión" : "Crear mi cuenta"}
        </button>
        {submitted ? <p id={statusId} role="status" aria-live="polite" className="rounded-xl border border-[#E4E9E7] bg-white px-4 py-3 text-sm leading-relaxed text-[#536068]">{isLogin ? "El acceso todavía no está habilitado. Tus datos no se enviaron." : "El registro todavía no está habilitado. Tus datos no se enviaron."}</p> : null}
      </form>

      <p className="mt-8 text-center text-sm text-[#667078]">
        {isLogin ? "¿Todavía no tenés una cuenta? " : "¿Ya tenés una cuenta? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-bold text-[#182026] transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">{isLogin ? "Crear cuenta" : "Iniciar sesión"}</Link>
      </p>

      <div className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#667078] md:hidden"><LockKey aria-hidden="true" weight="fill" /> Acceso seguro a tu espacio de trabajo.</div>
    </div>
  );
}

function LoginFields({ passwordVisible, onTogglePassword }: { passwordVisible: boolean; onTogglePassword: () => void }) {
  return <>
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="login-email">Email</label>
      <input id="login-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="tucorreo@ejemplo.com" className={inputClassName} />
    </div>
    <div>
      <div className="mb-1.5 flex items-center justify-between"><label className="block text-sm font-medium text-[#182026]" htmlFor="login-password">Contraseña</label><span className="text-xs font-semibold text-[#536068]">¿Olvidaste tu contraseña?</span></div>
      <PasswordField id="login-password" name="password" autoComplete="current-password" passwordVisible={passwordVisible} onTogglePassword={onTogglePassword} placeholder="••••••••" />
    </div>
  </>;
}

function RegisterFields({ passwordVisible, onTogglePassword }: { passwordVisible: boolean; onTogglePassword: () => void }) {
  return <>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-first-name">Nombre</label><input id="register-first-name" name="firstName" type="text" autoComplete="given-name" required placeholder="Juan" className={inputClassName} /></div>
      <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-last-name">Apellido</label><input id="register-last-name" name="lastName" type="text" autoComplete="family-name" required placeholder="Pérez" className={inputClassName} /></div>
    </div>
    <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-email">Email</label><input id="register-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="tucorreo@ejemplo.com" className={inputClassName} /></div>
    <div><label className="mb-1.5 block text-sm font-medium text-[#182026]" htmlFor="register-password">Contraseña</label><PasswordField id="register-password" name="password" autoComplete="new-password" passwordVisible={passwordVisible} onTogglePassword={onTogglePassword} placeholder="Mínimo 8 caracteres" /></div>
    <div className="flex items-start gap-3 pt-2"><div className="flex h-5 items-center"><input id="terms" name="terms" type="checkbox" required className="h-4 w-4 cursor-pointer rounded border-[#E4E9E7] accent-[#182026] focus:ring-2 focus:ring-[#182026]" /></div><div className="text-sm"><label htmlFor="terms" className="font-medium leading-relaxed text-[#536068]">Acepto los <span className="font-semibold text-[#182026]">Términos</span> y la <span className="font-semibold text-[#182026]">Política de Privacidad</span>.</label></div></div>
  </>;
}

function PasswordField({ id, name, autoComplete, passwordVisible, onTogglePassword, placeholder }: { id: string; name: string; autoComplete: string; passwordVisible: boolean; onTogglePassword: () => void; placeholder: string }) {
  return <div className="relative"><input id={id} name={name} type={passwordVisible ? "text" : "password"} autoComplete={autoComplete} required placeholder={placeholder} className={`${inputClassName} pr-12`} /><button type="button" className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center pr-3 text-[#536068] transition-colors hover:text-[#182026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-[-2px]" onClick={onTogglePassword} aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeSlash aria-hidden="true" className="text-lg" /> : <Eye aria-hidden="true" className="text-lg" />}</button></div>;
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
