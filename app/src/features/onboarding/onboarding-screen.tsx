"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Bed } from "@phosphor-icons/react/dist/csr/Bed";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { HandWaving } from "@phosphor-icons/react/dist/csr/HandWaving";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Scissors } from "@phosphor-icons/react/dist/csr/Scissors";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Storefront } from "@phosphor-icons/react/dist/csr/Storefront";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { businessTypes, isPlanSuggested, plans } from "./catalog";
import type { BusinessType, OnboardingStep, Plan } from "./catalog";
import styles from "./onboarding.module.css";
import { SelectionCard } from "./selection-card";
import { generateSlug, isValidIdentity, isValidSlug } from "./slug";
import { useAccess } from "@/features/access/access-provider";
import { AccountControls } from "@/features/access/account-controls";
import { apiMutation, createOrganization, getSnapshot } from "@/lib/api/browser";
import { toApiError } from "@/lib/api/errors";
import { freezeOnboardingAttempt, type OnboardingAttempt } from "./submission";

const typeIcons = { SERVICES: Scissors, COMMERCE: Storefront, HOSPITALITY: Bed };
const stepTitles = {
  1: "Empecemos por lo esencial.",
  2: "¿Qué tipo de negocio vas a gestionar?",
  3: "Elegí el plan perfecto para vos.",
  4: "Todo está listo para empezar.",
};
const actionClass = "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#182026] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_0_rgb(24,32,38,0.15)] transition-all hover:bg-[#2A3742] hover:shadow-[0_12px_30px_-10px_rgba(24,32,38,0.08)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#182026] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none";

