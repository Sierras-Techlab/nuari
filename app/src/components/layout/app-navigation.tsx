import Link from "next/link";

import { cn } from "@/lib/utils";

export const appNavigation = [{ href: "/app", label: "Inicio" }] as const;

export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación de la aplicación" className={cn("flex flex-col gap-1")}>
      {appNavigation.map((item) => (
        <Link key={item.href} href={item.href} onClick={onNavigate} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
