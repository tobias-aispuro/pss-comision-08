import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { validarBusqueda } from '@/lib/search-utils'
import { buscarVuelosDirectos, obtenerOpcionesBusqueda } from '@/lib/vuelos-search'
import TarjetaVuelo, { type VueloResultado } from '@/components/TarjetaVuelo'

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
  return formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
}

function ListaVuelos({
  titulo,
  origen,
  destino,
  fecha,
  vuelos,
  asientos,
  extra,
}: {
  titulo: string
  origen: string
  destino: string
  fecha: string
  vuelos: VueloResultado[]
  asientos: string
  extra?: Record<string, string>
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        {titulo}: {origen} → {destino}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Mostrando {vuelos.length} {vuelos.length === 1 ? 'vuelo directo' : 'vuelos directos'} operados por SkyLink el {formatearFecha(fecha)}
      </p>

      <div className="mt-4 space-y-4">
        {vuelos.map((vuelo, i) => (
          <TarjetaVuelo key={vuelo.id} vuelo={vuelo} fecha={fecha} asientos={asientos} extra={extra} abierta={i === 0} />
        ))}
      </div>
    </section>
  )
}

type ResultadoBusqueda = {
  ida: VueloResultado[]
  vuelta: VueloResultado[]
}

export default async function BusquedaVueloPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['PASAJERO'])

  const params = (await searchParams) ?? {}
  const opciones = await obtenerOpcionesBusqueda(prisma)

  const valores = {
    origen: leerValor(params.origen),
    destino: leerValor(params.destino),
    tipoTramo: leerValor(params.tipoTramo) || 'IDA_VUELTA',
    fechaIda: leerValor(params.fechaIda),
    fechaRegreso: leerValor(params.fechaRegreso),
    asientos: leerValor(params.asientos) || '1',
  }

  const busquedaEjecutada = Object.keys(params).length > 0
  const errores: Record<string, string> = {}
  let resultados: ResultadoBusqueda = { ida: [], vuelta: [] }

  if (busquedaEjecutada) {
    const validacion = validarBusqueda(valores)

    if (!validacion.ok) {
      Object.assign(errores, validacion.errores)
    } else {
      resultados = await buscarVuelosDirectos(prisma, validacion.valores)
    }
  }

  const mostrarRegreso = valores.tipoTramo === 'IDA_VUELTA'
  const hayErrores = Object.keys(errores).length > 0
  const sinResultados =
    busquedaEjecutada &&
    !hayErrores &&
    resultados.ida.length === 0 &&
    (!mostrarRegreso || resultados.vuelta.length === 0)

  // Los radios de tramo están fuera del <form> (form="busqueda-vuelos"); el estado activo se pinta con :checked.
  const tramoClass =
    'flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 has-[:checked]:bg-sky-600 has-[:checked]:text-white has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300'

  const panelInputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100'

  return (
    <main className="min-h-screen bg-[#edf3f6] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1220px]">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="group/tramo rounded-[28px] bg-[#f8fafc] p-4 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <label className={tramoClass}>
                  <input type="radio" form="busqueda-vuelos" name="tipoTramo" value="IDA_VUELTA" defaultChecked={valores.tipoTramo === 'IDA_VUELTA'} className="sr-only" />
                  Ida y vuelta
                </label>

                <label className={tramoClass}>
                  <input type="radio" form="busqueda-vuelos" name="tipoTramo" value="IDA" defaultChecked={valores.tipoTramo === 'IDA'} className="sr-only" />
                  Solo ida
                </label>
              </div>

              <div className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-500 md:flex">
                <span>Tarifas</span>
                <span>•</span>
                <span>Tiempo de viaje</span>
              </div>
            </div>

            <form id="busqueda-vuelos" method="GET" action="/pasajero/busquedaVuelo" className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_auto]">
                <div>
                  <label htmlFor="origen" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Origen
                  </label>
                  <select id="origen" name="origen" defaultValue={valores.origen} className={panelInputClass}>
                    <option value="">Seleccionar</option>
                    {opciones.origenes.map((origen) => (
                      <option key={origen} value={origen}>
                        {origen}
                      </option>
                    ))}
                  </select>
                  {errores.origen && <p className="mt-2 text-sm text-rose-600">{errores.origen}</p>}
                </div>

                <div>
                  <label htmlFor="destino" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Destino
                  </label>
                  <select id="destino" name="destino" defaultValue={valores.destino} className={panelInputClass}>
                    <option value="">Seleccionar</option>
                    {opciones.destinos.map((destino) => (
                      <option key={destino} value={destino}>
                        {destino}
                      </option>
                    ))}
                  </select>
                  {errores.destino && <p className="mt-2 text-sm text-rose-600">{errores.destino}</p>}
                </div>

                <div>
                  <label htmlFor="fechaIda" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Ida
                  </label>
                  <input id="fechaIda" name="fechaIda" type="date" defaultValue={valores.fechaIda} className={panelInputClass} />
                  {errores.fechaIda && <p className="mt-2 text-sm text-rose-600">{errores.fechaIda}</p>}
                </div>

                {/* Se oculta con CSS al elegir "Solo ida", sin esperar a que se vuelva a buscar */}
                <div className="group-has-[input[value=IDA]:checked]/tramo:hidden">
                  <label htmlFor="fechaRegreso" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Regreso
                  </label>
                  <input id="fechaRegreso" name="fechaRegreso" type="date" defaultValue={valores.fechaRegreso} className={panelInputClass} />
                  {errores.fechaRegreso && <p className="mt-2 text-sm text-rose-600">{errores.fechaRegreso}</p>}
                </div>

                <div>
                  <label htmlFor="asientos" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Asientos
                  </label>
                  <input id="asientos" name="asientos" type="number" min={1} max={9} defaultValue={valores.asientos} className={panelInputClass} />
                  {errores.asientos && <p className="mt-2 text-sm text-rose-600">{errores.asientos}</p>}
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(14,116,144,0.24)] transition hover:bg-sky-700"
                  >
                    Actualizar
                  </button>
                </div>
              </div>
            </form>

            {busquedaEjecutada && (
              <div className="mt-8 space-y-8">
                {hayErrores && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    Revisá los campos para completar la búsqueda correctamente.
                  </div>
                )}

                {!hayErrores && sinResultados && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-base font-medium text-slate-700 shadow-sm">
                    No existen vuelos que satisfagan la búsqueda. Probá con otros datos.
                  </div>
                )}

                {!hayErrores && resultados.ida.length > 0 && (
                  <ListaVuelos
                    titulo="Vuelos de ida disponibles"
                    origen={valores.origen}
                    destino={valores.destino}
                    fecha={valores.fechaIda}
                    vuelos={resultados.ida}
                    asientos={valores.asientos}
                    extra={mostrarRegreso && valores.fechaRegreso ? { regreso: valores.fechaRegreso } : {}}
                  />
                )}

                {!hayErrores && mostrarRegreso && resultados.vuelta.length > 0 && (
                  <ListaVuelos
                    titulo="Vuelos de vuelta disponibles"
                    origen={valores.destino}
                    destino={valores.origen}
                    fecha={valores.fechaRegreso}
                    vuelos={resultados.vuelta}
                    asientos={valores.asientos}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
