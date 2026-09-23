"use client";

import { useEffect, useState } from "react";

import { List } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import Link from "next/link";

const links = [
  ["Soluciones", "#soluciones"],
  ["Características", "#caracteristicas"],
  ["Precios", "#precios"],
  ["Preguntas", "#faq"],
] as const;

export function MobileMarketingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E4E9E7] bg-white p-2 text-[#182026] transition-colors hover:bg-[#F8FAF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2"
        aria-controls="marketing-mobile-menu"
        aria-expanded={open}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden="true" className="text-2xl" /> : <List aria-hidden="true" className="text-2xl" />}
      </button>
      {open ? (
        <div id="marketing-mobile-menu" className="absolute right-0 top-14 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[#E4E9E7] bg-white p-3 shadow-lg">
          <nav aria-label="Navegación principal" className="flex flex-col gap-1">
            {links.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm font-medium text-[#182026] transition-colors hover:bg-[#F8FAF9]">
                {label}
              </a>
            ))}
            <div className="my-2 h-px bg-[#E4E9E7]" />
            <Link href="/login" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm font-medium text-[#182026] transition-colors hover:bg-[#F8FAF9]">Ingresar</Link>
            <Link href="/register" onClick={closeMenu} className="flex min-h-11 items-center justify-center rounded-md bg-[#182026] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2A3742]">Comenzar gratis</Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
