import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import {
  CLASES_PASAJE,
  PASAJES_MAX,
  asientosDisponibles,
  calcularEdad,
  validarSalida,
} from '@/lib/compra-utils'
import DatosPasajerosForm from '@/components/DatosPasajerosForm'

function leerValor(valor: string | string[] | undefined) {
  if (Array.isArray(valor)) {
    return valor[0] ?? ''
  }

  return valor ?? ''
}

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

function formatearPrecio(precio: number | null | undefined) {
  if (precio === null || precio === undefined) {
    return 'Precio no disponible'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default async function CompraPasajesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireRole(['PASAJERO'])

  const params = (await searchParams) ?? {}
  const vueloId = leerValor(params.vueloId)
  const fecha = leerValor(params.fecha)
  const clase = leerValor(params.clase)
  const asientosBuscados = Number(leerValor(params.asientos)) || 1
  // Ida y vuelta: `regreso` llega al comprar la ida; `ida` (id de esa reserva) al comprar la vuelta.
  const regreso = leerValor(params.regreso)
  const idaId = leerValor(params.ida)

  const reservaIda = idaId
    ? await prisma.reserva.findFirst({
        where: { id: idaId, userId: user.id },
        include: { pasajeros: { where: { canceladoAt: null }, orderBy: { createdAt: 'asc' } } },
      })
    : null

  const vuelo = vueloId
    ? await prisma.vuelo.findUnique({
        where: { id: vueloId },
        include: { cancelaciones: { where: { fecha }, select: { fecha: true } } },
      })
    : null

  const errorSalida = validarSalida(vuelo, fecha, clase, vuelo?.cancelaciones.map((c) => c.fecha))

  let disponibles: number | null = null
  if (!errorSalida && vuelo) {
    const reservados = await prisma.reserva.aggregate({
      _sum: { asientos: true },
      where: { vueloId: vuelo.id, fecha, clase, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
    })
    disponibles = asientosDisponibles(vuelo, clase, reservados._sum.asientos ?? 0)
  }

  const error = errorSalida ?? (disponibles === 0 ? 'No quedan asientos disponibles en esta clase para la fecha elegida.' : null)
  const maxPasajes = disponibles === null ? PASAJES_MAX : Math.min(PASAJES_MAX, disponibles)

  const urlVolver = reservaIda
    ? `/pasajero/compra/${reservaIda.id}?${new URLSearchParams({ regreso: fecha })}`
    : vuelo
      ? `/pasajero/busquedaVuelo?${new URLSearchParams({
          origen: vuelo.origen,
          destino: vuelo.destino,
          asientos: String(asientosBuscados),
          ...(regreso ? { tipoTramo: 'IDA_VUELTA', fechaIda: fecha, fechaRegreso: regreso } : { tipoTramo: 'IDA', fechaIda: fecha }),
        })}`
      : '/pasajero/busquedaVuelo'

  const pasajerosIniciales = reservaIda
    ? reservaIda.pasajeros.map((p) => ({ dni: p.dni, nombre: p.nombre, edad: String(p.edad), telefono: p.telefono }))
    : [
        {
          dni: user.dni,
          nombre: `${user.nombre} ${user.apellido}`,
          edad: String(calcularEdad(user.fechaNacimiento)),
          telefono: user.telefono,
        },
      ]

  const datosClase = CLASES_PASAJE[clase as keyof typeof CLASES_PASAJE]
  const precioUnitario: number | null = vuelo && datosClase ? (vuelo[datosClase.precio as 'precioEconomy' | 'precioPrimera'] ?? null) : null

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-6 md:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
              Compra de pasajes{regreso ? ' · Tramo de ida' : reservaIda ? ' · Tramo de vuelta' : ''}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Datos de los pasajeros</h2>

            {vuelo && !errorSalida && (
              <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Vuelo</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.codigoVuelo}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Ruta</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">
                    {vuelo.origen} → {vuelo.destino}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">
                    {formatearFecha(fecha)} · {vuelo.horaSalida}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Clase</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">
                    {datosClase?.nombre} · <span className="text-sky-700">{formatearPrecio(precioUnitario)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {error ? (
            <div className="space-y-5 p-6 md:p-8">
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                {error}
              </div>
              <Link
                href={urlVolver}
                className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700"
              >
                Volver a la búsqueda
              </Link>
            </div>
          ) : (
            <DatosPasajerosForm
              vueloId={vueloId}
              fecha={fecha}
              clase={clase}
              cantidadInicial={reservaIda ? reservaIda.pasajeros.length : asientosBuscados}
              maxPasajes={maxPasajes}
              precioUnitario={precioUnitario}
              urlVolver={urlVolver}
              pasajerosIniciales={pasajerosIniciales}
              regreso={reservaIda ? '' : regreso}
              idaId={reservaIda?.id ?? ''}
            />
          )}
        </div>
      </div>
    </main>
  )
}
