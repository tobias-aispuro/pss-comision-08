import Link from 'next/link'
import { requireRole } from '@/lib/role-access'
import { CLASES_PASAJE } from '@/lib/compra-utils'
import { formatearFecha, obtenerReservasAfectadas } from '@/lib/reubicacion-datos'

export default async function ReubicacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; reubicada?: string; fecha?: string }>
}) {
  await requireRole(['EMPLEADO_MOSTRADOR'])
  const { q = '', reubicada, fecha } = (await searchParams) ?? {}

  const reservas = await obtenerReservasAfectadas(q)

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        {reubicada && (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
            ✓ Pasajeros reubicados en el vuelo {reubicada}
            {fecha && ` del ${formatearFecha(fecha)}`}. La reserva quedó confirmada en el nuevo vuelo.
          </div>
        )}

        <div className="mb-8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Mostrador <span className="text-slate-400">›</span> Reubicación
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Pasajeros afectados por cancelaciones</h1>
          <p className="mt-2 text-sm text-slate-500">
            Reservas pagas cuyo vuelo fue cancelado por la aerolínea. Elegí una para ver los vuelos alternativos y reubicar a sus pasajeros.
          </p>
        </div>

        <form className="mb-6 flex flex-col gap-3 sm:flex-row" role="search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por DNI del pasajero o código de vuelo"
            aria-label="Buscar por DNI del pasajero o código de vuelo"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:max-w-md"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Buscar
          </button>
          {q && (
            <Link
              href="/empleado/reubicacion"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver todos
            </Link>
          )}
        </form>

        {reservas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            {q ? `No hay pasajeros afectados que coincidan con "${q}".` : 'No hay pasajeros afectados por cancelaciones pendientes de reubicar.'}
          </div>
        ) : (
          <div className="space-y-4">
            {reservas.map((reserva) => (
              <article key={reserva.id} className="rounded-2xl border border-slate-200 border-l-4 border-l-red-400 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Vuelo cancelado</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{reserva.vuelo.codigoVuelo}</p>
                      <p className="text-sm text-slate-600">
                        {reserva.vuelo.origen} → {reserva.vuelo.destino}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">{formatearFecha(reserva.fecha)}</p>
                      <p className="text-sm text-slate-600">{reserva.vuelo.horaSalida} hs</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Titular de la compra</p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">
                        {reserva.user.nombre} {reserva.user.apellido}
                      </p>
                      <p className="text-sm text-slate-600">
                        {CLASES_PASAJE[reserva.clase as keyof typeof CLASES_PASAJE]?.nombre ?? reserva.clase} ·{' '}
                        {reserva.activos.length} {reserva.activos.length === 1 ? 'pasajero' : 'pasajeros'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Motivo</p>
                      <p className="mt-1 text-sm text-slate-700">{reserva.motivo ?? 'Sin motivo registrado'}</p>
                    </div>
                  </div>

                  <Link
                    href={`/empleado/reubicacion/${reserva.id}`}
                    className="self-start rounded-xl bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    Ver alternativas
                  </Link>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  {reserva.activos.map((p) => (
                    <span key={p.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {p.nombre} · DNI {p.dni}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
