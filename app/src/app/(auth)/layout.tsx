import type { ReactNode } from "react";

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import Link from "next/link";

import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col bg-[#F8FAF9] text-[#182026] md:h-screen md:flex-row md:overflow-hidden">
      <AuthBrandPanel />

      <section className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-[#F8FAF9] md:h-screen md:overflow-y-auto" aria-label="Autenticación">
        <header className="flex shrink-0 items-center justify-between border-b border-[#E4E9E7] bg-white p-6 md:hidden">
          <Link href="/" className="text-2xl font-bold tracking-tight text-[#182026]" aria-label="nuari, inicio">nuari</Link>
          <Link href="/" className="flex min-h-11 items-center gap-1 text-sm font-medium text-[#667078] transition-colors hover:text-[#182026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" /> Inicio
          </Link>
        </header>

        <div className="hidden shrink-0 justify-end p-8 md:flex">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-sm font-medium text-[#667078] transition-colors hover:text-[#182026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">
            <ArrowLeft aria-hidden="true" /> Volver al inicio
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="sr-only md:hidden">Todo tu negocio, en un solo lugar.</h1>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
