"use client";

import { EnvelopeSimple } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { UserMinus } from "@phosphor-icons/react/dist/csr/UserMinus";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
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
import type {
  InvitationDTO,
  MemberDetailDTO,
  OrganizationRole,
} from "@/lib/api/contracts";
import { toApiError } from "@/lib/api/errors";

const ROLE_METADATA: Record<
  OrganizationRole,
  { label: string; badgeClass: string }
> = {
  OWNER: {
    label: "Propietario",
    badgeClass: "text-[#7564AF] bg-[#F0ECFF] border-[#A997E8]/30",
  },
  ADMIN: {
    label: "Administrador",
    badgeClass: "text-[#3D69C4] bg-[#E8F0FF] border-[#7EA8F8]/30",
  },
  EMPLOYEE: {
    label: "Empleado",
    badgeClass: "text-[#2B6E4A] bg-[#DDF6E8] border-[#7ED6A5]/30",
  },
};

type Toast = {
  id: string;
  message: string;
  type: "success" | "error";
};

export function MembersScreen() {
  const { snapshot } = useAccess();
  const activeOrgId = snapshot?.activeOrganizationId;
  const currentUserId = snapshot?.user.id;

  const currentMembership = snapshot?.memberships.find(
    (m) => m.organization.id === activeOrgId,
  );
  const currentUserRole: OrganizationRole | undefined = currentMembership?.role;

  // Data State
  const [members, setMembers] = useState<MemberDetailDTO[]>([]);
  const [invitations, setInvitations] = useState<InvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | OrganizationRole>("ALL");

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("EMPLOYEE");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const [managingMember, setManagingMember] = useState<MemberDetailDTO | null>(
    null,
  );
  const [newSelectedRole, setNewSelectedRole] =
    useState<OrganizationRole>("EMPLOYEE");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [memberToRevoke, setMemberToRevoke] = useState<MemberDetailDTO | null>(
    null,
  );
  const [isRevokingMember, setIsRevokingMember] = useState(false);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const [now, setNow] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setNow(Date.now());
    });
  }, []);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!activeOrgId) return;
      try {
        const [loadedMembers, loadedInvitations] = await Promise.all([
          getMembers(activeOrgId, signal),
          getInvitations(activeOrgId, signal),
        ]);
        setMembers(loadedMembers);
        setInvitations(loadedInvitations);
      } catch (err) {
        if (!signal?.aborted) {
          showToast(toApiError(err).message, "error");
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [activeOrgId, showToast],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (active) fetchData(controller.signal);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [fetchData]);

  // Permissions helpers
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const canManageMember = useCallback(
    (member: MemberDetailDTO) => {
      if (!currentUserRole) return false;
      if (currentUserRole === "OWNER") return true;
      if (currentUserRole === "ADMIN" && member.role === "EMPLOYEE") return true;
      return false;
    },
    [currentUserRole],
  );

  const canManageInvitation = useCallback(
    (invitation: InvitationDTO) => {
      if (!currentUserRole) return false;
      if (currentUserRole === "OWNER") return true;
      if (currentUserRole === "ADMIN" && invitation.role === "EMPLOYEE")
        return true;
      return false;
    },
    [currentUserRole],
  );

  // Filtered members
  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Pending / non-accepted invitations
  const pendingInvitations = useMemo(() => {
    return invitations.filter((inv) => !inv.acceptedAt);
  }, [invitations]);

  // Handlers
  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    if (!activeOrgId || !inviteEmail.trim()) return;

    const email = inviteEmail.trim().toLowerCase();
    const alreadyMember = members.some((m) => m.email.toLowerCase() === email);
    if (alreadyMember) {
      showToast("Este usuario ya es miembro de la organización.", "error");
      return;
    }

    const hasActiveInvite = invitations.some(
      (inv) =>
        inv.email.toLowerCase() === email &&
        !inv.acceptedAt &&
        !inv.revokedAt &&
        new Date(inv.expiresAt).getTime() > Date.now(),
    );
    if (hasActiveInvite) {
      showToast(
        "Ya existe una invitación activa enviada a este correo.",
        "error",
      );
      return;
    }

    setIsSubmittingInvite(true);
    try {
      await createInvitation(activeOrgId, {
        email,
        role: inviteRole,
      });
      showToast("Invitación enviada correctamente por correo electrónico.");
      setShowInviteModal(false);
      setInviteEmail("");
      await fetchData();
    } catch (err) {
      showToast(toApiError(err).message, "error");
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  function openManageModal(member: MemberDetailDTO) {
    setManagingMember(member);
    setNewSelectedRole(member.role);
  }

  async function handleUpdateRole() {
    if (!activeOrgId || !managingMember) return;
    if (managingMember.role === newSelectedRole) {
      setManagingMember(null);
      return;
    }

    setIsUpdatingRole(true);
    try {
      await updateMemberRole(
        activeOrgId,
        managingMember.id,
        newSelectedRole,
      );
      showToast(
        `Rol actualizado a ${ROLE_METADATA[newSelectedRole].label} correctamente.`,
      );
      setManagingMember(null);
      await fetchData();
    } catch (err) {
      showToast(toApiError(err).message, "error");
    } finally {
      setIsUpdatingRole(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!activeOrgId || !memberToRevoke) return;
    setIsRevokingMember(true);
    try {
      await removeMember(activeOrgId, memberToRevoke.id);
      showToast("Acceso revocado correctamente.");
      setMemberToRevoke(null);
      setManagingMember(null);
      await fetchData();
    } catch (err) {
      showToast(toApiError(err).message, "error");
    } finally {
      setIsRevokingMember(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!activeOrgId) return;
    try {
      await revokeInvitation(activeOrgId, invitationId);
      showToast("Invitación revocada correctamente.");
      await fetchData();
    } catch (err) {
      showToast(toApiError(err).message, "error");
    }
  }

  // Last owner check
  const ownerCount = useMemo(
    () => members.filter((m) => m.role === "OWNER").length,
    [members],
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-32">
      {/* Toast container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
              t.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-emerald-50 text-emerald-900 border-emerald-200"
            }`}
          >
            {t.type === "error" ? (
              <WarningCircle size={18} className="text-red-500 shrink-0" />
            ) : (
              <PaperPlaneTilt size={18} className="text-emerald-600 shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F0FF] border border-[#7EA8F8]/20 text-[#182026] text-xs font-semibold tracking-wide mb-4 shadow-sm">
            <Users size={14} className="text-[#3D69C4]" weight="fill" />
            <span>Gestión de sistema</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#182026] mb-2">
            Miembros y accesos
          </h1>
          <p className="text-[#667078] text-base">
            Administrá quién puede acceder a tu organización y qué permisos tiene.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setInviteEmail("");
            setInviteRole("EMPLOYEE");
            setShowInviteModal(true);
          }}
          disabled={!canInvite}
          title={!canInvite ? "No tenés permisos para invitar miembros." : ""}
          className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-[#182026] border border-transparent rounded-xl px-6 py-3 hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Plus size={18} weight="bold" />
          <span>Invitar miembro</span>
        </button>
      </header>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-xs">
          <MagnifyingGlass
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667078]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full bg-[#F8FAF9]/50 border border-[#E4E9E7] rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-[#182026] placeholder-[#667078]/50 focus:bg-white focus:outline-none focus:border-[#182026] focus:ring-2 focus:ring-[#182026]/10 transition-all"
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as "ALL" | OrganizationRole)
            }
            className="w-full bg-[#F8FAF9]/50 border border-[#E4E9E7] rounded-xl px-4 py-2.5 text-sm font-medium text-[#182026] focus:bg-white focus:outline-none focus:border-[#182026] focus:ring-2 focus:ring-[#182026]/10 transition-all"
          >
            <option value="ALL">Todos los roles</option>
            <option value="OWNER">Propietarios</option>
            <option value="ADMIN">Administradores</option>
            <option value="EMPLOYEE">Empleados</option>
          </select>
        </div>
      </div>

      {/* Active Members Table Card */}
      <div className="bg-white border border-[#E4E9E7] rounded-[1.5rem] shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-[#E4E9E7] bg-[#F8FAF9]/30 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#182026]">
            Miembros activos{" "}
            <span className="text-[#667078] font-normal ml-1">
              ({filteredMembers.length})
            </span>
          </h2>
          {loading ? (
            <span className="text-xs text-[#667078] animate-pulse">
              Cargando miembros...
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-[#F8FAF9]/50 text-xs text-[#667078] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E9E7]/60 text-sm">
              {filteredMembers.map((m) => {
                const roleMeta = ROLE_METADATA[m.role];
                const canManage = canManageMember(m);
                const isSelf = m.userId === currentUserId;
                const initials = m.name
                  ? m.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U";

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-[#F8FAF9]/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#182026] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-[#E4E9E7]">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#182026] flex items-center gap-1.5">
                            <span className="truncate">{m.name}</span>
                            {isSelf ? (
                              <span className="text-[#667078] font-normal text-xs">
                                (Tú)
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[#667078] truncate">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${roleMeta.badgeClass}`}
                      >
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#182026]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7ED6A5]" />
                        Activo
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => openManageModal(m)}
                          className="text-sm font-semibold text-[#182026] bg-[#F8FAF9] border border-[#E4E9E7] hover:bg-[#E4E9E7]/50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Gestionar
                        </button>
                      ) : (
                        <span className="text-xs text-[#667078] italic">
                          Solo lectura
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 bg-[#F8FAF9] rounded-full flex items-center justify-center text-[#667078] mb-3 border border-[#E4E9E7]">
                <UsersThree size={22} />
              </div>
              <p className="text-sm font-semibold text-[#182026]">
                No se encontraron miembros
              </p>
              <p className="text-xs text-[#667078] mt-1">
                Ajustá los filtros o realizá otra búsqueda.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pending Invitations Table Card */}
      {pendingInvitations.length > 0 ? (
        <div className="bg-white border border-[#E4E9E7] rounded-[1.5rem] shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-[#E4E9E7] bg-gradient-to-r from-[#F0ECFF]/30 to-[#DDF6E8]/30">
            <h2 className="text-base font-bold text-[#182026] flex items-center gap-2">
              <EnvelopeSimple
                size={18}
                className="text-[#7564AF]"
                weight="fill"
              />
              <span>Invitaciones pendientes</span>
              <span className="text-[#667078] font-normal ml-1">
                ({pendingInvitations.length})
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-[#F8FAF9]/50 text-xs text-[#667078] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Correo electrónico</th>
                  <th className="px-6 py-4">Rol asignado</th>
                  <th className="px-6 py-4">Estado / Vencimiento</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E9E7]/60 text-sm">
                {pendingInvitations.map((inv) => {
                  const roleMeta = ROLE_METADATA[inv.role];
                  const isRevoked = !!inv.revokedAt;
                  const isExpired =
                    !isRevoked && now > 0 && new Date(inv.expiresAt).getTime() < now;
                  const canManage = canManageInvitation(inv);

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border text-[#182026] bg-[#F8FAF9] border-[#E4E9E7]">
                      Pendiente
                    </span>
                  );
                  if (isRevoked) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border text-red-700 bg-red-50 border-red-200">
                        Cancelada
                      </span>
                    );
                  } else if (isExpired) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border text-orange-700 bg-orange-50 border-orange-200">
                        Vencida
                      </span>
                    );
                  }

                  const formattedDate = new Date(inv.createdAt).toLocaleDateString(
                    "es-AR",
                    { day: "2-digit", month: "short", year: "numeric" },
                  );
                  const formattedExpires = new Date(
                    inv.expiresAt,
                  ).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-[#F8FAF9]/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-[#182026]">
                        <div>{inv.email}</div>
                        <div className="text-[11px] text-[#667078] font-normal mt-0.5">
                          Enviada: {formattedDate}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {statusBadge}
                        {!isRevoked ? (
                          <span className="text-xs text-[#667078] block mt-0.5">
                            Vence: {formattedExpires}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canManage && !isRevoked ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="inline-flex items-center gap-1.5 p-2 text-[#667078] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-semibold"
                            title="Revocar invitación"
                          >
                            <XCircle size={18} />
                            <span>Revocar</span>
                          </button>
                        ) : (
                          <span className="text-xs text-[#667078] italic">
                            Sin acciones
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Modal: Invite Member */}
      {showInviteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#182026]/60 backdrop-blur-sm"
            onClick={() => setShowInviteModal(false)}
          />
          <div className="relative bg-white border border-[#E4E9E7] shadow-xl rounded-[1.5rem] w-full max-w-md overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#DDF6E8] text-[#2B6E4A] border border-[#7ED6A5]/20 flex items-center justify-center mb-5 shadow-sm">
                <PaperPlaneTilt size={22} weight="bold" />
              </div>
              <h3 className="text-xl font-bold text-[#182026] mb-1">
                Invitar miembro
              </h3>
              <p className="text-sm text-[#667078] mb-6">
                Enviaremos un correo electrónico con un enlace seguro para unirse a
                tu organización. Expira en 7 días.
              </p>

              <form onSubmit={handleSendInvite} className="space-y-5">
                <div>
                  <label
                    htmlFor="invite-email-input"
                    className="block text-sm font-bold text-[#182026] mb-2"
                  >
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <EnvelopeSimple
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667078]"
                    />
                    <input
                      id="invite-email-input"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      required
                      className="w-full bg-[#F8FAF9]/50 border border-[#E4E9E7] rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium text-[#182026] focus:bg-white focus:outline-none focus:border-[#182026] focus:ring-2 focus:ring-[#182026]/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="invite-role-select"
                    className="block text-sm font-bold text-[#182026] mb-2"
                  >
                    Rol a asignar
                  </label>
                  <select
                    id="invite-role-select"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as OrganizationRole)
                    }
                    className="w-full bg-[#F8FAF9]/50 border border-[#E4E9E7] rounded-xl px-4 py-2.5 text-sm font-medium text-[#182026] focus:bg-white focus:outline-none focus:border-[#182026] focus:ring-2 focus:ring-[#182026]/10 transition-all"
                  >
                    {currentUserRole === "OWNER" ? (
                      <option value="ADMIN">
                        Administrador (Gestión operativa y de empleados)
                      </option>
                    ) : null}
                    <option value="EMPLOYEE">
                      Empleado (Gestión de agenda y ventas)
                    </option>
                  </select>
                  <p className="text-[11px] text-[#667078] mt-2 font-medium">
                    Los propietarios adicionales solo pueden asignarse mediante
                    gestión directa de miembros activos.
                  </p>
                </div>

                <div className="bg-[#F8FAF9]/50 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-5 border-t border-[#E4E9E7] flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-colors shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#182026] border border-transparent rounded-xl hover:bg-[#2A3742] transition-all shadow-[0_4px_14px_0_rgba(24,32,38,0.15)] disabled:opacity-50"
                  >
                    <span>
                      {isSubmittingInvite ? "Enviando..." : "Enviar invitación"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Manage Access (Change Role / Revoke) */}
      {managingMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#182026]/60 backdrop-blur-sm"
            onClick={() => setManagingMember(null)}
          />
          <div className="relative bg-white border border-[#E4E9E7] shadow-xl rounded-[1.5rem] w-full max-w-md overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-[#182026] text-white flex items-center justify-center font-bold text-base shadow-sm border-2 border-[#F8FAF9]">
                  {managingMember.name
                    ? managingMember.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "U"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[#182026] truncate">
                    {managingMember.name}
                  </h3>
                  <p className="text-sm text-[#667078] truncate">
                    {managingMember.email}
                  </p>
                </div>
              </div>

              {managingMember.role === "OWNER" && ownerCount <= 1 ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-xs text-orange-800 font-medium flex items-start gap-2">
                    <WarningCircle
                      size={18}
                      className="text-orange-600 shrink-0 mt-0.5"
                    />
                    <span>
                      No podés modificar ni revocar al único propietario de la
                      organización. Para transferir la propiedad, asigná
                      previamente el rol Propietario a otro miembro.
                    </span>
                  </p>
                </div>
              ) : managingMember.userId === currentUserId ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-900 font-medium flex items-start gap-2">
                    <WarningCircle
                      size={18}
                      className="text-blue-600 shrink-0 mt-0.5"
                    />
                    <span>
                      Estás gestionando tu propia cuenta. No podés modificar tu
                      propio rol ni revocar tu propia membresía desde este panel.
                    </span>
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Change Role */}
                  <div>
                    <label
                      htmlFor="manage-role-select"
                      className="block text-sm font-bold text-[#182026] mb-2"
                    >
                      Rol en la organización
                    </label>
                    <select
                      id="manage-role-select"
                      value={newSelectedRole}
                      onChange={(e) =>
                        setNewSelectedRole(e.target.value as OrganizationRole)
                      }
                      className="w-full bg-[#F8FAF9]/50 border border-[#E4E9E7] rounded-xl px-4 py-2.5 text-sm font-medium text-[#182026] mb-3 focus:bg-white focus:outline-none focus:border-[#182026] focus:ring-2 focus:ring-[#182026]/10 transition-all"
                    >
                      {currentUserRole === "OWNER" ? (
                        <>
                          <option value="OWNER">Propietario</option>
                          <option value="ADMIN">Administrador</option>
                        </>
                      ) : null}
                      <option value="EMPLOYEE">Empleado</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleUpdateRole}
                      disabled={
                        isUpdatingRole || newSelectedRole === managingMember.role
                      }
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-[#182026] bg-[#F8FAF9] border border-[#E4E9E7] rounded-xl hover:bg-[#E4E9E7]/50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isUpdatingRole ? "Actualizando..." : "Guardar nuevo rol"}
                    </button>
                  </div>

                  <hr className="border-[#E4E9E7]" />

                  {/* Revoke Access */}
                  <div>
                    <h4 className="text-sm font-bold text-red-600 mb-1">
                      Revocar acceso
                    </h4>
                    <p className="text-xs text-[#667078] mb-3">
                      El usuario perderá el acceso a la plataforma de forma
                      inmediata. Sus registros y auditoría se mantendrán.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMemberToRevoke(managingMember)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <UserMinus size={18} />
                      <span>Revocar acceso</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#F8FAF9]/50 px-6 sm:px-8 py-4 border-t border-[#E4E9E7] flex justify-end">
              <button
                type="button"
                onClick={() => setManagingMember(null)}
                className="px-5 py-2 text-sm font-semibold text-[#182026] hover:text-[#667078] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm Revoke */}
      {memberToRevoke ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#182026]/60 backdrop-blur-sm"
            onClick={() => setMemberToRevoke(null)}
          />
          <div className="relative bg-white border border-[#E4E9E7] shadow-2xl rounded-[1.5rem] w-full max-w-sm overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mb-4 shadow-sm">
                <WarningCircle size={22} weight="bold" />
              </div>
              <h3 className="text-lg font-bold text-[#182026] mb-2">
                ¿Confirmás la revocación?
              </h3>
              <p className="text-sm text-[#667078] mb-4">
                {memberToRevoke.name} perderá el acceso a la organización
                inmediatamente, pero conservará su historial de actividad en el
                sistema.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setMemberToRevoke(null)}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-[#182026] bg-white border border-[#E4E9E7] rounded-xl hover:bg-[#F8FAF9] transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  disabled={isRevokingMember}
                  className="w-full px-4 py-2.5 text-sm font-bold text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isRevokingMember ? "Revocando..." : "Sí, revocar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
