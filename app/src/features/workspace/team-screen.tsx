"use client";

import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { UserMinus } from "@phosphor-icons/react/dist/csr/UserMinus";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { XCircle } from "@phosphor-icons/react/dist/csr/XCircle";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAccess } from "@/features/access/access-provider";
import {
  createInvitation,
  getInvitations,
  getMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from "@/lib/api/browser";
import type { InvitationDTO, MemberDetailDTO, OrganizationRole } from "@/lib/api/contracts";
import { toApiError } from "@/lib/api/errors";
import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";

const roleMeta: Record<OrganizationRole, { label: string; badge: string }> = {
  OWNER: { label: "Propietario", badge: "bg-[#F0ECFF] text-[#7564AF]" },
  ADMIN: { label: "Administrador", badge: "bg-[#E8F0FF] text-[#3D69C4]" },
  EMPLOYEE: { label: "Empleado", badge: "bg-[#DDF6E8] text-[#2B6E4A]" },
};

export function TeamScreen() {
  const { snapshot } = useAccess();
  const activeOrgId = snapshot?.activeOrganizationId;
  const currentUserId = snapshot?.user.id;
  const currentUserRole = snapshot?.memberships.find((membership) => membership.organization.id === activeOrgId)?.role;
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const [members, setMembers] = useState<MemberDetailDTO[]>([]);
  const [invitations, setInvitations] = useState<InvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | OrganizationRole>("ALL");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("EMPLOYEE");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [managingMember, setManagingMember] = useState<MemberDetailDTO | null>(null);
  const [newRole, setNewRole] = useState<OrganizationRole>("EMPLOYEE");
  const [memberToRevoke, setMemberToRevoke] = useState<MemberDetailDTO | null>(null);
  const [now, setNow] = useState(0);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!activeOrgId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    try {
      const [loadedMembers, loadedInvitations] = await Promise.all([
        getMembers(activeOrgId, signal),
        getInvitations(activeOrgId, signal),
      ]);
      if (signal?.aborted) return;
      setMembers(loadedMembers);
      setInvitations(loadedInvitations);
      setLoadError(null);
    } catch (error) {
      if (!signal?.aborted) setLoadError(toApiError(error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (active) void fetchData(controller.signal);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchData]);

  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
  }, []);

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    return members.filter((member) => {
      const matchesRole = roleFilter === "ALL" || member.role === roleFilter;
      const matchesQuery = `${member.name} ${member.email}`.toLocaleLowerCase("es-AR").includes(normalizedQuery);
      return matchesRole && matchesQuery;
    });
  }, [members, query, roleFilter]);

  const pendingInvitations = useMemo(() => invitations.filter((invitation) => !invitation.acceptedAt), [invitations]);
  const ownerCount = useMemo(() => members.filter((member) => member.role === "OWNER").length, [members]);

  function canManageMember(member: MemberDetailDTO) {
    return currentUserRole === "OWNER" || (currentUserRole === "ADMIN" && member.role === "EMPLOYEE");
  }

  function canManageInvitation(invitation: InvitationDTO) {
    return currentUserRole === "OWNER" || (currentUserRole === "ADMIN" && invitation.role === "EMPLOYEE");
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrgId || !canInvite || busy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (members.some((member) => member.email.toLowerCase() === email)) {
      setNotice({ message: "Este usuario ya es miembro de la organización.", error: true });
      return;
    }
    const hasActiveInvite = invitations.some((invitation) => invitation.email.toLowerCase() === email && !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now());
    if (hasActiveInvite) {
      setNotice({ message: "Ya existe una invitación activa enviada a este correo.", error: true });
      return;
    }
    const allowedRole = currentUserRole === "OWNER" ? inviteRole : "EMPLOYEE";
    setBusy(true);
    setNotice(null);
    try {
      await createInvitation(activeOrgId, { email, role: allowedRole });
      setInviteEmail("");
      setInviteRole("EMPLOYEE");
      setNotice({ message: "Invitación enviada. La cuenta podrá unirse cuando acepte el correo." });
      await fetchData();
    } catch (error) {
      setNotice({ message: toApiError(error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateRole() {
    if (!activeOrgId || !managingMember || !canManageMember(managingMember) || busy) return;
    if (managingMember.userId === currentUserId || (managingMember.role === "OWNER" && ownerCount <= 1)) return;
    if (currentUserRole !== "OWNER" && newRole !== "EMPLOYEE") return;
    if (managingMember.role === newRole) {
      setManagingMember(null);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await updateMemberRole(activeOrgId, managingMember.id, newRole);
      setNotice({ message: `Rol actualizado a ${roleMeta[newRole].label}.` });
      setManagingMember(null);
      await fetchData();
    } catch (error) {
      setNotice({ message: toApiError(error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!activeOrgId || !memberToRevoke || !canManageMember(memberToRevoke) || busy) return;
    if (memberToRevoke.userId === currentUserId || (memberToRevoke.role === "OWNER" && ownerCount <= 1)) return;
    setBusy(true);
    setNotice(null);
    try {
      await removeMember(activeOrgId, memberToRevoke.id);
      setNotice({ message: "Acceso revocado correctamente." });
      setMemberToRevoke(null);
      setManagingMember(null);
      await fetchData();
    } catch (error) {
      setNotice({ message: toApiError(error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeInvitation(invitation: InvitationDTO) {
    if (!activeOrgId || !canManageInvitation(invitation) || invitation.revokedAt || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await revokeInvitation(activeOrgId, invitation.id);
      setNotice({ message: "Invitación revocada correctamente." });
      await fetchData();
    } catch (error) {
      setNotice({ message: toApiError(error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7 pb-12">
      <SectionIntro label="Gestión / Equipo" title="Un equipo conectado." description="Administrá las cuentas que pueden acceder a tu organización y sus permisos." icon={<UsersThree size={15} weight="duotone" />} tone="lavender" />
      {notice ? <p role={notice.error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.error ? "border-[#F1D6D0] bg-[#FFF6F3] text-[#A04439]" : "border-[#DDF6E8] bg-[#EFFBF4] text-[#35645D]"}`}>{notice.message}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <SectionCard title="Personas del equipo" detail={`${members.length} ${members.length === 1 ? "cuenta con acceso" : "cuentas con acceso"} a la organización`}>
          <div className="mb-5 flex flex-wrap gap-3">
            <div className="relative min-w-48 flex-1"><label htmlFor="team-search" className="sr-only">Buscar integrantes</label><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o correo" className={inputClass + " pl-10"} /></div>
            <label htmlFor="team-role-filter" className="sr-only">Filtrar por rol</label><select id="team-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "ALL" | OrganizationRole)} className={inputClass + " w-auto min-w-40"}><option value="ALL">Todos los roles</option><option value="OWNER">Propietarios</option><option value="ADMIN">Administradores</option><option value="EMPLOYEE">Empleados</option></select>
          </div>
          <CollectionState loading={loading} error={loadError} empty={visibleMembers.length === 0} onRetry={() => { setLoading(true); void fetchData(); }} />
          {!loading && !loadError && visibleMembers.length > 0 ? <ul className="space-y-2">{visibleMembers.map((member) => {
            const isSelf = member.userId === currentUserId;
            const canManage = canManageMember(member);
            return <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3 transition-colors hover:bg-[#F8FAF9]"><div className="flex min-w-0 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${roleMeta[member.role].badge}`}>{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{member.name}{isSelf ? <span className="ml-1.5 text-xs font-normal text-[#667078]">(Vos)</span> : null}</strong><span className="mt-0.5 block truncate text-xs text-[#667078]">{member.email}</span></span></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${roleMeta[member.role].badge}`}>{member.role === "OWNER" ? <ShieldCheck size={14} /> : <UsersThree size={14} />}{roleMeta[member.role].label}</span>{canManage ? <button type="button" onClick={() => { setManagingMember(member); setNewRole(member.role); }} className="rounded-lg border border-[#E4E9E7] bg-white px-3 py-1.5 text-xs font-semibold text-[#182026] transition-colors hover:bg-[#F8FAF9]">Gestionar</button> : <span className="text-xs text-[#667078]">Solo lectura</span>}</div></li>;
          })}</ul> : null}
        </SectionCard>

        <SectionCard id="nuevo-integrante" title="Nuevo integrante" detail="Invitá una cuenta a la organización. No se crea hasta que acepte el correo.">
          {canInvite ? <form onSubmit={handleInvite} className="space-y-4"><FormField label="Correo electrónico" htmlFor="team-email"><input id="team-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required maxLength={254} placeholder="nombre@correo.com" className={inputClass} /></FormField><FormField label="Rol de acceso" htmlFor="team-role"><select id="team-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as OrganizationRole)} className={inputClass}><option value="EMPLOYEE">Empleado (acceso a la organización)</option>{currentUserRole === "OWNER" ? <option value="ADMIN">Administrador</option> : null}</select></FormField><p className="text-xs leading-5 text-[#667078]">La invitación vence en 7 días. Los propietarios adicionales se asignan desde la gestión de miembros.</p><button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Enviando invitación…" : "Enviar invitación"}</button></form> : <p className="rounded-xl border border-dashed border-[#DDE5E2] bg-[#FAFCFB] px-4 py-6 text-sm leading-6 text-[#667078]">Tu rol permite consultar los miembros, pero no administrar accesos.</p>}
        </SectionCard>
      </div>

      <SectionCard title="Invitaciones pendientes" detail="Seguí el estado y vencimiento de los accesos enviados.">
        {loadError ? <p role="status" className="rounded-xl border border-dashed border-[#DDE5E2] bg-[#FAFCFB] px-4 py-6 text-center text-sm text-[#667078]">No se pudieron cargar las invitaciones.</p> : <CollectionState loading={loading} error={null} empty={pendingInvitations.length === 0} onRetry={() => { setLoading(true); void fetchData(); }} />}
        {!loading && !loadError && pendingInvitations.length > 0 ? <ul className="space-y-2">{pendingInvitations.map((invitation) => {
          const revoked = Boolean(invitation.revokedAt);
          const expired = !revoked && now > 0 && new Date(invitation.expiresAt).getTime() < now;
          const canRevoke = canManageInvitation(invitation) && !revoked;
          return <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F0ECFF] text-[#7564AF]"><EnvelopeSimple size={18} /></span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{invitation.email}</strong><span className="mt-0.5 block text-xs text-[#667078]">Enviada {new Date(invitation.createdAt).toLocaleDateString("es-AR")} · vence {new Date(invitation.expiresAt).toLocaleDateString("es-AR")}</span></span></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${roleMeta[invitation.role].badge}`}>{roleMeta[invitation.role].label}</span><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${revoked ? "bg-red-50 text-red-700" : expired ? "bg-orange-50 text-orange-700" : "bg-[#EFFBF4] text-[#35645D]"}`}>{revoked ? "Cancelada" : expired ? "Vencida" : "Pendiente"}</span>{canRevoke ? <button type="button" onClick={() => void handleRevokeInvitation(invitation)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#667078] transition-colors hover:bg-red-50 hover:text-red-600"><XCircle size={16} />Revocar</button> : null}</div></li>;
        })}</ul> : null}
      </SectionCard>

      {managingMember ? <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation"><button type="button" aria-label="Cerrar gestión" className="absolute inset-0 bg-[#182026]/60 backdrop-blur-sm" onClick={() => setManagingMember(null)} /><section role="dialog" aria-modal="true" aria-labelledby="manage-member-title" className="relative z-10 w-full max-w-md rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"><div className="mb-5 flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-full bg-[#F0ECFF] text-sm font-bold text-[#7564AF]">{managingMember.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="min-w-0"><h2 id="manage-member-title" className="truncate text-lg font-bold text-[#182026]">{managingMember.name}</h2><span className="block truncate text-sm text-[#667078]">{managingMember.email}</span></span></div>
        {managingMember.userId === currentUserId ? <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">No podés modificar tu propio rol ni revocar tu propia membresía.</p> : managingMember.role === "OWNER" && ownerCount <= 1 ? <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">No podés modificar ni revocar al único propietario de la organización.</p> : <div className="space-y-5"><div><FormField label="Rol en la organización" htmlFor="manage-role"><select id="manage-role" value={newRole} onChange={(event) => setNewRole(event.target.value as OrganizationRole)} className={inputClass}>{currentUserRole === "OWNER" ? <><option value="OWNER">Propietario</option><option value="ADMIN">Administrador</option></> : null}<option value="EMPLOYEE">Empleado</option></select></FormField>{currentUserRole === "OWNER" || managingMember.role === "EMPLOYEE" ? <button type="button" onClick={() => void handleUpdateRole()} disabled={busy || newRole === managingMember.role} className={actionClass + " mt-3 w-full"}>{busy ? "Actualizando…" : "Guardar nuevo rol"}</button> : null}</div><div className="border-t border-[#E4E9E7] pt-4"><h3 className="text-sm font-bold text-red-600">Revocar acceso</h3><p className="mb-3 mt-1 text-xs leading-5 text-[#667078]">La cuenta perderá acceso a esta organización y conservará su historial.</p><button type="button" onClick={() => setMemberToRevoke(managingMember)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"><UserMinus size={17} />Revocar acceso</button></div></div>}
        <div className="mt-6 flex justify-end border-t border-[#E4E9E7] pt-4"><button type="button" onClick={() => setManagingMember(null)} className="px-4 py-2 text-sm font-semibold text-[#182026] hover:text-[#667078]">Cerrar</button></div>
      </section></div> : null}

      {memberToRevoke ? <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation"><button type="button" aria-label="Cancelar revocación" className="absolute inset-0 bg-[#182026]/60 backdrop-blur-sm" onClick={() => setMemberToRevoke(null)} /><section role="alertdialog" aria-modal="true" aria-labelledby="revoke-member-title" className="relative z-10 w-full max-w-sm rounded-[1.5rem] border border-[#E4E9E7] bg-white p-6 shadow-2xl"><WarningCircle size={24} className="mb-3 text-red-600" /><h2 id="revoke-member-title" className="mb-2 text-lg font-bold text-[#182026]">¿Confirmás la revocación?</h2><p className="mb-5 text-sm leading-6 text-[#667078]">{memberToRevoke.name} perderá el acceso a la organización y conservará su historial.</p><div className="flex gap-3"><button type="button" onClick={() => setMemberToRevoke(null)} className="w-full rounded-xl border border-[#E4E9E7] px-4 py-2.5 text-sm font-semibold text-[#182026]">Cancelar</button><button type="button" onClick={() => void handleConfirmRevoke()} disabled={busy} className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Revocando…" : "Sí, revocar"}</button></div></section></div> : null}
    </div>
  );
}
