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
      <Button aria-controls="mobile-app-navigation" aria-expanded={open} aria-label={open ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setOpen((current) => !current)} size="icon" variant="outline">
        <span aria-hidden="true" className="text-lg leading-none">{open ? "×" : "☰"}</span>
      </Button>
      {open ? <div id="mobile-app-navigation" className="absolute right-0 top-12 z-10 w-52 rounded-lg border bg-card p-2 shadow-lg"><AppNavigation onNavigate={() => setOpen(false)} /></div> : null}
    </div>
  );
}
