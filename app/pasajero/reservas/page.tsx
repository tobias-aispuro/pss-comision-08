import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { CLASES_PASAJE } from '@/lib/compra-utils'
import { evaluarCancelacion } from '@/lib/reserva-cancelacion-utils'
import CancelarPasajeModal from '@/components/CancelarPasajeModal'

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const formatoLimite = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
})

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const texto = formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const estados = {
  PENDIENTE: { texto: 'Pendiente de pago', clase: 'bg-amber-50 text-amber-700' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { texto: 'Cancelada', clase: 'bg-red-50 text-red-700' },
}

export default async function MisReservasPage({
  searchParams,
}: {
  searchParams?: Promise<{ cancelada?: string }>
}) {
  const user = await requireRole(['PASAJERO'])
  const { cancelada } = (await searchParams) ?? {}

  const reservas = await prisma.reserva.findMany({
    where: { userId: user.id },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    include: { vuelo: true, pasajeros: { orderBy: { createdAt: 'asc' } } },
  })

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        {cancelada && (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
            ✓ Tu pasaje del vuelo {cancelada} fue cancelado correctamente.
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Pasajero</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Mis reservas</h2>
          </div>
          <p className="text-sm text-slate-500">Podés cancelar tu pasaje hasta 48 horas antes del despegue.</p>
        </div>

        {reservas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Todavía no tenés reservas.{' '}
            <Link href="/pasajero/busquedaVuelo" className="font-semibold text-sky-700 hover:underline">
              Buscá un vuelo
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-4">
            {reservas.map((reserva) => {
              const estado = estados[reserva.estado]
              const nombreClase = CLASES_PASAJE[reserva.clase as keyof typeof CLASES_PASAJE]?.nombre ?? reserva.clase
              const miPasaje = reserva.pasajeros.find((p) => p.dni === user.dni)
              const evaluacion = evaluarCancelacion(
                { reserva, vuelo: reserva.vuelo, pasajeros: reserva.pasajeros, dniTitular: user.dni }
              )
              const limite = evaluacion.limite ? `${formatoLimite.format(evaluacion.limite)} hs (hora de Argentina)` : ''
              const acompanantes = reserva.pasajeros.filter((p) => !p.canceladoAt && p.dni !== user.dni).length

              return (
                <article key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="grid flex-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Vuelo</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{reserva.vuelo.codigoVuelo}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Ruta</p>
                        <p className="mt-1 text-lg font-semibold text-slate-800">
                          {reserva.vuelo.origen} → {reserva.vuelo.destino}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                        <p className="mt-1 text-lg font-semibold text-slate-800">
                          {formatearFecha(reserva.fecha)} · {reserva.vuelo.horaSalida}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Clase</p>
                        <p className="mt-1 text-lg font-semibold text-slate-800">
                          {nombreClase} · {reserva.asientos} {reserva.asientos === 1 ? 'pasaje' : 'pasajes'}
                        </p>
                      </div>
                    </div>

                    <span className={`self-start rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </div>

                  {reserva.pasajeros.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                      {reserva.pasajeros.map((p) => (
                        <span
                          key={p.id}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            p.canceladoAt ? 'bg-red-50 text-red-700 line-through' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.nombre}
                          {p.dni === user.dni && ' (vos)'}
                          {p.canceladoAt && ' · cancelado'}
                        </span>
                      ))}
                    </div>
                  )}

                  {miPasaje && reserva.estado !== 'CANCELADA' && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-600">
                        {miPasaje.canceladoAt
                          ? 'Cancelaste tu pasaje en esta reserva.'
                          : evaluacion.ok
                            ? `Podés cancelar tu pasaje hasta el ${limite}.`
                            : 'Tu pasaje está activo.'}
                      </p>
                      {!miPasaje.canceladoAt && (
                        <CancelarPasajeModal
                          reserva={{
                            id: reserva.id,
                            codigoVuelo: reserva.vuelo.codigoVuelo,
                            ruta: `${reserva.vuelo.origen} → ${reserva.vuelo.destino}`,
                            salida: `${formatearFecha(reserva.fecha)} · ${reserva.vuelo.horaSalida}`,
                            limite,
                            titular: miPasaje.nombre,
                            acompanantes,
                          }}
                          bloqueo={evaluacion.ok ? null : evaluacion.motivo}
                        />
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
