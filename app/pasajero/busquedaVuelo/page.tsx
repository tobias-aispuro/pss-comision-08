import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { validarBusqueda } from '@/lib/search-utils'
import { buscarVuelosDirectos, obtenerOpcionesBusqueda } from '@/lib/vuelos-search'
import OpcionesTarifa from '@/components/OpcionesTarifa'

function leerValor(valor: string | string[] | undefined) {
  if (Array.isArray(valor)) {
    return valor[0] ?? ''
  }

  return valor ?? ''
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

type ResultadoBusqueda = {
  ida: Array<Record<string, any>>
  vuelta: Array<Record<string, any>>
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
          <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 text-slate-700">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-100 text-sm font-bold text-sky-700">
                  ✈
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight text-sky-700">SkyLink</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">Buscar vuelos</span>
                <Link href="/pasajero/reservas" className="rounded-full px-2.5 py-1 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">Mis reservas</Link>
                <span className="rounded-full px-2.5 py-1 font-medium text-slate-500">Check-in online</span>
                <span className="rounded-full px-2.5 py-1 font-medium text-slate-500">Estado de vuelo</span>
              </div>
            </div>
          </div>

          <div className="group/tramo rounded-b-[28px] bg-[#f8fafc] p-4 md:p-6">
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
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-xl font-bold text-slate-800">Vuelos de ida</h2>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                        {resultados.ida.length} resultado{resultados.ida.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {resultados.ida.map((vuelo) => (
                        <article key={vuelo.codigoVuelo} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Vuelo</p>
                              <h3 className="mt-1 text-2xl font-bold text-slate-900">{vuelo.codigoVuelo}</h3>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                              {formatearPrecio(vuelo.precioDesde)}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr]">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Origen</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.origen}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Destino</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.destino}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaSalida}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Llegada</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaLlegada}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span className="rounded-full bg-white px-2.5 py-1 font-medium">Duración: {vuelo.duracion ?? 'No disponible'}</span>
                            <span className="rounded-full bg-white px-2.5 py-1 font-medium">Precio desde: {formatearPrecio(vuelo.precioDesde)}</span>
                          </div>
                        <OpcionesTarifa
                            vuelo={vuelo}
                            fecha={valores.fechaIda}
                            asientos={valores.asientos}
                            extra={mostrarRegreso && valores.fechaRegreso ? { regreso: valores.fechaRegreso } : {}}
                          />
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {!hayErrores && mostrarRegreso && resultados.vuelta.length > 0 && (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-xl font-bold text-slate-800">Vuelos de vuelta</h2>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                        {resultados.vuelta.length} resultado{resultados.vuelta.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {resultados.vuelta.map((vuelo) => (
                        <article key={vuelo.codigoVuelo} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Vuelo</p>
                              <h3 className="mt-1 text-2xl font-bold text-slate-900">{vuelo.codigoVuelo}</h3>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                              {formatearPrecio(vuelo.precioDesde)}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr]">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Origen</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.origen}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Destino</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.destino}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Salida</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaSalida}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Llegada</p>
                              <p className="mt-1 text-lg font-semibold text-slate-800">{vuelo.horaLlegada}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span className="rounded-full bg-white px-2.5 py-1 font-medium">Duración: {vuelo.duracion ?? 'No disponible'}</span>
                            <span className="rounded-full bg-white px-2.5 py-1 font-medium">Precio desde: {formatearPrecio(vuelo.precioDesde)}</span>
                          </div>
                        <OpcionesTarifa vuelo={vuelo} fecha={valores.fechaRegreso} asientos={valores.asientos} />
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
