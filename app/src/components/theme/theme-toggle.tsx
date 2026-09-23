"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
    localStorage.setItem("nuari-theme", nextDark ? "dark" : "light");
    window.dispatchEvent(new Event("nuari-theme-change"));
  }

  return <Button aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} onClick={toggleTheme} size="icon" variant="ghost"><span aria-hidden="true">{dark ? "☼" : "◐"}</span></Button>;
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("nuari-theme-change", onStoreChange);
  return () => window.removeEventListener("nuari-theme-change", onStoreChange);
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}
