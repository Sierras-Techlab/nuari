import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { CalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { LockKey } from "@phosphor-icons/react/dist/ssr/LockKey";
import { Package } from "@phosphor-icons/react/dist/ssr/Package";
import { TrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import Link from "next/link";

export function AuthBrandPanel() {
  return (
    <aside className="relative hidden w-5/12 shrink-0 overflow-hidden bg-[#182026] p-6 text-white md:flex md:min-h-screen md:flex-col md:justify-between lg:p-12" aria-label="Información de Nuari">
      <div className="auth-grid-dark absolute inset-0 z-0" />
      <div className="absolute -left-40 -top-40 z-0 h-96 w-96 rounded-full bg-[#7EA8F8]/10 blur-[100px]" />
      <div className="absolute -right-40 top-1/2 z-0 h-96 w-96 rounded-full bg-[#7ED6A5]/10 blur-[100px]" />
      <div className="absolute -bottom-40 left-1/4 z-0 h-96 w-96 rounded-full bg-[#A997E8]/10 blur-[100px]" />

      <div className="relative z-10">
        <Link href="/" className="mb-16 inline-block text-3xl font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#182026]" aria-label="nuari, inicio">nuari</Link>
        <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">Todo tu negocio,<br />en un solo lugar.</h1>
        <p className="max-w-sm text-lg text-gray-300">Gestioná clientes, ventas, turnos, productos y más desde una sola plataforma.</p>
      </div>

      <div className="relative z-10 mt-12 h-64">
        <div className="absolute left-0 top-0 flex w-64 motion-safe:animate-auth-float-slow items-center gap-4 rounded-2xl border border-white/10 bg-[#2A3742] p-4 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] backdrop-blur-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DDF6E8] text-[#35645D]"><TrendUp aria-hidden="true" className="text-xl" /></div>
          <div>
            <div className="mb-0.5 text-xs font-medium text-gray-300">Ingresos del mes</div>
            <div className="flex items-end gap-2"><div className="text-lg font-bold text-white">$1.284.500</div><div className="flex items-center pb-1 text-[10px] font-bold text-[#7ED6A5]"><ArrowUpRight aria-hidden="true" /> 12%</div></div>
          </div>
        </div>

        <div className="absolute left-12 top-24 flex w-64 motion-safe:animate-auth-float-delayed items-center gap-4 rounded-2xl border border-white/10 bg-[#2A3742] p-4 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] backdrop-blur-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF1E2] text-[#8A5A16]"><CalendarCheck aria-hidden="true" className="text-xl" /></div>
          <div><div className="text-sm font-bold text-white">17:30 · Lucas M.</div><div className="mt-0.5 text-xs font-medium text-gray-300">Corte + barba</div></div>
        </div>

        <div className="absolute left-4 top-48 flex w-64 motion-safe:animate-auth-float-fast items-center gap-4 rounded-2xl border border-white/10 bg-[#2A3742] p-4 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] backdrop-blur-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F0FF] text-[#35645D]"><Package aria-hidden="true" className="text-xl" /></div>
          <div className="w-full"><div className="mb-1 flex items-center justify-between"><div className="text-sm font-bold text-white">Shampoo</div><div className="rounded-full border border-[#FFB86B]/30 bg-[#FFF1E2]/20 px-2 py-0.5 text-[10px] font-bold text-[#FFB86B]">Bajo</div></div><div className="text-xs font-medium text-gray-300">Quedan 2 unidades</div></div>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-2 text-xs font-medium text-gray-400"><LockKey aria-hidden="true" weight="fill" /> Acceso seguro a tu espacio de trabajo.</div>
    </aside>
  );
}
