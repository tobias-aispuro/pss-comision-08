import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/role-access'
import { CLASES_PASAJE } from '@/lib/compra-utils'
import { esFechaValida, fechaDeHoy } from '@/lib/search-utils'
import { formatearFecha, obtenerAlternativas, obtenerReservaAfectada } from '@/lib/reubicacion-datos'
import ConfirmarReubicacionModal from '@/components/ConfirmarReubicacionModal'

// Suma días a una fecha "YYYY-MM-DD".
function moverDias(fecha: string, dias: number) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

const claseNavegacion =
  'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'

export default async function AlternativasPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>
  searchParams?: Promise<{ fecha?: string }>
}) {
  await requireRole(['EMPLEADO_MOSTRADOR'])
  const { reservaId } = await params
  const { fecha: fechaParam = '' } = (await searchParams) ?? {}

  const reserva = await obtenerReservaAfectada(reservaId)
  if (!reserva) {
    notFound()
  }

  const volver = (
    <Link href="/empleado/reubicacion" className="text-sm font-semibold text-sky-700 hover:underline">
      ← Volver a pasajeros afectados
    </Link>
  )

  if (!reserva.reubicable.ok) {
    return (
      <main className="flex-1 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {volver}
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            <p className="font-semibold">Esta reserva no se puede reubicar.</p>
            <p className="mt-1">{reserva.reubicable.motivo}</p>
          </div>
        </div>
      </main>
    )
  }

  // Por defecto se buscan alternativas para el mismo día del vuelo cancelado (o para hoy, si ya pasó).
  const hoy = fechaDeHoy()
  const fechaBase = reserva.fecha >= hoy ? reserva.fecha : hoy
  const fecha = esFechaValida(fechaParam) && fechaParam >= hoy ? fechaParam : fechaBase
  const alternativas = await obtenerAlternativas(reserva, fecha)

  const clase = CLASES_PASAJE[reserva.clase as keyof typeof CLASES_PASAJE]?.nombre ?? reserva.clase
  const cantidad = reserva.activos.length
  const anterior = moverDias(fecha, -1)
  const vueloActual = `${reserva.vuelo.codigoVuelo} · ${formatearFecha(reserva.fecha)} · ${reserva.vuelo.horaSalida} hs`

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {volver}

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Mostrador <span className="text-slate-400">›</span> Reubicación <span className="text-slate-400">›</span> Alternativas
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Vuelos alternativos</h1>
        </div>

        {/* Reserva afectada */}
        <section className="rounded-2xl border border-slate-200 border-l-4 border-l-red-400 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-700">Vuelo cancelado</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {reserva.vuelo.codigoVuelo} · {reserva.vuelo.origen} → {reserva.vuelo.destino}
              </p>
              <p className="text-sm text-slate-600">
                {formatearFecha(reserva.fecha)} · {reserva.vuelo.horaSalida} hs · {clase}
              </p>
              {reserva.motivo && <p className="mt-2 text-sm text-slate-600">Motivo: {reserva.motivo}</p>}
            </div>
            <div className="text-sm text-slate-600 sm:text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Titular de la compra</p>
              <p className="mt-1 font-semibold text-slate-800">
                {reserva.user.nombre} {reserva.user.apellido}
              </p>
              <p>{reserva.user.email}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {reserva.activos.map((p) => (
              <span key={p.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {p.nombre} · DNI {p.dni}
              </span>
            ))}
          </div>
        </section>

        {/* Fecha de búsqueda */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {reserva.vuelo.origen} → {reserva.vuelo.destino} · {formatearFecha(fecha)}
            </p>
            <p className="text-xs text-slate-500">
              Se necesitan {cantidad} {cantidad === 1 ? 'lugar' : 'lugares'} en {clase}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {anterior >= hoy ? (
              <Link href={`?fecha=${anterior}`} className={claseNavegacion} aria-label="Día anterior">
                ←
              </Link>
            ) : (
              <span className={`${claseNavegacion} cursor-not-allowed opacity-40`} aria-hidden="true">
                ←
              </span>
            )}
            <form className="flex items-center gap-2">
              <input
                type="date"
                name="fecha"
                min={hoy}
                defaultValue={fecha}
                aria-label="Fecha del vuelo alternativo"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button type="submit" className={claseNavegacion}>
                Ver
              </button>
            </form>
            <Link href={`?fecha=${moverDias(fecha, 1)}`} className={claseNavegacion} aria-label="Día siguiente">
              →
            </Link>
          </div>
        </section>

        {/* Alternativas */}
        {alternativas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No hay vuelos de {reserva.vuelo.origen} a {reserva.vuelo.destino} para el {formatearFecha(fecha)}. Probá con otra fecha.
          </div>
        ) : (
          <div className="space-y-4">
            {alternativas.map((alternativa) => (
              <article
                key={alternativa.id}
                className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${
                  alternativa.sinLugar ? 'border-l-slate-300 opacity-75' : 'border-l-sky-600'
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  SkyLink <span className="text-slate-800">{alternativa.codigoVuelo}</span>
                  <span className="font-medium normal-case tracking-normal"> · {alternativa.tipoAvion}</span>
                </p>

                <div className="mt-3 grid items-center gap-4 sm:grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto]">
                  <div>
                    <p className="text-3xl font-bold tracking-tight text-slate-900">{alternativa.horaSalida}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{alternativa.origen}</p>
                  </div>
                  <div className="px-2 text-center">
                    <p className="text-xs font-medium text-slate-500">{alternativa.duracion ?? 'Duración no disponible'}</p>
                    <div className="my-1.5 flex items-center gap-2" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full bg-sky-700" />
                      <span className="h-px flex-1 bg-slate-300" />
                      <span className="text-sm text-sky-700">✈</span>
                      <span className="h-px flex-1 bg-slate-300" />
                      <span className="h-2 w-2 rounded-full bg-sky-700" />
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-3xl font-bold tracking-tight text-slate-900">{alternativa.horaLlegada}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{alternativa.destino}</p>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:col-span-3 md:col-span-1 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <p className={`text-sm font-semibold ${alternativa.sinLugar ? 'text-red-700' : 'text-emerald-700'}`}>
                      {alternativa.disponibles === null
                        ? 'Lugares disponibles'
                        : `${alternativa.disponibles} ${alternativa.disponibles === 1 ? 'lugar libre' : 'lugares libres'} en ${clase}`}
                    </p>
                    {alternativa.sinLugar ? (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
                        >
                          Sin disponibilidad
                        </button>
                        <p className="max-w-[16rem] text-right text-xs font-medium text-red-700">
                          No es posible reubicar a {cantidad} {cantidad === 1 ? 'pasajero' : 'pasajeros'} en este vuelo.
                        </p>
                      </div>
                    ) : (
                      <ConfirmarReubicacionModal
                        datos={{
                          reservaId: reserva.id,
                          vueloId: alternativa.id,
                          fecha,
                          vueloActual,
                          vueloNuevo: `${alternativa.codigoVuelo} · ${formatearFecha(fecha)} · ${alternativa.horaSalida} hs`,
                          pasajeros: reserva.activos.map((p) => p.nombre),
                        }}
                      />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
