import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { leerFiltros, validarBusqueda } from '@/lib/search-utils'
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
  clases,
}: {
  titulo: string
  origen: string
  destino: string
  fecha: string
  vuelos: VueloResultado[]
  asientos: string
  extra?: Record<string, string>
  clases: string[]
}) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
        {titulo}: {origen} → {destino}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Mostrando {vuelos.length} {vuelos.length === 1 ? 'vuelo directo' : 'vuelos directos'} operados por SkyLink el {formatearFecha(fecha)}
      </p>

      <div className="mt-4 space-y-4">
        {vuelos.map((vuelo, i) => (
          <TarjetaVuelo key={vuelo.id} vuelo={vuelo} fecha={fecha} asientos={asientos} extra={extra} abierta={i === 0} clases={clases} />
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
  const filtros = leerFiltros(params)
  const filtrosActivos = filtros.clases.length < 2 || filtros.precioMax !== null || filtros.orden !== 'PRECIO'

  const busquedaEjecutada = Boolean(params.origen || params.destino || params.fechaIda)
  const errores: Record<string, string> = {}
  let resultados: ResultadoBusqueda = { ida: [], vuelta: [] }

  if (busquedaEjecutada) {
    const validacion = validarBusqueda(valores)

    if (!validacion.ok) {
      Object.assign(errores, validacion.errores)
    } else {
      resultados = await buscarVuelosDirectos(prisma, validacion.valores, filtros)
    }
  }

  const mostrarRegreso = valores.tipoTramo === 'IDA_VUELTA'
  const hayErrores = Object.keys(errores).length > 0
  const sinResultados =
    busquedaEjecutada &&
    !hayErrores &&
    resultados.ida.length === 0 &&
    (!mostrarRegreso || resultados.vuelta.length === 0)

  // Parámetros de la búsqueda actual, para conservarlos al aplicar filtros (y viceversa).
  const busquedaActual = Object.entries(valores).filter(([, valor]) => valor)
  const urlSinFiltros = `/pasajero/busquedaVuelo?${new URLSearchParams(busquedaActual)}`

  // Los radios de tramo están fuera del <form> (form="busqueda-vuelos"); el estado activo se pinta con :checked.
  const tramoClass =
    'flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 has-[:checked]:bg-sky-600 has-[:checked]:text-white has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-300'

  const tileClass =
    'block rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-sky-500 focus-within:bg-white focus-within:ring-3 focus-within:ring-sky-100'
  const tileLabelClass = 'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500'
  const tileInputClass = 'mt-0.5 w-full bg-transparent text-base font-semibold text-slate-800 outline-none'

  return (
    <main className="min-h-screen bg-[#edf3f6] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1220px] space-y-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Pasajero</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Buscá tu próximo vuelo</h2>
        </div>

        <section className="group/tramo rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <label className={tramoClass}>
                <input type="radio" form="busqueda-vuelos" name="tipoTramo" value="IDA_VUELTA" defaultChecked={valores.tipoTramo === 'IDA_VUELTA'} className="sr-only" />
                ⇄ Ida y vuelta
              </label>
              <label className={tramoClass}>
                <input type="radio" form="busqueda-vuelos" name="tipoTramo" value="IDA" defaultChecked={valores.tipoTramo === 'IDA'} className="sr-only" />
                → Solo ida
              </label>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                Tarifas en tiempo real
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">Vuelos directos</span>
            </div>
          </div>

          <form id="busqueda-vuelos" method="GET" action="/pasajero/busquedaVuelo">
            {/* Conserva los filtros aplicados al cambiar la búsqueda */}
            {filtros.clases.length < 2 && filtros.clases.map((clase) => <input key={clase} type="hidden" name="clase" value={clase} />)}
            {filtros.precioMax !== null && <input type="hidden" name="precioMax" value={filtros.precioMax} />}
            {filtros.orden !== 'PRECIO' && <input type="hidden" name="orden" value={filtros.orden} />}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_0.7fr_auto]">
              <div>
                <label className={tileClass}>
                  <span className={tileLabelClass}>🛫 Origen</span>
                  <select name="origen" defaultValue={valores.origen} className={tileInputClass}>
                    <option value="">Seleccionar</option>
                    {opciones.origenes.map((origen) => (
                      <option key={origen} value={origen}>
                        {origen}
                      </option>
                    ))}
                  </select>
                </label>
                {errores.origen && <p className="mt-1.5 text-sm text-rose-600">{errores.origen}</p>}
              </div>

              <div>
                <label className={tileClass}>
                  <span className={tileLabelClass}>🛬 Destino</span>
                  <select name="destino" defaultValue={valores.destino} className={tileInputClass}>
                    <option value="">Seleccionar</option>
                    {opciones.destinos.map((destino) => (
                      <option key={destino} value={destino}>
                        {destino}
                      </option>
                    ))}
                  </select>
                </label>
                {errores.destino && <p className="mt-1.5 text-sm text-rose-600">{errores.destino}</p>}
              </div>

              <div>
                <label className={tileClass}>
                  <span className={tileLabelClass}>📅 Ida</span>
                  <input name="fechaIda" type="date" defaultValue={valores.fechaIda} className={tileInputClass} />
                </label>
                {errores.fechaIda && <p className="mt-1.5 text-sm text-rose-600">{errores.fechaIda}</p>}
              </div>

              {/* Se oculta con CSS al elegir "Solo ida", sin esperar a que se vuelva a buscar */}
              <div className="group-has-[input[value=IDA]:checked]/tramo:hidden">
                <label className={tileClass}>
                  <span className={tileLabelClass}>📅 Regreso</span>
                  <input name="fechaRegreso" type="date" defaultValue={valores.fechaRegreso} className={tileInputClass} />
                </label>
                {errores.fechaRegreso && <p className="mt-1.5 text-sm text-rose-600">{errores.fechaRegreso}</p>}
              </div>

              <div>
                <label className={tileClass}>
                  <span className={tileLabelClass}>👤 Asientos</span>
                  <input name="asientos" type="number" min={1} max={9} defaultValue={valores.asientos} className={tileInputClass} />
                </label>
                {errores.asientos && <p className="mt-1.5 text-sm text-rose-600">{errores.asientos}</p>}
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(14,116,144,0.24)] transition hover:bg-sky-700 md:col-span-2 xl:col-span-1"
              >
                <span aria-hidden="true">🔍</span> Buscar vuelos
              </button>
            </div>
          </form>
        </section>

        {!busquedaEjecutada && (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <p className="text-3xl" aria-hidden="true">✈</p>
            <p className="mt-3 text-lg font-bold text-slate-800">Elegí origen, destino y fecha para empezar</p>
            <p className="mt-1 text-sm text-slate-500">Te mostramos los vuelos directos disponibles con sus tarifas por clase.</p>
          </div>
        )}

        {busquedaEjecutada && hayErrores && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Revisá los campos marcados para completar la búsqueda.
          </div>
        )}

        {busquedaEjecutada && !hayErrores && (
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            {/* Filtros de vuelo */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              <form method="GET" action="/pasajero/busquedaVuelo" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                {busquedaActual.map(([nombre, valor]) => (
                  <input key={nombre} type="hidden" name={nombre} value={valor} />
                ))}

                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">Filtros de vuelo</h3>
                  {filtrosActivos && (
                    <Link href={urlSinFiltros} className="text-xs font-semibold text-sky-700 hover:underline">
                      Restablecer
                    </Link>
                  )}
                </div>

                <fieldset className="mt-5">
                  <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Clase de cabina</legend>
                  <div className="mt-2 space-y-2">
                    {[
                      { clase: 'ECONOMY', nombre: 'Economy' },
                      { clase: 'PRIMERA', nombre: 'Primera' },
                    ].map(({ clase, nombre }) => (
                      <label
                        key={clase}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50"
                      >
                        <input type="checkbox" name="clase" value={clase} defaultChecked={filtros.clases.includes(clase)} className="h-4 w-4 accent-sky-600" />
                        {nombre}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5">
                  <label htmlFor="precioMax" className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Precio máximo por pasajero
                  </label>
                  <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-sky-500 focus-within:bg-white focus-within:ring-3 focus-within:ring-sky-100">
                    <span className="text-sm font-semibold text-slate-500">$</span>
                    <input
                      id="precioMax"
                      name="precioMax"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Sin límite"
                      defaultValue={filtros.precioMax ?? ''}
                      className="w-full bg-transparent px-2 py-2.5 text-sm font-semibold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <fieldset className="mt-5">
                  <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ordenar por</legend>
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    {[
                      { orden: 'PRECIO', nombre: 'Más barato' },
                      { orden: 'HORARIO', nombre: 'Horario' },
                    ].map(({ orden, nombre }) => (
                      <label
                        key={orden}
                        className="cursor-pointer rounded-lg px-2 py-2 text-center text-xs font-semibold text-slate-600 transition has-[:checked]:bg-white has-[:checked]:text-sky-700 has-[:checked]:shadow-sm"
                      >
                        <input type="radio" name="orden" value={orden} defaultChecked={filtros.orden === orden} className="sr-only" />
                        {nombre}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="mt-5 w-full rounded-xl bg-[#046A7A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#318098]"
                >
                  Aplicar filtros
                </button>
              </form>

              <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5 text-sm">
                <p className="font-bold text-sky-800">Cancelación flexible</p>
                <p className="mt-1 text-sky-900/80">Podés cancelar tu reserva desde Mis reservas hasta 48 horas antes del despegue.</p>
              </div>
            </aside>

            <div className="space-y-8">
              {sinResultados && (
                <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-lg font-bold text-slate-800">No encontramos vuelos para esta búsqueda</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {filtrosActivos ? 'Probá quitando algunos filtros o cambiando la fecha.' : 'Probá con otra fecha u otro destino.'}
                  </p>
                  {filtrosActivos && (
                    <Link href={urlSinFiltros} className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Quitar filtros
                    </Link>
                  )}
                </div>
              )}

              {resultados.ida.length > 0 && (
                <ListaVuelos
                  titulo="Vuelos de ida disponibles"
                  origen={valores.origen}
                  destino={valores.destino}
                  fecha={valores.fechaIda}
                  vuelos={resultados.ida}
                  asientos={valores.asientos}
                  extra={mostrarRegreso && valores.fechaRegreso ? { regreso: valores.fechaRegreso } : {}}
                  clases={filtros.clases}
                />
              )}

              {mostrarRegreso && resultados.vuelta.length > 0 && (
                <ListaVuelos
                  titulo="Vuelos de vuelta disponibles"
                  origen={valores.destino}
                  destino={valores.origen}
                  fecha={valores.fechaRegreso}
                  vuelos={resultados.vuelta}
                  asientos={valores.asientos}
                  clases={filtros.clases}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
