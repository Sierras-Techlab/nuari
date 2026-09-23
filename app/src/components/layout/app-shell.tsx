import type { ReactNode } from "react";

import { AppNavigation } from "./app-navigation";
import { MobileNavigation } from "./mobile-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-6 md:block">
        <div className="flex h-full flex-col">
          <div className="px-3"><p className="text-lg font-bold tracking-tight">Nuari</p><p className="mt-1 text-xs text-muted-foreground">Gestión cotidiana</p></div>
          <div className="my-6 h-px bg-border" />
          <AppNavigation />
          <p className="mt-auto px-3 text-xs leading-5 text-muted-foreground">La navegación visible no reemplaza los permisos verificados por la API.</p>
        </div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">Organización de demostración</p><p className="truncate text-xs text-muted-foreground">Contexto visual, sin datos operativos</p></div>
            <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium">Usuario de demostración</p><p className="text-xs text-muted-foreground">Sin sesión real</p></div><div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">UD</div><MobileNavigation /></div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
