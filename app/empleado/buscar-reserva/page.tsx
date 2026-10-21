import { requireRole } from '@/lib/role-access'
import BuscadorReservas from '@/components/BuscadorReservas'

export default async function BuscarReservaPage() {
  await requireRole(['EMPLEADO_MOSTRADOR', 'ADMINISTRADOR'])

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Mostrador <span className="text-slate-400">›</span> Búsqueda
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Búsqueda de Reservas
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Buscá por DNI del pasajero o por número de vuelo para consultar las reservas activas, estado de check-in y datos del vuelo.
          </p>
        </div>

        <BuscadorReservas />
      </div>
    </main>
  )
}