export function OnboardingScreen() {
  const router = useRouter();
  const { snapshot, error: accessError, refresh } = useAccess();
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateAfterRevocation, setShowCreateAfterRevocation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>();
  const attempt = useRef<OnboardingAttempt | null>(null);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [identityTouched, setIdentityTouched] = useState(false);
  const [type, setType] = useState<BusinessType | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedStep = useRef<OnboardingStep | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    if (focusedStep.current === step) return;
    if (focusedStep.current === null) inputRef.current?.focus();
    else headingRef.current?.focus();
    focusedStep.current = step;
  }, [step]);

  const identityValid = isValidIdentity(name, slug);
  const canContinue = step === 1 ? identityValid : step === 2 ? type !== null : step === 3 ? plan !== null : identityValid && type !== null && plan !== null;
  const slugInvalid = Boolean(fieldErrors?.slug?.length) || ((identityTouched || slugEdited || name.length > 0) && !isValidSlug(slug));
  const nameInvalid = Boolean(fieldErrors?.name?.length) || (identityTouched && name.trim().length === 0);
  const selectedType = businessTypes.find((option) => option.id === type);
  const selectedPlan = plans.find((option) => option.id === plan);
  const SummaryIcon = type ? typeIcons[type] : Scissors;

  async function continueStep() {
    if (navigating.current) return;
    if (step === 1) setIdentityTouched(true);
    if (!canContinue) return;
    if (step === 4) {
      navigating.current = true;
      setPending(true); setMessage(null); setFieldErrors(undefined);
      try {
        const context = await getSnapshot();
        if (context.user.id !== snapshot?.user.id) { await refresh(); return; }
        if (context.memberships.length) { router.replace("/app"); router.refresh(); return; }
        if (!context.onboarding.canCreateOrganization) { await refresh(); setMessage("Verificá tu correo y comprobá tu elegibilidad antes de crear el negocio."); return; }
        if (!type || !plan) return;
        attempt.current ??= freezeOnboardingAttempt({ name: name.trim(), slug, businessType: type, planCode: plan });
        await createOrganization(attempt.current.payload, attempt.current.key);
        const confirmed = await refresh();
        if (confirmed?.memberships.length) { router.replace("/app"); router.refresh(); }
        else { setUncertain(true); setMessage("La solicitud se envió. Reintentá para comprobar la creación de tu espacio."); }
      } catch (error) {
        const failure = toApiError(error);
        if (failure.status === 401) { await refresh(); return; }
        if (failure.status === 0 || failure.status >= 500 || failure.code === "ONBOARDING_ALREADY_COMPLETED") {
          setUncertain(true);
          try {
            const context = await getSnapshot();
            if (context.user.id === snapshot?.user.id && context.memberships.length) { await refresh(); router.replace("/app"); router.refresh(); return; }
          } catch { /* The result remains unknown; retain the exact key and payload. */ }
          setMessage("No pudimos confirmar el resultado. Reintentá sin cambiar la configuración.");
        } else {
          attempt.current = null; setUncertain(false); setMessage(failure.message); setFieldErrors(failure.fieldErrors);
          if (failure.code === "SLUG_TAKEN") setFieldErrors({ slug: [failure.message] });
          if (failure.code === "SLUG_TAKEN" || failure.fieldErrors?.slug || failure.fieldErrors?.name) setStep(1);
          else if (failure.fieldErrors?.businessType) setStep(2);
          else if (failure.fieldErrors?.planCode) setStep(3);
          if (failure.code === "EMAIL_UNVERIFIED" || failure.code === "TRIAL_ALREADY_USED") await refresh();
        }
      } finally { navigating.current = false; setPending(false); }
    } else {
      setStep(step === 1 ? 2 : step === 2 ? 3 : 4);
    }
  }
  async function resendVerification() {
    if (navigating.current) return;
    navigating.current = true; setPending(true);
    try { setMessage((await apiMutation<{ message: string }>("/auth/email-verification/request")).message); }
    catch (error) { setMessage(toApiError(error).message); }
    finally { navigating.current = false; setPending(false); }
  }

  function handleEnter(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.target instanceof Element && event.target.closest("button, a, input[type='radio']")) return;
    event.preventDefault();
    if (!event.repeat) continueStep();
  }

  if (!snapshot) return <main className="min-h-screen bg-[#F8FAF9] p-8"><p role="status">{accessError ?? "Comprobando tu acceso…"}</p><button type="button" onClick={() => void refresh()}>Reintentar</button></main>;
  if (snapshot.onboarding.reason === "ACCESS_REVOKED" && !showCreateAfterRevocation) {
    return (
      <main className="min-h-screen bg-[#F8FAF9] p-8">
        <AccountControls />
        <section className="mx-auto mt-16 max-w-xl rounded-3xl border border-[#E4E9E7] bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">Ya no tenés acceso a esta organización</h1>
          <p className="mt-4 text-[#667078]">Tu cuenta sigue activa, pero ya no forma parte de ninguna organización disponible.</p>
          {snapshot.onboarding.canCreateOrganization ? (
            <button type="button" onClick={() => setShowCreateAfterRevocation(true)} className="mt-6 min-h-11 rounded-xl bg-[#182026] px-5 py-3 text-sm font-semibold text-white">
              Crear una organización nueva
            </button>
          ) : (
            <p className="mt-6 text-sm text-[#667078]">
              Si necesitás recuperar el acceso, pedile al propietario que te invite nuevamente o contactanos en{" "}
              <a className="font-semibold underline" href="mailto:hola@nuari.app">hola@nuari.app</a>.
            </p>
          )}
        </section>
      </main>
    );
  }
  if (snapshot.onboarding.reason === "TRIAL_ALREADY_USED") return <main className="min-h-screen bg-[#F8FAF9] p-8"><AccountControls /><h1 className="mt-8 text-3xl font-bold">Tu prueba ya fue utilizada</h1><p className="mt-4">Contactanos en <a href="mailto:hola@nuari.app">hola@nuari.app</a> para obtener ayuda.</p></main>;
  return (
    <div className={`${styles.screen} flex min-h-dvh flex-col bg-[#F8FAF9] text-[#182026] antialiased selection:bg-[#DDF6E8] selection:text-[#182026]`} onKeyDown={handleEnter}>
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" aria-label="nuari, inicio" className="text-2xl font-bold tracking-tight focus-visible:outline-[#182026]">nuari</Link>
          {step > 1 ? <button type="button" disabled={pending || uncertain} onClick={(event) => {
            if (event.detail > 1) return;
            setStep(step === 4 ? 3 : step === 3 ? 2 : 1);
          }} className={`${styles.back} flex min-h-11 items-center gap-1.5 text-sm font-medium text-[#667078] transition-colors hover:text-[#182026] focus-visible:outline-[#182026]`}><ArrowLeft aria-hidden="true" className="text-lg" /> Volver</button> : null}
        </div>
        <AccountControls /><div role="status" aria-live="polite" aria-atomic="true">
          <span className="sr-only">Paso {step} de 4</span>
          <div aria-hidden="true" className="flex gap-2">{[1, 2, 3, 4].map((dot) => <span key={dot} className={`size-2 rounded-full transition-colors duration-500 ${dot <= step ? "bg-[#182026]" : "bg-[#E4E9E7]"}`} />)}</div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:py-16">
        <section key={step} aria-labelledby="onboarding-title" className={`${styles.step} w-full min-w-0 ${step === 2 ? "max-w-3xl" : step === 3 ? "max-w-4xl" : "max-w-2xl"} ${step === 4 ? "flex flex-col items-center text-center" : ""}`}>
          {step === 1 ? <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#E4E9E7] bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#667078] shadow-sm"><HandWaving aria-hidden="true" weight="fill" className="text-[#FFB86B]" /> Bienvenido</div> : null}
          {step === 3 ? <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A997E8]/20 bg-[#F0ECFF] px-3 py-1.5 text-xs font-semibold tracking-wide"><Gift aria-hidden="true" weight="fill" className="text-sm text-[#A997E8]" /> Probá Nuari gratis por 14 días</div> : null}
          {step === 4 ? <div className="relative mb-6 flex size-20 items-center justify-center rounded-full bg-[#DDF6E8] shadow-sm"><span aria-hidden="true" className="absolute inset-0 rounded-full bg-[#7ED6A5] opacity-20 motion-safe:animate-ping" /><CheckCircle aria-hidden="true" weight="fill" className="relative text-4xl text-[#7ED6A5]" /></div> : null}
          <h1 id="onboarding-title" ref={headingRef} tabIndex={-1} className={`mb-3 font-bold tracking-tight focus-visible:outline-[#182026] ${step === 1 ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}>{stepTitles[step]}</h1>

          {step === 1 ? <>
            <p className="mb-10 text-lg text-[#667078]">¿Cómo se llama tu negocio?</p>
            <label htmlFor="business-name" className="sr-only">Nombre del negocio</label>
            <div className="mb-6 rounded-2xl border border-[#E4E9E7] bg-white px-6 py-5 shadow-sm transition-shadow focus-within:border-[#182026] focus-within:shadow-[0_0_0_3px_rgba(24,32,38,0.1)]">
              <input ref={inputRef} id="business-name" type="text" maxLength={100} disabled={pending || uncertain} autoComplete="off" placeholder="Ej. Estudio Nuari" value={name}
                aria-invalid={nameInvalid} aria-describedby={nameInvalid ? "business-name-error" : undefined}
                onBlur={() => setIdentityTouched(true)} onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((errors) => errors ? { ...errors, name: [] } : undefined);
                  if (!slugEdited) setSlug(generateSlug(event.target.value));
                }} className={`${styles.nameInput} w-full min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-[#A0AAB2]`} />
            </div>
            {nameInvalid ? <p id="business-name-error" aria-live="polite" className="mb-4 text-sm text-[#A04439]">{fieldErrors?.name?.join(" ") || "Ingresá el nombre de tu negocio."}</p> : null}
            <div className="mb-10 ml-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="business-slug" className="text-[#667078]">Tu enlace será:</label>
                <div className="group flex min-h-11 max-w-full items-center rounded-md bg-[#E4E9E7]/40 px-2 py-0.5 font-medium transition-colors hover:bg-[#E4E9E7] focus-within:ring-2 focus-within:ring-[#182026]">
                  <span className="shrink-0 text-[#667078]">nuari.app/</span>
                  <input id="business-slug" type="text" minLength={3} maxLength={63} disabled={pending || uncertain} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={slugInvalid} aria-describedby={slugInvalid ? "business-slug-error" : undefined} placeholder="tu-negocio" value={slug}
                    onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); setFieldErrors((errors) => errors ? { ...errors, slug: [] } : undefined); }}
                    className={`${styles.slugInput} min-w-0 max-w-[150px] border-0 bg-transparent p-0 outline-none`} style={{ width: `${Math.max(10, Math.min(slug.length, 18))}ch` }} />
                  <PencilSimple aria-hidden="true" className="ml-1.5 shrink-0 text-xs text-[#667078] transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" />
                </div>
              </div>
              {slugInvalid ? <p id="business-slug-error" aria-live="polite" className="mt-2 text-sm text-[#A04439]">{fieldErrors?.slug?.join(" ") || "Usá entre 3 y 63 letras minúsculas, números y guiones entre palabras. No uses nombres reservados."}</p> : null}
            </div>
          </> : null}

          {step === 2 ? <>
            <p className="mb-10 text-[#667078]">Esto nos ayuda a configurar las herramientas adecuadas para vos. Podés cambiarlo más adelante.</p>
            <fieldset className="mb-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
              <legend className="sr-only">Tipo de negocio</legend>
              {businessTypes.map((option) => {
                const Icon = typeIcons[option.id];
                return <SelectionCard key={option.id} group="business-type" value={option.id} title={option.name} checked={type === option.id} subdued={type !== null && type !== option.id} onSelect={() => setType(option.id)}>
                  <span className={`mb-4 flex size-12 items-center justify-center rounded-xl ${option.color}`}><Icon aria-hidden="true" className="text-2xl" /></span>
                  <span className="mb-1 font-bold">{option.name}</span>
                  <span id={`business-type-${option.id}-description`} className="text-xs leading-relaxed text-[#667078]">{option.description}</span>
                </SelectionCard>;
              })}
            </fieldset>
          </> : null}

          {step === 3 ? <>
            <p className="mb-2 text-sm font-medium text-[#667078]">No necesitás una tarjeta de crédito para empezar.</p>
            <p className="mb-8 max-w-2xl text-xs leading-relaxed text-[#667078]">Al finalizar la prueba, necesitarás activar tu suscripción para continuar utilizando las herramientas de Nuari. No se realizarán cargos automáticos y tus datos siempre estarán seguros.</p>
            <fieldset className="mb-10 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <legend className="sr-only">Plan</legend>
              {plans.map((option) => <SelectionCard key={option.id} group="business-plan" value={option.id} title={option.name} checked={plan === option.id} subdued={plan ? plan !== option.id : !isPlanSuggested(type, option.id)} featured={option.id === "PRO"} onSelect={() => setPlan(option.id)}>
                <span className="mb-1 pr-6 font-bold">{option.name}</span>
                <span id={`business-plan-${option.id}-description`} className="mb-6 min-h-12 text-xs leading-relaxed text-[#667078]">{option.description}</span>
                <span role="list" className="mt-auto space-y-2.5 text-xs font-medium text-[#667078]">{option.features.map((feature) => <span role="listitem" key={feature} className="flex gap-2"><Check aria-hidden="true" className={`shrink-0 text-sm ${option.id === "PRO" ? "text-[#7ED6A5]" : "text-[#182026]"}`} />{feature}</span>)}</span>
              </SelectionCard>)}
            </fieldset>
          </> : null}

          {step === 4 ? <>
            <p className="mb-10 max-w-md text-[#667078]">Revisá la configuración de tu espacio antes de continuar</p>
            <div className="relative mb-10 w-full max-w-md overflow-hidden rounded-2xl border border-[#E4E9E7] bg-white p-6 text-left shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]">
              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[#E8F0FF] opacity-50 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#182026] text-lg font-bold text-white shadow-sm">{Array.from(name.trim())[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 text-lg font-bold [overflow-wrap:anywhere]">{name.trim()}</h2>
                  <p className="mb-3 text-sm font-medium text-[#667078] [overflow-wrap:anywhere]">nuari.app/<span className="text-[#182026]">{slug}</span></p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${selectedType?.badge}`}><SummaryIcon aria-hidden="true" className="shrink-0" />{selectedType?.name}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#A997E8]/30 bg-[#F0ECFF] px-2.5 py-1 text-xs font-semibold"><Star aria-hidden="true" weight="fill" className="shrink-0" />Plan {selectedPlan?.name}</span>
                  </div>
                </div>
              </div>
            </div>
          </> : null}

          <div className={`flex w-full flex-wrap items-center justify-between gap-4 ${step === 4 ? "max-w-md" : ""}`}>
            {step !== 4 ? <p className={`text-xs text-[#667078] ${!canContinue && step !== 1 ? "invisible" : ""}`}>Presioná <kbd className="rounded border border-[#E4E9E7] bg-white px-1.5 py-0.5 text-[10px] font-semibold">Enter ↵</kbd>{step === 1 ? " para continuar" : ""}</p> : null}
            <button type="button" disabled={!canContinue || pending || (step === 4 && !snapshot.onboarding.canCreateOrganization)} onClick={(event) => { if (event.detail <= 1) void continueStep(); }} className={`${actionClass} ${step === 4 ? `${styles.finalAction} w-full py-4` : "ml-auto"}`}>
              {pending ? "Procesando…" : step === 4 ? uncertain ? "Reintentar creación" : "Entrar a mi espacio" : "Continuar"}
              {step !== 4 ? <ArrowRight aria-hidden="true" className="text-lg" /> : null}
            </button>
          </div>
          {snapshot.onboarding.reason === "EMAIL_UNVERIFIED" ? <div className="mt-4 text-sm text-[#667078]"><p>Verificá tu correo para activar la prueba.</p><button type="button" disabled={pending} onClick={() => void resendVerification()} className="mt-2 font-semibold underline">Reenviar verificación</button><button type="button" disabled={pending} onClick={() => void refresh()} className="ml-4 font-semibold underline">Ya verifiqué mi correo</button></div> : null}
          {message ? <p role="status" aria-live="polite" className="mt-4 text-sm text-[#A04439]">{message}</p> : null}
          {step === 4 ? <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#667078]"><ShieldCheck aria-hidden="true" className="shrink-0" /> Podés cambiar tu plan en cualquier momento.</div> : null}
        </section>
      </main>
    </div>
  );
}
