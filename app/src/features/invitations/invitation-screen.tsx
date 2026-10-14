"use client";

import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/csr/ArrowsLeftRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { EnvelopeOpen } from "@phosphor-icons/react/dist/csr/EnvelopeOpen";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { IdentificationCard } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { Prohibit } from "@phosphor-icons/react/dist/csr/Prohibit";
import { ShieldWarning } from "@phosphor-icons/react/dist/csr/ShieldWarning";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  acceptInvitation,
  getPublicInvitation,
  getSnapshot,
  logout,
  requestEmailVerification,
} from "@/lib/api/browser";
import type {
  AccessSnapshot,
  OrganizationRole,
  PublicInvitationDTO,
} from "@/lib/api/contracts";
import { toApiError } from "@/lib/api/errors";

const ROLE_LABELS: Record<OrganizationRole, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  EMPLOYEE: "Empleado",
};

type InvitationViewState =
  | { type: "LOADING" }
  | { type: "VALID_MATCH"; invitation: PublicInvitationDTO; snapshot: AccessSnapshot }
  | { type: "VALID_NO_AUTH"; invitation: PublicInvitationDTO }
  | { type: "VALID_MISMATCH"; invitation: PublicInvitationDTO; snapshot: AccessSnapshot }
  | { type: "UNVERIFIED"; invitation: PublicInvitationDTO; snapshot: AccessSnapshot }
  | { type: "EXPIRED"; message?: string }
  | { type: "REVOKED"; message?: string }
  | { type: "USED"; invitation?: PublicInvitationDTO }
  | { type: "INVALID"; message?: string }
  | { type: "SUCCESS"; organizationName: string }
  | { type: "ERROR"; message: string };

