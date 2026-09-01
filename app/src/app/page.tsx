export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-6 text-stone-950">
      <section className="w-full max-w-3xl rounded-3xl border border-stone-200 bg-white p-10 shadow-sm sm:p-16">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
          Nuari
        </p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          La base técnica está lista.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
          El frontend Next.js ya puede consumir la API NestJS mediante el
          cliente HTTP centralizado.
        </p>
      </section>
    </main>
  );
}
