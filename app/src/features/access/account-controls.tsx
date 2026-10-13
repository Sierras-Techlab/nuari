"use client";
import { useAccess } from "./access-provider";
export function AccountControls() {
  const { snapshot, select, signOut } = useAccess();
  if (!snapshot) return null;
  return <div className="flex flex-wrap items-center gap-3 text-xs text-[#536068]"><span>{snapshot.user.name}</span>{snapshot.memberships.length > 1 ? <select aria-label="Negocio activo" value={snapshot.activeOrganizationId ?? ""} onChange={(event) => void select(event.target.value)} className="max-w-40 rounded-lg border border-[#E4E9E7] bg-white px-2 py-2">{snapshot.memberships.map((member) => <option key={member.id} value={member.organization.id}>{member.organization.name}</option>)}</select> : null}<button type="button" onClick={() => void signOut()} className="min-h-11 font-semibold hover:underline">Cerrar sesión</button></div>;
}