export function InvitationScreen({ token }: { token: string }) {
  const router = useRouter();
  const [viewState, setViewState] = useState<InvitationViewState>({ type: "LOADING" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Guardar en sessionStorage para que si el usuario se registra o verifica su email vuelva aquí
  useEffect(() => {
    if (typeof window !== "undefined" && token) {
      sessionStorage.setItem("nuari_invite_return", `/invitacion/${encodeURIComponent(token)}`);
    }
  }, [token]);

  async function handleResendVerification() {
    if (isResending) return;
    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await requestEmailVerification({ returnTo: currentReturnUrl });
      setResendStatus(res.message || "Te enviamos un nuevo correo de verificación. Revisá tu casilla.");
    } catch (err) {
      setResendStatus(toApiError(err).message);
    } finally {
      setIsResending(false);
    }
  }


  const evaluateState = useCallback(async (signal?: AbortSignal) => {
    if (!token || token.length < 16) {
      setViewState({ type: "INVALID", message: "El token de invitación no es válido." });
      return;
    }

    // 1. Obtener datos de la invitación
    let invitation: PublicInvitationDTO;
    try {
      invitation = await getPublicInvitation(token, signal);
    } catch (error) {
      if (signal?.aborted) return;
      const apiErr = toApiError(error);
      if (apiErr.code === "INVALID_INVITATION") {
        const msg = apiErr.message.toLowerCase();
        if (msg.includes("expiró") || msg.includes("expirada") || msg.includes("vencida")) {
          setViewState({ type: "EXPIRED" });
        } else if (msg.includes("revocada") || msg.includes("cancelada")) {
          setViewState({ type: "REVOKED" });
        } else {
          setViewState({ type: "INVALID", message: apiErr.message });
        }
      } else {
        setViewState({ type: "ERROR", message: apiErr.message || "Error al consultar la invitación." });
      }
      return;
    }

    // 2. Obtener sesión actual (si existe)
    let snapshot: AccessSnapshot | null = null;
    try {
      snapshot = await getSnapshot(signal);
    } catch {
      snapshot = null;
    }

    if (signal?.aborted) return;

    // Sin sesión activa
    if (!snapshot || !snapshot.user) {
      setViewState({ type: "VALID_NO_AUTH", invitation });
      return;
    }

    // Con sesión activa: verificar si el correo está verificado
    if (!snapshot.user.emailVerifiedAt) {
      setViewState({ type: "UNVERIFIED", invitation, snapshot });
      return;
    }

    // Con sesión activa: verificar coincidencia de correo
    if (snapshot.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      setViewState({ type: "VALID_MISMATCH", invitation, snapshot });
      return;
    }

    // Con sesión activa: verificar si ya es miembro
    const alreadyMember = snapshot.memberships.some(
      (m) => m.organization.slug === invitation.organizationSlug || m.organization.name === invitation.organizationName
    );
    if (alreadyMember) {
      setViewState({ type: "USED", invitation });
      return;
    }

    // Válido para aceptar
    setViewState({ type: "VALID_MATCH", invitation, snapshot });
  }, [token]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (active) evaluateState(controller.signal);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [evaluateState]);

  async function handleAccept() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await acceptInvitation(token);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("nuari_invite_return");
      }
      setViewState({
        type: "SUCCESS",
        organizationName: result.organization.name,
      });
    } catch (error) {
      const apiErr = toApiError(error);
      if (apiErr.code === "EMAIL_MISMATCH") {
        if (viewState.type === "VALID_MATCH" || viewState.type === "VALID_MISMATCH") {
          setViewState({
            type: "VALID_MISMATCH",
            invitation: viewState.invitation,
            snapshot: (viewState as { snapshot: AccessSnapshot }).snapshot,
          });
        }
      } else if (apiErr.code === "EMAIL_UNVERIFIED") {
        if ("invitation" in viewState && "snapshot" in viewState) {
          setViewState({
            type: "UNVERIFIED",
            invitation: viewState.invitation,
            snapshot: viewState.snapshot,
          });
        }
      } else if (apiErr.code === "INVALID_INVITATION") {
        setViewState({ type: "INVALID", message: apiErr.message });
      } else {
        setViewState({ type: "ERROR", message: apiErr.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    try {
      await logout();
    } catch {
      // Ignorar error de deslogueo
    }
    const returnUrl = `/invitacion/${encodeURIComponent(token)}`;
    router.push(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
  }

  // Render variables según estado
  const currentReturnUrl = `/invitacion/${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#182026] flex flex-col items-center justify-center relative px-4 py-12 overflow-x-hidden selection:bg-[#DDF6E8] selection:text-[#182026]">
      {/* Decorative Mesh Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#F8FAF9]" aria-hidden="true">
        {/* Lavanda suave (arriba izquierda) */}
        <div className="absolute rounded-full filter blur-[100px] opacity-40 bg-[#A997E8] w-[400px] h-[400px] -top-[100px] -left-[100px]" />
        {/* Menta (centro derecha) */}
        <div className="absolute rounded-full filter blur-[100px] bg-[#7ED6A5] w-[500px] h-[500px] top-[20%] -right-[150px] opacity-30" />
        {/* Azul suave (abajo izquierda) */}
        <div className="absolute rounded-full filter blur-[100px] bg-[#7EA8F8] w-[450px] h-[450px] -bottom-[100px] left-[10%] opacity-20" />
      </div>

      {/* Main Container */}
      <main className="w-full max-w-md relative z-10">
        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="font-bold text-3xl tracking-tight text-[#182026] hover:opacity-80 transition-opacity">
            nuari<span className="text-[#7ED6A5]">.</span>
          </Link>
        </div>

        {/* Invitation Card */}
        <div className="bg-white border border-[#E4E9E7] rounded-[2rem] shadow-xl p-6 sm:p-10 text-center relative overflow-hidden transition-all duration-300">
          <div className="flex flex-col items-center">
            {/* Estado: CARGANDO */}
            {viewState.type === "LOADING" ? (
              <div className="py-12 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#182026]/10 border-t-[#182026] animate-spin mb-4" />
                <p className="text-sm font-semibold text-[#182026]">Consultando invitación...</p>
                <p className="text-xs text-[#667078] mt-1">Conectando de forma segura con Nuari.</p>
              </div>
            ) : null}

            {/* Estado: VÁLIDA - USUARIO COINCIDE */}
            {viewState.type === "VALID_MATCH" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#F0ECFF] border-[#A997E8]/20 text-[#7564AF]">
                  <EnvelopeOpen size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Te invitaron a formar parte de un equipo
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  Estás a un paso de comenzar a trabajar con tu organización en Nuari.
                </p>

                <OrgDetailsCard invitation={viewState.invitation} />

                <div className="w-full flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? "Aceptando..." : "Aceptar invitación"}</span>
                  </button>
                  <Link
                    href="/app"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Ahora no</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: VÁLIDA - SIN SESIÓN */}
            {viewState.type === "VALID_NO_AUTH" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#F0ECFF] border-[#A997E8]/20 text-[#7564AF]">
                  <EnvelopeOpen size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Te invitaron a formar parte de un equipo
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  Para aceptar esta invitación, primero tenés que iniciar sesión o crear una cuenta nueva con el correo invitado.
                </p>

                <OrgDetailsCard invitation={viewState.invitation} />

                <div className="w-full flex flex-col gap-3">
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(currentReturnUrl)}`}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5"
                  >
                    <span>Iniciar sesión</span>
                  </Link>
                  <Link
                    href={`/register?returnTo=${encodeURIComponent(currentReturnUrl)}`}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Crear una cuenta</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: VÁLIDA - OTRO CORREO (MISMATCH) */}
            {viewState.type === "VALID_MISMATCH" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#F0ECFF] border-[#A997E8]/20 text-[#7564AF]">
                  <EnvelopeOpen size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Te invitaron a formar parte de un equipo
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  La invitación es válida, pero estás usando una cuenta diferente a la destinataria.
                </p>

                <OrgDetailsCard invitation={viewState.invitation} />

                {/* Contextual Alert */}
                <div className="w-full p-4 mb-8 rounded-xl flex items-start gap-3 bg-orange-50 border border-orange-200 text-orange-900 text-left">
                  <WarningCircle size={20} className="text-orange-500 shrink-0 mt-0.5" weight="fill" />
                  <div>
                    <p className="text-xs font-bold mb-1">Cuenta incorrecta</p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      Iniciaste sesión como <strong>{viewState.snapshot.user.email}</strong>, pero la invitación fue enviada a <strong>{viewState.invitation.email}</strong>.
                    </p>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5"
                  >
                    <ArrowsLeftRight size={18} />
                    <span>Cambiar de cuenta</span>
                  </button>
                  <Link
                    href="/app"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Volver a mi espacio de trabajo</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: CORREO NO VERIFICADO */}
            {viewState.type === "UNVERIFIED" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#E8F0FF] border-[#7EA8F8]/20 text-[#3D69C4]">
                  <ShieldWarning size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Verificá tu correo
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  Por seguridad, necesitás confirmar tu dirección de correo electrónico antes de unirte a un equipo.
                </p>

                <OrgDetailsCard invitation={viewState.invitation} />

                {resendStatus ? (
                  <p role="status" aria-live="polite" className="w-full mb-4 text-xs font-medium text-[#536068] bg-[#F8FAF9] border border-[#E4E9E7] rounded-xl p-3 text-center">
                    {resendStatus}
                  </p>
                ) : null}

                <div className="w-full flex flex-col gap-3">
                  <Link
                    href={`/verify-email?returnTo=${encodeURIComponent(currentReturnUrl)}`}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5"
                  >
                    <PaperPlaneTilt size={18} />
                    <span>Verificar correo</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all disabled:opacity-50"
                  >
                    <ArrowsClockwise size={18} className={isResending ? "animate-spin" : ""} />
                    <span>{isResending ? "Reenviando correo…" : "Reenviar correo de verificación"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (isRefreshing) return;
                      setIsRefreshing(true);
                      try { await evaluateState(); } finally { setIsRefreshing(false); }
                    }}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-medium text-[#667078] hover:text-[#182026] transition-colors disabled:opacity-50"
                  >
                    <span>{isRefreshing ? "Actualizando…" : "Ya verifiqué mi correo (actualizar)"}</span>
                  </button>

                  <Link
                    href="/app"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-[#667078] hover:text-[#182026] transition-colors"
                  >
                    <span>Más tarde</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: VENCIDA */}
            {viewState.type === "EXPIRED" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-orange-50 border-orange-200 text-orange-500">
                  <Clock size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  La invitación expiró
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  El enlace de acceso tenía una validez de 7 días y ya no puede utilizarse. Solicitá al administrador que te reenvíe una nueva invitación.
                </p>
                <div className="w-full flex flex-col gap-3">
                  <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Volver al inicio</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: REVOCADA */}
            {viewState.type === "REVOKED" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-red-50 border-red-200 text-red-500">
                  <Prohibit size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Invitación revocada
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  El administrador de la organización canceló esta invitación.
                </p>
                <div className="w-full flex flex-col gap-3">
                  <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Volver al inicio</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: YA UTILIZADA */}
            {viewState.type === "USED" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#DDF6E8] border-[#7ED6A5]/20 text-[#2B6E4A]">
                  <CheckCircle size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Invitación ya utilizada
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  Ya aceptaste esta invitación y formás parte de la organización.
                </p>
                <div className="w-full flex flex-col gap-3">
                  <Link
                    href="/app"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5"
                  >
                    <span>Ir a mi espacio de trabajo</span>
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: INVÁLIDA */}
            {viewState.type === "INVALID" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-[#F8FAF9] border-[#E4E9E7] text-[#667078]">
                  <Warning size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Enlace inválido
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  {viewState.message || "El enlace que seguiste no es válido o está incompleto. Verificá haberlo copiado correctamente."}
                </p>
                <div className="w-full flex flex-col gap-3">
                  <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Volver al inicio</span>
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: ACEPTACIÓN EXITOSA */}
            {viewState.type === "SUCCESS" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-[#DDF6E8] flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-[#7ED6A5] rounded-full animate-ping opacity-25" />
                  <CheckCircle size={36} className="text-[#2B6E4A] relative z-10" weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  ¡Te uniste al equipo!
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  Ya podés acceder a <strong>{viewState.organizationName}</strong> y comenzar a operar en Nuari.
                </p>
                <div className="w-full flex flex-col gap-3">
                  <Link
                    href="/app"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5"
                  >
                    <span>Ingresar a Nuari</span>
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </>
            ) : null}

            {/* Estado: ERROR */}
            {viewState.type === "ERROR" ? (
              <>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm border bg-red-50 border-red-200 text-red-500">
                  <WarningCircle size={32} weight="fill" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[#182026] mb-2">
                  Ocurrió un error
                </h1>
                <p className="text-sm text-[#667078] mb-8 max-w-sm mx-auto leading-relaxed">
                  {viewState.message || "No pudimos procesar la invitación en este momento. Por favor, intentá nuevamente en unos minutos."}
                </p>
                <div className="w-full flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => evaluateState()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-[#182026] rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)]"
                  >
                    <ArrowsClockwise size={18} />
                    <span>Intentar nuevamente</span>
                  </button>
                  <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-all"
                  >
                    <span>Volver al inicio</span>
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-[#667078] hover:text-[#182026] transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Volver al inicio</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

function OrgDetailsCard({ invitation }: { invitation: PublicInvitationDTO }) {
  const initial = invitation.organizationName ? invitation.organizationName[0].toUpperCase() : "N";
  const formattedExpires = new Date(invitation.expiresAt).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const roleLabel = ROLE_LABELS[invitation.role] || invitation.role;

  return (
    <div className="w-full bg-[#F8FAF9] border border-[#E4E9E7] rounded-xl p-4 mb-8 text-left shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#182026] text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[#182026] truncate">{invitation.organizationName}</h3>
          <p className="text-xs text-[#667078] mt-0.5 truncate flex items-center gap-1.5">
            <EnvelopeSimple size={14} />
            <span>Invitación para <strong className="font-semibold text-[#182026]">{invitation.email}</strong></span>
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#DDF6E8] border border-[#7ED6A5]/20 text-[#2B6E4A] text-xs font-semibold">
              <IdentificationCard size={14} weight="fill" />
              <span>Rol: {roleLabel}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-[#E4E9E7]/60 text-[11px] text-[#667078] flex justify-between">
        <span>Vence el {formattedExpires}</span>
      </div>
    </div>
  );
}
