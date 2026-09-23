import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";

const questions = [
  ["¿Qué es Nuari?", "Nuari es una plataforma web (SaaS) diseñada para centralizar la gestión de pequeños negocios de servicios y comercios. Te permite manejar tu agenda, clientes, ventas, inventario y equipo desde un solo lugar."],
  ["¿Para qué tipo de negocios sirve?", "Está pensado para barberías, peluquerías, centros de estética, tatuadores, detailing, showrooms, vendedores por redes sociales y pequeños comercios que necesitan organizar su día a día."],
  ["¿Necesito instalar algo?", "No. Nuari funciona 100% en la nube. Solo necesitás conexión a internet y un navegador web para acceder desde tu computadora, tablet o celular."],
  ["¿Puedo cancelar cuando quiera?", "Sí, podés dar de baja tu suscripción en cualquier momento sin penalizaciones ni contratos a largo plazo."],
] as const;

export function Faq() {
  return (
    <div className="space-y-4">
      {questions.map(([question, answer]) => (
        <details key={question} className="group rounded-2xl border border-[#E4E9E7] bg-[#F8FAF9]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-6 font-semibold text-[#182026] marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{question}</span>
            <span className="shrink-0 rounded-full bg-white p-1.5 text-[#182026] shadow-sm transition-transform duration-300 group-open:-rotate-180 sm:p-3" aria-hidden="true">
              <CaretDown aria-hidden="true" className="text-lg" />
            </span>
          </summary>
          <div className="px-6 pb-6 leading-relaxed text-[#536068]">
            <p>{answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
