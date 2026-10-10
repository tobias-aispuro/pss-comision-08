import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { CLASES_PASAJE } from '@/lib/compra-utils'
import { esFechaValida } from '@/lib/search-utils'
import { buscarVuelosDirectos } from '@/lib/vuelos-search'
import OpcionesTarifa from '@/components/OpcionesTarifa'

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const texto = formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

type ReservaConVuelo = {
  fecha: string
  clase: string
  asientos: number
  vuelo: { codigoVuelo: string; origen: string; destino: string; horaSalida: string }
}

function ResumenTramo({ titulo, reserva }: { titulo?: string; reserva: ReservaConVuelo }) {
  const nombreClase = CLASES_PASAJE[reserva.clase as keyof typeof CLASES_PASAJE]?.nombre ?? reserva.clase

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {titulo && (
        <p className="mb-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
          {titulo}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Vuelo</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{reserva.vuelo.codigoVuelo}</p>
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
    </div>
  )
}

type VueloVuelta = {
  id: string
  codigoVuelo: string
  horaSalida: string
  horaLlegada: string
  duracion: string | null
  clasesDisponibles: string[]
  precioEconomy: number | null
  precioPrimera: number | null
}

const estados = {
  PENDIENTE: { texto: 'Pendiente de pago', clase: 'bg-amber-50 text-amber-700' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { texto: 'Cancelada', clase: 'bg-red-50 text-red-700' },
}

export default async function ReservaPasajerosPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>
  searchParams?: Promise<{ guardado?: string; regreso?: string; ida?: string }>
}) {
  const user = await requireRole(['PASAJERO'])
  const { reservaId } = await params
  const { guardado, regreso = '', ida = '' } = (await searchParams) ?? {}

  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { vuelo: true, pasajeros: { orderBy: { createdAt: 'asc' } } },
  })
  if (!reserva || reserva.userId !== user.id) notFound()

  const estado = estados[reserva.estado]

  // Viaje de ida y vuelta: si se viene de comprar la vuelta se muestran los dos tramos;
  // si se acaba de comprar la ida, se ofrecen los vuelos de vuelta para la fecha de regreso buscada.
  const reservaIda = ida
    ? await prisma.reserva.findFirst({ where: { id: ida, userId: user.id }, include: { vuelo: true } })
    : null
  const eligiendoVuelta = !reservaIda && esFechaValida(regreso) && regreso >= reserva.fecha
  const vuelosVuelta: VueloVuelta[] = eligiendoVuelta
    ? (
        await buscarVuelosDirectos(prisma, {
          origen: reserva.vuelo.destino,
          destino: reserva.vuelo.origen,
          fechaIda: regreso,
          tipoTramo: 'IDA',
          asientos: reserva.asientos,
        })
      ).ida
    : []

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        {guardado === '1' && (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
            ✓ Los datos {reserva.pasajeros.length === 1 ? 'del pasajero se guardaron' : `de los ${reserva.pasajeros.length} pasajeros se guardaron`} correctamente.
          </div>
        )}

        <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Compra de pasajes</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Resumen de la compra</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${estado.clase}`}>
                {estado.texto}
              </span>
            </div>

            {reservaIda ? (
              <>
                <ResumenTramo titulo="Ida" reserva={reservaIda} />
                <ResumenTramo titulo="Vuelta" reserva={reserva} />
              </>
            ) : (
              <ResumenTramo titulo={eligiendoVuelta ? 'Ida' : undefined} reserva={reserva} />
            )}
          </div>

          <div className="space-y-7 p-6 md:p-8">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                  ✓
                </span>
                <h3 className="text-lg font-bold text-slate-800">Pasajeros registrados</h3>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Nombre</th>
                      <th className="px-5 py-3">DNI</th>
                      <th className="px-5 py-3">Edad</th>
                      <th className="px-5 py-3">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reserva.pasajeros.map((p, i) => (
                      <tr key={p.id}>
                        <td className="px-5 py-4 font-semibold text-slate-800">{i + 1}</td>
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {p.nombre}
                          {p.canceladoAt && (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700">
                              Cancelado
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{p.dni}</td>
                        <td className="px-5 py-4 text-slate-600">{p.edad}</td>
                        <td className="px-5 py-4 text-slate-600">{p.telefono}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {eligiendoVuelta && (
              <section className="rounded-2xl border-2 border-sky-500 bg-sky-50/40 p-5 md:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                      2
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Ahora elegí tu vuelo de vuelta</h3>
                      <p className="text-sm text-slate-600">
                        {reserva.vuelo.destino} → {reserva.vuelo.origen} · {formatearFecha(regreso)}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Los pasajeros se cargan automáticamente
                  </span>
                </div>

                {vuelosVuelta.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700">
                    No hay vuelos de vuelta disponibles para esa fecha con {reserva.asientos}{' '}
                    {reserva.asientos === 1 ? 'asiento' : 'asientos'}.{' '}
                    <Link href="/pasajero/busquedaVuelo" className="font-semibold text-sky-700 hover:underline">
                      Buscá otra fecha
                    </Link>
                    .
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vuelosVuelta.map((vuelo) => (
                      <article key={vuelo.codigoVuelo} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr]">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Vuelo</p>
                            <p className="mt-1 text-lg font-semibold text-slate-900">{vuelo.codigoVuelo}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                            <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaSalida}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Llegada</p>
                            <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaLlegada}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Duración</p>
                            <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.duracion ?? 'No disponible'}</p>
                          </div>
                        </div>
                        <OpcionesTarifa
                          vuelo={vuelo}
                          fecha={regreso}
                          asientos={String(reserva.asientos)}
                          extra={{ ida: reserva.id }}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-500">
                El pago de los pasajes se habilitará próximamente.
              </p>
              <div className="flex items-center justify-end gap-3">
                <Link
                  href="/pasajero/reservas"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Ver mis reservas
                </Link>
                <Link
                  href="/pasajero/busquedaVuelo"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Buscar otro vuelo
                </Link>
                <span
                  aria-disabled="true"
                  title="Disponible próximamente"
                  className="cursor-not-allowed rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white opacity-60"
                >
                  Continuar al pago
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
