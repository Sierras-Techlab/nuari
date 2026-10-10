"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { useState } from "react";
import type { FormEvent } from "react";

import { CollectionState, FormField, SectionCard, SectionIntro, actionClass, inputClass } from "./section-ui";
import type { TeamMember, WorkspaceSource } from "./types";
import { useWorkspaceCollection } from "./workspace-provider";

const loadTeam = (source: WorkspaceSource) => source.listTeam();

export function TeamScreen() {
  const { source, items, loading, error, refresh } = useWorkspaceCollection<TeamMember>(loadTeam);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "professional">("professional");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = items.filter((item) => (roleFilter === "all" || item.role === roleFilter) && (item.name + " " + item.email).toLocaleLowerCase("es-AR").includes(query.toLocaleLowerCase("es-AR")));
  const professionals = items.filter((item) => item.role === "professional").length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFormError(null); setNotice(null);
    try {
      await source.createTeamMember({ name, email, role });
      setName(""); setEmail(""); setRole("professional"); setQuery(""); setRoleFilter("all");
      setNotice("Integrante agregado"); refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "No se pudo guardar el integrante.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-7 pb-12">
    <SectionIntro label="Gestión / Equipo" title="Un equipo conectado." description="Organizá a las personas que atienden citas y a quienes administran el espacio." icon={<UsersThree size={15} weight="duotone" />} tone="lavender" />
    {notice ? <p role="status" className="rounded-xl border border-[#DDF6E8] bg-[#EFFBF4] px-4 py-3 text-sm font-semibold text-[#35645D]">{notice}</p> : null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <SectionCard title="Personas del equipo" detail={`${professionals} ${professionals === 1 ? "profesional" : "profesionales"} disponibles para turnos`}>
        <div className="mb-5 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><label htmlFor="team-search" className="sr-only">Buscar integrantes</label><MagnifyingGlass size={17} aria-hidden="true" className="absolute left-3.5 top-3.5 text-[#9AA7A5]" /><input id="team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar integrantes" className={inputClass + " pl-10"} /></div><label htmlFor="team-role-filter" className="sr-only">Filtrar por función</label><select id="team-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass + " w-auto min-w-36"}><option value="all">Todas las funciones</option><option value="professional">Profesionales</option><option value="admin">Administración</option></select></div>
        <CollectionState loading={loading} error={error} empty={visible.length === 0} onRetry={refresh} />
        {!loading && !error && visible.length > 0 ? <ul className="space-y-2">{visible.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E9E7] bg-[#FAFCFB] px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className={"flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (item.role === "admin" ? "bg-[#F0ECFF] text-[#7564AF]" : "bg-[#DDF6E8] text-[#438C78]")}>{item.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="min-w-0"><strong className="block truncate text-sm text-[#182026]">{item.name}</strong><span className="mt-0.5 block truncate text-xs text-[#667078]">{item.email}</span></span></div><span className={"inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold " + (item.role === "admin" ? "bg-[#F0ECFF] text-[#7564AF]" : "bg-[#EFFBF4] text-[#438C78]")}>{item.role === "admin" ? <ShieldCheck size={14} /> : <UsersThree size={14} />}{item.role === "admin" ? "Administración" : "Profesional"}</span></li>)}</ul> : null}
      </SectionCard>
      <SectionCard id="nuevo-integrante" title="Nuevo integrante" detail="Sumá una persona a tu equipo."><form onSubmit={submit} className="space-y-4"><FormField label="Nombre" htmlFor="team-name"><input id="team-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nombre y apellido" className={inputClass} /></FormField><FormField label="Correo" htmlFor="team-email"><input id="team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="Correo de contacto" className={inputClass} /></FormField><FormField label="Función" htmlFor="team-role"><select id="team-role" value={role} onChange={(event) => setRole(event.target.value as "admin" | "professional")} className={inputClass}><option value="professional">Profesional</option><option value="admin">Administración</option></select></FormField>{formError ? <p role="alert" className="rounded-xl border border-[#F1D6D0] bg-[#FFF6F3] px-3 py-2 text-sm text-[#A04439]">{formError}</p> : null}<button type="submit" disabled={busy} className={actionClass + " w-full"}><Plus size={17} />{busy ? "Guardando..." : "Agregar integrante"}</button></form></SectionCard>
    </div>
  </div>;
}
