"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { MobileMarketingNav } from "@/components/marketing/mobile-marketing-nav";

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function updateScrollState() {
      setScrolled(window.scrollY > 20);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <nav className={`fixed left-0 top-0 z-50 w-full border-b transition-all duration-300 ${scrolled ? "border-[#E4E9E7] bg-white/90 shadow-sm backdrop-blur-md" : "border-transparent bg-[#F8FAF9]/80 backdrop-blur-md"}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="shrink-0 text-2xl font-bold tracking-tight text-[#182026]" aria-label="nuari, inicio">
            nuari
          </Link>

          <div className="hidden items-center space-x-8 md:flex">
            <a href="#soluciones" className="text-sm font-medium text-[#536068] transition-colors hover:text-[#182026]">Soluciones</a>
            <a href="#caracteristicas" className="text-sm font-medium text-[#536068] transition-colors hover:text-[#182026]">Características</a>
            <a href="#precios" className="text-sm font-medium text-[#536068] transition-colors hover:text-[#182026]">Precios</a>
            <a href="#faq" className="text-sm font-medium text-[#536068] transition-colors hover:text-[#182026]">Preguntas</a>
          </div>

          <div className="hidden items-center space-x-4 md:flex">
            <Link href="/login" className="text-sm font-medium text-[#182026] transition-colors hover:text-[#667078]">Ingresar</Link>
            <Link href="/register" className="inline-flex items-center justify-center rounded-xl bg-[#182026] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)] transition-all motion-safe:hover:-translate-y-0.5 hover:bg-[#2A3742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2">Comenzar gratis</Link>
          </div>

          <div className="md:hidden">
            <MobileMarketingNav />
          </div>
        </div>
      </div>
    </nav>
  );
}
