import { requireRole } from '@/lib/role-access'

export default async function BusquedaVueloPage() {
  await requireRole(['PASAJERO'])

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
          Pasajeros
        </p>
        <h1 className="mb-3 text-3xl font-bold text-slate-800">Buscar vuelos</h1>
        <p className="text-slate-600">
          Seleccioná los datos de tu viaje para encontrar vuelos disponibles.
        </p>
      </section>
    </main>
  )
}
