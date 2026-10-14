"use client";

import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { AddressBook } from "@phosphor-icons/react/dist/csr/AddressBook";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import { Wallet } from "@phosphor-icons/react/dist/csr/Wallet";
import { Gear } from "@phosphor-icons/react/dist/csr/Gear";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const appNavigation = [
  { href: "/app", label: "Inicio", icon: House, group: "Turnero" },
  {
    href: "/app/agenda",
    label: "Agenda",
    icon: CalendarDots,
    group: "Turnero",
  },
  {
    href: "/app/servicios",
    label: "Servicios",
    icon: SquaresFour,
    group: "Turnero",
  },
  {
    href: "/app/profesionales",
    label: "Profesionales",
    icon: UserCircle,
    group: "Turnero",
  },
  {
    href: "/app/clientes",
    label: "Clientes",
    icon: AddressBook,
    group: "Gestión",
  },
  { href: "/app/caja", label: "Caja", icon: Wallet, group: "Gestión" },
  { href: "/app/equipo", label: "Equipo", icon: UsersThree, group: "Gestión" },
  {
    href: "/app/configuracion",
    label: "Configuración",
    icon: Gear,
    group: "Gestión",
  },
] as const;

export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación de la aplicación" className="space-y-1.5">
      {appNavigation.map((item, index) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <div key={item.href}>
            {index === 0 || appNavigation[index - 1].group !== item.group ? (
              <p
                className={cn(
                  "px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#829594]",
                  index > 0 && "pt-6",
                )}
              >
                {item.group}
              </p>
            ) : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DDF6E8]",
                active
                  ? "bg-[#DDF6E8] text-[#182026] shadow-[0_8px_24px_-16px_rgba(0,0,0,.55)]"
                  : "text-[#B4C1C0] hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon
                size={19}
                weight={active ? "fill" : "regular"}
                aria-hidden="true"
                className={
                  active
                    ? "text-[#438C78]"
                    : "text-[#9BAEAD] group-hover:text-white"
                }
              />
              <span>{item.label}</span>
              {active ? (
                <span
                  className="ml-auto size-1.5 rounded-full bg-[#438C78]"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
