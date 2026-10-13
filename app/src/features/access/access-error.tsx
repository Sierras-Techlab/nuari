"use client";
import { useRouter } from "next/navigation";
export function AccessError() {
  const router = useRouter();
  return <section role="alert" className="rounded-2xl border border-[#E4E9E7] bg-white p-6 text-[#182026]"><h1 className="text-xl font-bold">No pudimos comprobar tu acceso</h1><p className="mt-2 text-sm text-[#667078]">Tu espacio permanece cerrado hasta recuperar la conexión.</p><button type="button" className="mt-4 rounded-xl bg-[#182026] px-4 py-3 text-sm font-semibold text-white" onClick={() => router.refresh()}>Reintentar</button></section>;
}
