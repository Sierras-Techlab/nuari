import { AddressBook } from "@phosphor-icons/react/dist/ssr/AddressBook";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { CalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { UsersThree } from "@phosphor-icons/react/dist/ssr/UsersThree";
import { Wallet } from "@phosphor-icons/react/dist/ssr/Wallet";
import Link from "next/link";
import type { ReactNode } from "react";
import { guardPage } from "@/lib/auth/server";
import { AccessError } from "@/features/access/access-error";

const sections = [
  { href: "/app/agenda", title: "Agenda", description: "Consultá el día, registrá turnos y resolvé cambios.", icon: <CalendarDots size={22} />, tone: "mint" },
  { href: "/app/servicios", title: "Servicios", description: "Definí opciones y duraciones para tus citas.", icon: <SquaresFour size={22} />, tone: "blue" },
  { href: "/app/clientes", title: "Clientes", description: "Mantené a mano sus datos de contacto.", icon: <AddressBook size={22} />, tone: "lavender" },
  { href: "/app/caja", title: "Caja", description: "Registrá y consultá movimientos manuales.", icon: <Wallet size={22} />, tone: "amber" },
  { href: "/app/equipo", title: "Equipo", description: "Administrá las cuentas con acceso a tu organización.", icon: <UsersThree size={22} />, tone: "mint" },
] as const;

export default async function InternalHomePage() {
  const snapshot = await guardPage("app");
  if (!snapshot) return <AccessError />;
  if (!snapshot.access?.businessAllowed) return null;
  return (
    <div className="space-y-9 pb-12">
      <div className="relative overflow-hidden rounded-[28px] border border-[#E4E9E7] bg-white p-7 shadow-[0_20px_50px_-38px_rgba(24,32,38,.24)] sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-35" />
        <div aria-hidden="true" className="absolute -right-24 -top-32 size-80 rounded-full bg-[#DDF6E8]/55 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-36 right-24 size-64 rounded-full bg-[#F0ECFF]/70 blur-3xl" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#DDF6E8] bg-[#EFFBF4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.17em] text-[#35645D]"><CalendarDots size={15} weight="duotone" /> Módulo Turnero</p>
          <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-[-0.045em] text-[#182026] sm:text-4xl">Un día ordenado empieza acá.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#667078]">Turnos, servicios, clientes, caja y equipo en un mismo espacio de trabajo.</p>
          <Link href="/app/agenda" className="mt-7 inline-flex h-11 items-center gap-3 rounded-xl bg-[#182026] px-5 text-sm font-bold text-white shadow-[0_8px_24px_-12px_rgba(24,32,38,.5)] transition-colors hover:bg-[#2A3742] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#438C78]">Abrir agenda <ArrowRight size={17} /></Link>
        </div>
      </div>

      <section aria-labelledby="workspace-sections-title">
        <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#438C78]">Tu espacio</p><h2 id="workspace-sections-title" className="mt-1 text-xl font-bold tracking-tight text-[#182026]">¿Qué querés gestionar?</h2></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((item) => <SectionLink key={item.href} {...item} />)}
        </div>
      </section>
    </div>
  );
}

function SectionLink({ href, title, description, icon, tone }: { href: string; title: string; description: string; icon: ReactNode; tone: "mint" | "blue" | "lavender" | "amber" }) {
  const toneClass = { mint: "bg-[#DDF6E8] text-[#438C78]", blue: "bg-[#E8F0FF] text-[#5D86D5]", lavender: "bg-[#F0ECFF] text-[#8E7BC9]", amber: "bg-[#FFF1E2] text-[#B87B46]" }[tone];
  return <Link href={href} className="group flex min-h-40 flex-col rounded-2xl border border-[#E4E9E7] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(24,32,38,.18)] transition-all hover:-translate-y-0.5 hover:border-[#BFD7CC] hover:shadow-[0_12px_30px_-20px_rgba(24,32,38,.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#438C78]"><div className="flex items-start justify-between"><span className={"flex size-11 items-center justify-center rounded-xl " + toneClass}>{icon}</span><ArrowRight size={17} className="text-[#9AA7A5] transition-transform group-hover:translate-x-1" /></div><h3 className="mt-5 text-sm font-bold text-[#182026]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#667078]">{description}</p></Link>;
}
