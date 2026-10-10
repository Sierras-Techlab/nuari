"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { AppNavigation } from "./app-navigation";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative md:hidden">
      <Button aria-controls="mobile-app-navigation" aria-expanded={open} aria-label={open ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setOpen((current) => !current)} size="icon" variant="outline" className="border-[#E4E9E7] bg-white text-[#182026]">
        <span aria-hidden="true" className="text-lg leading-none">{open ? "×" : "☰"}</span>
      </Button>
      {open ? <div id="mobile-app-navigation" className="absolute right-0 top-12 z-30 max-h-[calc(100vh-5rem)] w-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#182026] p-3 text-white shadow-[0_20px_45px_-15px_rgba(24,32,38,.5)]"><AppNavigation onNavigate={() => setOpen(false)} /></div> : null}
    </div>
  );
}
