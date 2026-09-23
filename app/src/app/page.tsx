import { ArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { Bell } from "@phosphor-icons/react/dist/ssr/Bell";
import { Calendar } from "@phosphor-icons/react/dist/ssr/Calendar";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { Handshake } from "@phosphor-icons/react/dist/ssr/Handshake";
import { MicrosoftExcelLogo } from "@phosphor-icons/react/dist/ssr/MicrosoftExcelLogo";
import { Notebook } from "@phosphor-icons/react/dist/ssr/Notebook";
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { Receipt } from "@phosphor-icons/react/dist/ssr/Receipt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { TrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { UserCircleGear } from "@phosphor-icons/react/dist/ssr/UserCircleGear";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import Link from "next/link";
import type { ReactNode } from "react";

import { Faq } from "@/components/marketing/faq";
import { MarketingNavbar } from "@/components/marketing/marketing-navbar";
import { Reveal } from "@/components/marketing/reveal";

const benefits = [
  {
    title: "Todo conectado",
    description: "Clientes, ventas, productos y turnos hablan entre sí. Un cambio en un lugar, se refleja en todos.",
    icon: PlugsConnected,
    background: "bg-[#DDF6E8]",
    foreground: "text-[#438C78]",
  },
  {
    title: "Menos trabajo administrativo",
    description: "Reducí horas anotando cosas en cuadernos o pasando datos a Excel a fin de mes.",
    icon: ClockCounterClockwise,
    background: "bg-[#E8F0FF]",
    foreground: "text-[#5D86D5]",
  },
  {
    title: "Entendé qué pasa",
    description: "Información clara y visual sobre tus ingresos y gastos para que tomes mejores decisiones.",
    icon: ChartBar,
    background: "bg-[#F0ECFF]",
    foreground: "text-[#8E7BC9]",
  },
] as const;

const steps = [
  ["01", "Creá tu cuenta", "En menos de 1 minuto, sin tarjeta de crédito requerida."],
  ["02", "Configurá tu negocio", "Agregá tus servicios, productos y equipo base."],
  ["03", "Empezá a gestionar", "Registrá tu primer turno o venta y tomá el control."],
] as const;

const plans = [
  {
    name: "Inicial",
    description: "Para emprendimientos y negocios que recién empiezan.",
    price: "$9.900",
    features: ["Clientes ilimitados", "Ventas básicas", "Agenda y Turnos", "1 Usuario admin"],
  },
  {
    name: "Pro",
    description: "Para negocios establecidos que necesitan más control.",
    price: "$18.900",
    features: ["Todo lo del plan Inicial", "Control de Stock", "Reportes financieros", "Cálculo de Comisiones", "Hasta 5 Usuarios"],
    highlighted: true,
  },
  {
    name: "Negocio",
    description: "Para equipos grandes con múltiples profesionales.",
    price: "$35.000",
    features: ["Todo lo del plan Pro", "Usuarios ilimitados", "Permisos avanzados", "Soporte prioritario"],
  },
] as const;

const upcoming = [
  {
    title: "Cobros con Mercado Pago",
    description: "Enviá links de pago y cobrá directamente desde la plataforma.",
    icon: Handshake,
    color: "text-[#009EE3]",
    background: "bg-[#009EE3]/10",
  },
  {
    title: "Recordatorios WhatsApp",
    description: "Notificaciones automáticas de turnos a tus clientes.",
    icon: WhatsappLogo,
    color: "text-[#25D366]",
    background: "bg-[#25D366]/10",
  },
  {
    title: "Asistente de IA",
    description: "Análisis inteligente de tus datos para sugerir mejoras en tus ventas.",
    icon: Sparkle,
    color: "text-[#A997E8]",
    background: "bg-[#A997E8]/10",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAF9] font-sans text-[#182026] antialiased selection:bg-[#7ED6A5] selection:text-[#182026]">
      <MarketingNavbar />

      <section className="relative overflow-hidden pb-20 pt-32 lg:pb-32 lg:pt-48">
        <div className="pointer-events-none absolute inset-0 z-0 bg-grid-pattern opacity-40" />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#A997E8]/20 bg-[#F0ECFF] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#182026]">
              <span className="h-2 w-2 motion-safe:animate-pulse rounded-full bg-[#A997E8]" />
              Gestión simple para negocios que quieren crecer
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight text-[#182026] sm:text-6xl lg:text-[4rem]">
              Todo tu negocio,
              <br className="hidden sm:block" /> en un solo lugar.
            </h1>
            <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-[#667078] sm:text-xl lg:mx-0">
              Clientes, ventas, turnos, productos, equipo y números claros desde una sola plataforma. Sin complicaciones.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#182026] px-8 py-4 text-base font-semibold text-white shadow-[0_8px_30px_rgb(24,32,38,0.12)] transition-all motion-safe:hover:-translate-y-1 hover:bg-[#2A3742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2"
              >
                Comenzar gratis
              </Link>
              <a
                href="#caracteristicas"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#E4E9E7] bg-white px-8 py-4 text-base font-semibold text-[#182026] transition-all hover:border-[#667078]/30 hover:bg-[#F8FAF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#182026] focus-visible:ring-offset-2"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-4 text-sm font-medium text-[#667078]">Configurá tu negocio en minutos. Sin tarjeta de crédito.</p>
          </Reveal>

          <Reveal delay={200} className="relative mx-auto aspect-square w-full max-w-[500px] lg:ml-auto">
            <div className="absolute left-1/2 top-1/2 -z-10 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DDF6E8]/30 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 z-10 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[2rem] border border-[#E4E9E7] bg-white p-6 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] ring-1 ring-inset ring-white">
              <div className="flex items-center justify-between border-b border-[#E4E9E7]/50 pb-4">
                <div className="h-4 w-24 rounded-md bg-[#F8FAF9]" />
                <div className="flex gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F0FF]">
                    <Bell aria-hidden="true" className="text-sm text-[#7EA8F8]" />
                  </div>
                  <div className="h-8 w-8 rounded-full border border-[#E4E9E7] bg-[#F8FAF9]" />
                </div>
              </div>
              <div className="flex items-end justify-between rounded-xl border border-[#E4E9E7]/50 bg-[#F8FAF9] p-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-[#536068]">Ingresos de hoy</div>
                  <div className="text-2xl font-bold text-[#182026]">$145.200</div>
                </div>
                <div className="flex items-center gap-1 rounded-md bg-[#DDF6E8] px-2 py-1 text-xs font-bold text-[#35645D]">
                  <TrendUp aria-hidden="true" /> +12%
                </div>
              </div>
              <div className="mt-2 flex h-24 w-full items-end gap-2">
                <div className="h-[30%] w-full rounded-t-sm bg-[#E8F0FF]" />
                <div className="h-[50%] w-full rounded-t-sm bg-[#E8F0FF]" />
                <div className="h-[40%] w-full rounded-t-sm bg-[#E8F0FF]" />
                <div className="h-[80%] w-full rounded-t-sm bg-[#7EA8F8]" />
                <div className="h-[60%] w-full rounded-t-sm bg-[#E8F0FF]" />
                <div className="h-[90%] w-full rounded-t-sm bg-[#E8F0FF]" />
              </div>
            </div>
            <div className="absolute -right-4 top-1/4 z-20 flex motion-safe:animate-float-slow items-center gap-3 rounded-xl border border-[#E4E9E7] bg-white p-3 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DDF6E8] text-[#438C78]">
                <Receipt aria-hidden="true" className="text-xl" />
              </div>
              <div>
                <div className="text-xs font-medium text-[#667078]">Nueva venta</div>
                <div className="text-sm font-bold text-[#182026]">+$ 8.500</div>
              </div>
            </div>
            <div className="absolute bottom-1/3 left-2 z-20 flex motion-safe:animate-float-delayed items-center gap-3 rounded-xl border border-[#E4E9E7] bg-white p-3 shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] sm:-left-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF1E2] text-[#FFB86B]">
                <CalendarCheck aria-hidden="true" className="text-xl" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#182026]">Turno 14:30</div>
                <div className="text-xs font-medium text-[#667078]">Corte • Sofía</div>
              </div>
            </div>
            <div className="absolute bottom-8 right-4 z-20 flex items-center gap-2 rounded-xl border border-[#E4E9E7] bg-white p-2.5 shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]">
              <div className="h-2 w-2 rounded-full bg-[#FFB86B]" />
              <span className="text-xs font-semibold text-[#182026]">Stock bajo (2)</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[#E4E9E7] bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Tu negocio no debería vivir en cinco aplicaciones.</h2>
            <p className="text-lg text-[#667078]">Centralizá la operación de tu negocio, dejá de saltar entre herramientas y evitá errores manuales.</p>
          </Reveal>
          <Reveal className="relative mx-auto flex max-w-4xl flex-col items-center justify-between gap-8 md:flex-row md:gap-0">
            <div className="relative z-10 grid w-full grid-cols-2 gap-4 md:w-1/3">
              <svg className="absolute left-full top-1/2 -z-10 hidden h-full w-[calc(100%+2rem)] -translate-y-1/2 text-[#E4E9E7] md:block" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M 100 50 C 50 50, 50 10, 0 10" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2" />
                <path d="M 100 50 C 50 50, 50 50, 0 50" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2" />
                <path d="M 100 50 C 50 50, 50 90, 0 90" fill="none" stroke="currentColor" strokeDasharray="4 4" strokeWidth="2" />
              </svg>
              <ToolPill label="Chats" icon={<WhatsappLogo aria-hidden="true" className="text-xl text-[#25D366]" />} />
              <ToolPill label="Agenda papel" icon={<Calendar aria-hidden="true" className="text-xl text-[#7EA8F8]" />} className="translate-y-2" />
              <ToolPill label="Excel" icon={<MicrosoftExcelLogo aria-hidden="true" className="text-xl text-[#107C41]" />} className="-translate-y-2" />
              <ToolPill label="Notas" icon={<Notebook aria-hidden="true" className="text-xl text-[#FFB86B]" />} />
            </div>
            <div className="my-4 text-[#E4E9E7] md:hidden">
              <ArrowDown aria-hidden="true" className="text-4xl" />
            </div>
            <div className="z-10 flex w-full justify-center md:w-1/3">
              <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#182026] p-8 text-white shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#2A3742] to-[#182026] opacity-50" />
                <div className="relative text-4xl font-bold tracking-tight">nuari</div>
                <div className="relative mt-2 text-sm font-medium text-[#DDF6E8]">Todo integrado</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="caracteristicas" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Todo lo que necesitás para gestionar el día a día.</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
            <Reveal className="md:col-span-2 lg:col-span-2">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[#E4E9E7] bg-white p-8 shadow-sm transition-shadow hover:shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]">
                <div className="relative z-10 mb-8">
                  <FeatureIcon background="bg-[#E8F0FF]" foreground="text-[#7EA8F8]" icon={<CalendarBlank aria-hidden="true" className="text-2xl" />} />
                  <h3 className="mb-2 text-2xl font-bold text-[#182026]">Agenda inteligente</h3>
                  <p className="text-[#667078]">Organizá tus turnos, asigná empleados y evitá solapamientos con una vista calendario simple y potente.</p>
                </div>
                <div className="relative -mb-8 mt-auto flex flex-col gap-2 rounded-t-xl border border-b-0 border-[#E4E9E7] bg-[#F8FAF9] p-4 pt-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
                  <div className="mb-2 flex gap-2">
                    <div className="rounded-md border border-[#E4E9E7] bg-white px-3 py-1 text-xs font-bold shadow-sm">Lun 18</div>
                    <div className="rounded-md bg-[#7EA8F8] px-3 py-1 text-xs font-bold text-[#182026] shadow-sm">Mar 19</div>
                    <div className="rounded-md border border-[#E4E9E7] bg-white px-3 py-1 text-xs font-bold shadow-sm">Mié 20</div>
                  </div>
                  <div className="rounded-md border-l-4 border-[#7EA8F8] bg-[#E8F0FF] p-2">
                    <div className="text-xs font-bold text-[#182026]">10:00 - Coloración</div>
                    <div className="text-[10px] text-[#536068]">Leo • Ana S.</div>
                  </div>
                  <div className="w-3/4 rounded-md border-l-4 border-[#7ED6A5] bg-[#DDF6E8] p-2">
                    <div className="text-xs font-bold text-[#182026]">11:30 - Corte</div>
                    <div className="text-[10px] text-[#536068]">Martín • Lucas G.</div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal className="md:col-span-1 lg:col-span-1" delay={75}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#E4E9E7] bg-white p-8 shadow-sm transition-shadow hover:shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]">
                <FeatureIcon background="bg-[#F0ECFF]" foreground="text-[#A997E8]" icon={<Users aria-hidden="true" className="text-2xl" />} />
                <h3 className="mb-2 text-xl font-bold text-[#182026]">Historial de Clientes</h3>
                <p className="mb-6 text-sm text-[#667078]">Conocé quiénes te compran, qué se hacen y cuándo fue su última visita.</p>
                <div className="mt-auto space-y-3">
                  <ClientRow initials="SR" name="Sofía Romano" lastVisit="Hace 2 días" />
                  <ClientRow initials="LG" name="Lucas Gómez" lastVisit="Hace 1 mes" />
                </div>
              </div>
            </Reveal>

            <Reveal className="md:col-span-1 lg:col-span-1" delay={150}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#E4E9E7] bg-white p-8 shadow-sm transition-shadow hover:shadow-[0_4px_20px_-2px_rgba(24,32,38,0.05)]">
                <FeatureIcon background="bg-[#FFF1E2]" foreground="text-[#FFB86B]" icon={<UserCircleGear aria-hidden="true" className="text-2xl" />} />
                <h3 className="mb-2 text-xl font-bold text-[#182026]">Tu Equipo</h3>
                <p className="text-sm text-[#667078]">Gestioná roles, horarios y calculá comisiones automáticamente.</p>
              </div>
            </Reveal>

            <Reveal className="md:col-span-3 lg:col-span-4" delay={200}>
              <div className="relative flex flex-col items-center justify-between overflow-hidden rounded-3xl bg-[#182026] p-8 text-white shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] lg:flex-row lg:p-12">
                <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#7ED6A5] opacity-10 blur-[100px]" />
                <div className="relative z-10 mb-8 max-w-lg lg:mb-0">
                  <div className="mb-6 inline-block rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-[#DDF6E8]">Ventas &amp; Reportes</div>
                  <h3 className="mb-4 text-3xl font-bold">Números claros al instante.</h3>
                  <p className="text-lg text-gray-300">Registrá ventas en segundos, controlá tus gastos y mirá reportes simples para saber exactamente cuánta plata entra y sale.</p>
                </div>
                <div className="relative z-10 w-full rounded-2xl border border-white/10 bg-[#2A3742]/50 p-6 backdrop-blur-sm lg:w-1/2">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-400">Total Facturado</div>
                    <div className="rounded bg-white/5 px-2 py-1 text-xs">Este mes <CaretDown aria-hidden="true" className="inline" /></div>
                  </div>
                  <div className="mb-2 text-4xl font-bold text-white">$ 845.200</div>
                  <div className="mb-6 flex items-center gap-1 text-sm font-medium text-[#7ED6A5]">
                    <TrendUp aria-hidden="true" /> +12% vs mes pasado
                  </div>
                  <div className="space-y-3">
                    <ReportRow name="Corte + Brushing" amount="$ 20.500" />
                    <ReportRow name="Shampoo 1L" amount="$ 12.000" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="soluciones" className="scroll-mt-24 border-t border-[#E4E9E7] bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Nuari se adapta a tu forma de trabajar.</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Reveal>
              <SolutionCard
                className="bg-[#DDF6E8]/30"
                borderClass="border-[#DDF6E8]"
                title="Organizá tu agenda y tu equipo."
                description="Ideal para barberías, estética, peluquerías, centros médicos y profesionales independientes."
                items={["Turnos y recordatorios", "Catálogo de servicios", "Gestión de empleados y comisiones"]}
              >
                <div className="flex items-center gap-4 rounded-2xl border border-[#E4E9E7] bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8FAF9] text-xl font-bold">💇‍♀️</div>
                  <div>
                    <div className="text-sm font-bold text-[#182026]">Servicios</div>
                    <div className="text-xs text-[#536068]">Controlá tu tiempo</div>
                  </div>
                </div>
              </SolutionCard>
            </Reveal>
            <Reveal delay={75}>
              <SolutionCard
                className="bg-[#E8F0FF]/50"
                borderClass="border-[#E8F0FF]"
                title="Vendé y controlá tu stock."
                description="Perfecto para showrooms, tiendas físicas, venta por Instagram y pequeños comercios."
                items={["Inventario y alertas de stock", "Registro rápido de ventas", "Base de datos de clientes"]}
              >
                <div className="flex items-center gap-4 rounded-2xl border border-[#E4E9E7] bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8FAF9] text-xl font-bold">📦</div>
                  <div>
                    <div className="text-sm font-bold text-[#182026]">Productos</div>
                    <div className="text-xs text-[#536068]">Sabé qué tenés</div>
                  </div>
                </div>
              </SolutionCard>
            </Reveal>
          </div>
          <Reveal className="mt-12 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#E4E9E7] bg-[#F8FAF9] px-6 py-3 text-sm font-medium text-[#182026]"><span className="text-xl">✨</span> ¿Tu negocio hace las dos cosas? Nuari también. Combina servicios y productos sin problema.</p>
          </Reveal>
        </div>
      </section>

      <section className="overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Una interfaz pensada para vos.</h2>
            <p className="text-lg text-[#667078]">Limpia, rápida y sin distracciones. Diseñada para que encuentres lo que buscás en un clic.</p>
          </Reveal>
          <Reveal className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#E4E9E7] bg-white shadow-[0_20px_60px_-15px_rgba(24,32,38,0.1)]">
            <div className="flex h-12 items-center gap-2 border-b border-[#E4E9E7] bg-[#F8FAF9] px-6">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>
            <div className="flex h-[500px]">
              <div className="hidden w-64 flex-col border-r border-[#E4E9E7] bg-white p-4 sm:flex">
                <div className="mb-8 px-2 text-xl font-bold text-[#182026]">nuari</div>
                <div className="space-y-2">
                  <MockSidebarItem active icon={<SquaresFour aria-hidden="true" className="text-lg" />} label="Inicio" />
                  <MockSidebarItem icon={<CalendarBlank aria-hidden="true" className="text-lg" />} label="Agenda" />
                  <MockSidebarItem icon={<Users aria-hidden="true" className="text-lg" />} label="Clientes" />
                  <MockSidebarItem icon={<Receipt aria-hidden="true" className="text-lg" />} label="Ventas" />
                </div>
              </div>
              <div className="min-w-0 flex-1 overflow-hidden bg-[#F4F6F8] p-6 sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-[#182026]">Resumen del negocio</h3>
                  <div className="hidden rounded-lg bg-[#182026] px-4 py-2 text-sm font-semibold text-white sm:block">Nueva venta</div>
                </div>
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                  <DashboardMetric label="Turnos hoy" value="14" />
                  <DashboardMetric label="Ingresos" value="$84k" valueClass="text-[#438C78]" />
                  <DashboardMetric label="Nuevos Clientes" value="3" className="hidden md:block" />
                </div>
                <div className="rounded-xl border border-[#E4E9E7] bg-white p-5 shadow-sm">
                  <h4 className="mb-4 text-sm font-bold text-[#182026]">Próximos turnos</h4>
                  <div className="space-y-4">
                    <AppointmentRow initials="M" name="Martín Silva" service="Corte de pelo" time="14:30" tone="blue" />
                    <AppointmentRow initials="L" name="Laura Gómez" service="Manicura" time="15:15" tone="warm" />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[#E4E9E7] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#182026]">Más claridad. Menos tareas manuales.</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {benefits.map(({ title, description, icon: Icon, background, foreground }, index) => (
              <Reveal key={title} delay={index * 75}>
                <div className="px-4 text-center">
                  <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${background} ${foreground}`}>
                    <Icon aria-hidden="true" className="text-3xl" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-[#182026]">{title}</h3>
                  <p className="text-[#667078]">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Empezar es simple.</h2>
          </Reveal>
          <Reveal className="relative mx-auto max-w-4xl">
            <div className="absolute left-0 top-1/2 hidden h-0.5 w-full -translate-y-1/2 bg-[#E4E9E7] md:block" />
            <div className="flex flex-col justify-between gap-10 md:flex-row md:gap-4">
              {steps.map(([number, title, description], index) => (
                <div key={number} className="relative flex flex-col items-center bg-[#F8FAF9] text-center md:bg-transparent">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ring-8 ring-[#F8FAF9] ${index === 0 ? "bg-[#182026]" : index === 1 ? "bg-[#7EA8F8]" : "bg-[#7ED6A5]"}`}>{number}</div>
                  <h3 className="mb-2 text-xl font-bold text-[#182026]">{title}</h3>
                  <p className="max-w-[200px] text-sm text-[#667078]">{description}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="precios" className="scroll-mt-24 border-t border-[#E4E9E7] bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#182026] md:text-4xl">Planes simples y transparentes</h2>
            <p className="mb-8 text-lg text-[#667078]">Sin costos ocultos ni letras chicas.</p>
            <div className="inline-flex items-center rounded-full border border-[#E4E9E7] bg-[#F8FAF9] p-1" role="group" aria-label="Periodicidad de precios">
              <button type="button" className="rounded-full bg-white px-6 py-2 text-sm font-bold text-[#182026] shadow-sm">Mensual</button>
              <button type="button" className="rounded-full px-6 py-2 text-sm font-medium text-[#667078] transition-colors hover:text-[#182026]">Anual (Ahorrá 20%)</button>
            </div>
          </Reveal>
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-8 md:grid-cols-3">
            {plans.map((plan, index) => (
              <Reveal key={plan.name} delay={index * 75} className="h-full">
                <PriceCard {...plan} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#182026] py-24 text-white">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#2A3742] blur-[100px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Y esto recién empieza.</h2>
            <p className="text-lg text-gray-400">Estamos construyendo constantemente nuevas herramientas para potenciar tu negocio.</p>
          </Reveal>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {upcoming.map(({ title, description, icon: Icon, color, background }, index) => (
              <Reveal key={title} delay={index * 75}>
                <div className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-[#2A3742]/50 p-6 text-center">
                  <div className="absolute right-3 top-3 rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">Próximamente</div>
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${background} ${color} transition-transform motion-safe:group-hover:scale-110`}>
                    <Icon aria-hidden="true" className="text-3xl" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{title}</h3>
                  <p className="text-sm text-gray-400">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 bg-white py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#182026]">Preguntas frecuentes</h2>
          </Reveal>
          <Reveal>
            <Faq />
          </Reveal>
        </div>
      </section>

      <section className="bg-[#F8FAF9] py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal className="relative overflow-hidden rounded-[3rem] bg-[#182026] p-10 text-center text-white shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] md:p-20">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#7EA8F8] opacity-20 blur-[120px]" />
            <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#7ED6A5] opacity-20 blur-[120px]" />
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">Tu negocio puede ser más simple.</h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-300">Centralizá tu operación, dejá de perder tiempo en tareas manuales y dedicá más tiempo a hacer crecer tu negocio.</p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/register" className="inline-flex items-center justify-center rounded-2xl bg-[#7ED6A5] px-8 py-4 text-base font-semibold text-[#182026] shadow-lg transition-all motion-safe:hover:-translate-y-1 hover:bg-[#68C595] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED6A5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#182026]">Comenzar gratis</Link>
                <a href="#caracteristicas" className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#182026]">Conocer Nuari</a>
              </div>
              <div className="mt-6 text-sm font-medium text-gray-400">Pensado para negocios reales.</div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function ToolPill({ label, icon, className = "" }: { label: string; icon: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 rounded-xl border border-[#E4E9E7] bg-[#F8FAF9] px-4 py-3 shadow-sm ${className}`}><span aria-hidden="true">{icon}</span><span className="text-sm font-semibold text-[#182026]">{label}</span></div>;
}

function FeatureIcon({ background, foreground, icon }: { background: string; foreground: string; icon: ReactNode }) {
  return <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${background} ${foreground}`}>{icon}</div>;
}

function ClientRow({ initials, name, lastVisit }: { initials: string; name: string; lastVisit: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8FAF9] text-xs font-bold text-[#182026]">{initials}</div><div><div className="text-sm font-bold text-[#182026]">{name}</div><div className="text-xs text-[#667078]">{lastVisit}</div></div></div>;
}

function ReportRow({ name, amount }: { name: string; amount: string }) {
  return <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm"><div className="text-gray-300">{name}</div><div className="font-semibold text-white">{amount}</div></div>;
}

function SolutionCard({ className, borderClass, title, description, items, children }: { className: string; borderClass: string; title: string; description: string; items: string[]; children: ReactNode }) {
  return <div className={`flex h-full flex-col rounded-[2.5rem] border p-8 lg:p-12 ${className} ${borderClass}`}><h3 className="mb-4 text-2xl font-bold text-[#182026]">{title}</h3><p className="mb-8 text-[#667078]">{description}</p><ul className="mb-8 space-y-4">{items.map((item) => <li key={item} className="flex items-center gap-3 text-sm font-medium text-[#182026]"><CheckCircle aria-hidden="true" weight="fill" className="text-xl text-[#438C78]" />{item}</li>)}</ul>{children}</div>;
}

function MockSidebarItem({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-[#F8FAF9] text-[#182026]" : "text-[#667078]"}`}>{icon}{label}</div>;
}

function DashboardMetric({ label, value, valueClass = "text-[#182026]", className = "" }: { label: string; value: string; valueClass?: string; className?: string }) {
  return <div className={`rounded-xl border border-[#E4E9E7] bg-white p-4 shadow-sm ${className}`}><div className="mb-1 text-xs font-medium text-[#667078]">{label}</div><div className={`text-xl font-bold sm:text-2xl ${valueClass}`}>{value}</div></div>;
}

function AppointmentRow({ initials, name, service, time, tone }: { initials: string; name: string; service: string; time: string; tone: "blue" | "warm" }) {
  const colors = tone === "blue" ? "bg-[#E8F0FF] text-[#182026]" : "bg-[#FFF1E2] text-[#182026]";
  return <div className="flex items-center justify-between border-b border-[#E4E9E7]/50 pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs ${colors}`}>{initials}</div><div><div className="text-sm font-bold text-[#182026]">{name}</div><div className="text-xs text-[#667078]">{service}</div></div></div><div className="text-sm font-semibold text-[#182026]">{time}</div></div>;
}

function PriceCard({ name, description, price, features, highlighted = false }: { name: string; description: string; price: string; features: readonly string[]; highlighted?: boolean }) {
  return <div className={`relative flex h-full flex-col rounded-3xl p-8 ${highlighted ? "z-10 scale-100 border border-[#2A3742] bg-[#182026] text-white shadow-[0_20px_40px_-10px_rgba(24,32,38,0.08)] md:scale-105" : "border border-[#E4E9E7] bg-[#F8FAF9] text-[#182026]"}`}>{highlighted ? <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#7ED6A5] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#182026]">Más elegido</div> : null}<h3 className="mb-2 text-xl font-bold">{name}</h3><p className={`mb-6 min-h-10 text-sm ${highlighted ? "text-gray-400" : "text-[#667078]"}`}>{description}</p><div className="mb-6"><span className="text-4xl font-bold">{price}</span><span className={highlighted ? "text-gray-400" : "text-[#667078]"}>/mes</span></div><ul className="mb-8 flex-1 space-y-4">{features.map((feature, index) => <li key={feature} className={`flex items-center gap-3 text-sm ${highlighted && index > 0 ? "font-medium text-white" : highlighted ? "text-gray-300" : "text-[#667078]"}`}><Check aria-hidden="true" className={highlighted ? "text-[#7ED6A5]" : "text-[#182026]"} />{feature}</li>)}</ul><Link href="/register" className={`block w-full rounded-xl px-4 py-3 text-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${highlighted ? "bg-[#7ED6A5] text-[#182026] shadow-sm hover:bg-[#68C595] focus-visible:ring-[#7ED6A5] focus-visible:ring-offset-[#182026]" : "border border-[#E4E9E7] bg-white text-[#182026] hover:bg-[#F8FAF9] focus-visible:ring-[#182026] focus-visible:ring-offset-[#F8FAF9]"}`}>{highlighted ? "Probar gratis" : "Comenzar"}</Link></div>;
}

function Footer() {
  return <footer className="border-t border-[#E4E9E7] bg-white pb-8 pt-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4"><div><Link href="/" className="mb-4 block text-3xl font-bold tracking-tight text-[#182026]">nuari</Link><p className="max-w-xs text-sm text-[#667078]">La plataforma todo en uno para gestionar y potenciar tu negocio.</p></div><div><h4 className="mb-4 font-bold text-[#182026]">Producto</h4><ul className="space-y-3"><li><a href="#caracteristicas" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Características</a></li><li><a href="#soluciones" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Soluciones</a></li><li><a href="#precios" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Precios</a></li></ul></div><div><h4 className="mb-4 font-bold text-[#182026]">Plataforma</h4><ul className="space-y-3"><li><Link href="/login" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Ingresar</Link></li><li><Link href="/register" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Crear cuenta</Link></li><li><a href="mailto:hola@nuari.app" className="text-sm text-[#667078] transition-colors hover:text-[#182026]">Contacto</a></li></ul></div><div><h4 className="mb-4 font-bold text-[#182026]">Legal</h4><ul className="space-y-3"><li><span className="text-sm text-[#667078]">Privacidad</span></li><li><span className="text-sm text-[#667078]">Términos de servicio</span></li></ul></div></div><div className="flex flex-col items-center justify-between gap-4 border-t border-[#E4E9E7] pt-8 md:flex-row"><p className="text-sm text-[#667078]">© 2026 Nuari. Todos los derechos reservados.</p></div></div></footer>;
}
