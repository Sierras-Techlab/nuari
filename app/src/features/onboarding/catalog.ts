export type OnboardingStep = 1 | 2 | 3 | 4;
export type BusinessType = "SERVICES" | "COMMERCE" | "HOSPITALITY";
export type Plan = "BASIC" | "PRO" | "BUSINESS" | "TOURISM";

export const businessTypes = [
  { id: "SERVICES", name: "Servicios", description: "Barberías, estética, salud, profesionales y negocios con turnos.", color: "bg-[#DDF6E8] text-[#7ED6A5]", badge: "border-[#7ED6A5]/20 bg-[#DDF6E8] text-[#35645D]" },
  { id: "COMMERCE", name: "Comercio", description: "Tiendas físicas, venta online, control de stock e inventario.", color: "bg-[#E8F0FF] text-[#7EA8F8]", badge: "border-[#7EA8F8]/20 bg-[#E8F0FF] text-[#526B9B]" },
  { id: "HOSPITALITY", name: "Hostelería", description: "Alojamientos, cabañas, reservas, hotelería y turismo.", color: "bg-[#FFF1E2] text-[#FFB86B]", badge: "border-[#FFB86B]/20 bg-[#FFF1E2] text-[#8A5F33]" },
] as const satisfies ReadonlyArray<{ id: BusinessType; name: string; description: string; color: string; badge: string }>;

export const plans = [
  { id: "BASIC", name: "Básico", description: "Ideal para emprendimientos y negocios pequeños.", features: ["Clientes ilimitados", "Agenda y Turnos", "Ventas básicas", "1 Usuario admin"] },
  { id: "PRO", name: "Pro", description: "Para negocios establecidos que buscan más control.", features: ["Todo el plan Básico", "Control de Stock", "Cálculo Comisiones", "Hasta 5 Usuarios"] },
  { id: "BUSINESS", name: "Business", description: "Equipos grandes con múltiples profesionales.", features: ["Todo el plan Pro", "Permisos avanzados", "Reportes financieros", "Usuarios ilimitados"] },
  { id: "TOURISM", name: "Turismo", description: "Diseñado específicamente para reservas y alojamientos.", features: ["Motor de reservas", "Calendario múltiple", "Gestión de cuartos", "Pasarelas de pago"] },
] as const satisfies ReadonlyArray<{ id: Plan; name: string; description: string; features: readonly string[] }>;

export function isPlanSuggested(type: BusinessType | null, plan: Plan) {
  return type === "HOSPITALITY" ? plan === "TOURISM" : plan !== "TOURISM";
}
