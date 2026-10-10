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
import { calcularDuracionMinutos, formatearDuracion } from '@/lib/vuelos-search'
import DatosPasajerosForm from '@/components/DatosPasajerosForm'

const pasos = ['Elegí tu vuelo', 'Datos de los pasajeros', 'Pago']

function PasosCompra() {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {pasos.map((paso, i) => {
        const estado = i === 0 ? 'hecho' : i === 1 ? 'actual' : 'pendiente'
        return (
          <li key={paso} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-slate-300 sm:w-10" aria-hidden="true" />}
            <span
              aria-current={estado === 'actual' ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ${
                estado === 'actual'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : estado === 'hecho'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-white text-slate-400'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  estado === 'actual' ? 'bg-white text-sky-700' : estado === 'hecho' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {estado === 'hecho' ? '✓' : i + 1}
              </span>
              {paso}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

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

  const duracion = vuelo ? formatearDuracion(calcularDuracionMinutos(vuelo, fecha)) : null
  const tramo = regreso ? 'Tramo de ida' : reservaIda ? 'Tramo de vuelta' : null

  return (
    <main className="min-h-screen bg-[#edf3f6] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1220px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
              Compra de pasajes{tramo ? ` · ${tramo}` : ''}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Datos de los pasajeros</h2>
          </div>
          <PasosCompra />
        </div>

        {vuelo && !errorSalida && (
          <section className="overflow-hidden rounded-[24px] border border-slate-200 border-l-4 border-l-sky-600 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                SkyLink <span className="text-slate-800">{vuelo.codigoVuelo}</span>
                <span className="font-medium normal-case tracking-normal"> · {vuelo.tipoAvion}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatearFecha(fecha)}</span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  {datosClase?.nombre} · {formatearPrecio(precioUnitario)} por pasajero
                </span>
              </div>
            </div>

            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr_auto]">
              <div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{vuelo.horaSalida}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{vuelo.origen}</p>
              </div>
              <div className="px-2 text-center">
                <p className="text-xs font-medium text-slate-500">{duracion ?? 'Duración no disponible'}</p>
                <div className="my-1.5 flex items-center gap-2" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-sky-700" />
                  <span className="h-px flex-1 bg-slate-300" />
                  <span className="text-sm text-sky-700">✈</span>
                  <span className="h-px flex-1 bg-slate-300" />
                  <span className="h-2 w-2 rounded-full bg-sky-700" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">Vuelo directo</p>
              </div>
              <div className="sm:text-right">
                <p className="text-3xl font-bold tracking-tight text-slate-900">{vuelo.horaLlegada}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{vuelo.destino}</p>
              </div>
            </div>
          </section>
        )}

        {error ? (
          <div className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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
    </main>
  )
}
