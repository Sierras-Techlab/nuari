import { CalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import type { ReactNode } from "react";

import { AppNavigation } from "./app-navigation";
import { MobileNavigation } from "./mobile-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#182026]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col overflow-y-auto bg-[#182026] px-5 py-6 text-white md:flex">
        <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-48 size-64 rounded-full bg-[#438C78]/10 blur-3xl" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-3 px-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-[#DDF6E8]"><SquaresFour size={22} weight="duotone" /></span>
            <div><p className="text-[23px] font-bold leading-none tracking-[-0.07em]">nuari<span className="text-[#7ED6A5]">.</span></p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9BAEAD]">Espacio de trabajo</p></div>
          </div>

          <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-4 shadow-[inset_0_1px_rgba(255,255,255,.04)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9BAEAD]">Módulo activo</p>
            <div className="mt-3 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[#DDF6E8] text-[#35645D]"><CalendarDots size={21} weight="duotone" /></span><span><strong className="block text-sm">Turnero</strong><span className="block text-xs text-[#AFC1BD]">Servicios y citas</span></span></div>
          </div>

          <div className="mt-8"><AppNavigation /></div>

          <div className="mt-auto border-t border-white/10 px-3 pt-5"><p className="text-xs font-bold text-[#DDF6E8]">nuari<span className="text-[#7ED6A5]">.</span></p><p className="mt-1 text-[11px] leading-5 text-[#9BAEAD]">Tu operación, en un solo lugar.</p></div>
        </div>
      </aside>

      <div className="md:pl-72">
        <header className="sticky top-0 z-10 border-b border-[#E4E9E7] bg-white/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7C908A]">Nuari / Turnero</p><p className="mt-0.5 truncate text-sm font-bold text-[#182026]">Espacio de trabajo</p></div>
            <MobileNavigation />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
