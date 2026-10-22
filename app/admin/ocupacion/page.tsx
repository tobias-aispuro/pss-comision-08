import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { fechaDeHoy } from '@/lib/search-utils'
import { consultarOcupacionVuelo } from '@/lib/ocupacion-vuelo'

function leerParametro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? ''
}

function mostrarPorcentaje(valor: number | null) {
  return valor === null
    ? '—'
    : `${valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
}

function limitarAncho(valor: number | null) {
  return valor === null ? 0 : Math.min(Math.max(valor, 0), 100)
}

export default async function OcupacionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['ADMINISTRADOR'])

  const params = (await searchParams) ?? {}
  const vueloId = leerParametro(params.vuelo)
  const fechaParametro = leerParametro(params.fecha)
  const fechaInicial = fechaParametro || fechaDeHoy()
  const vuelos = await prisma.vuelo.findMany({
    orderBy: { codigoVuelo: 'asc' },
    select: {
      id: true,
      codigoVuelo: true,
      origen: true,
      destino: true,
      horaSalida: true,
    },
  })
  const resultado = vueloId && fechaParametro
    ? await consultarOcupacionVuelo(prisma, vueloId, fechaParametro)
    : null
  const resultadoOk = resultado?.estado === 'OK' ? resultado : null
  const total = resultadoOk?.total ?? null
  const porcentajeTotal = total ? limitarAncho(total.factor) : 0
  const porcentajeVendidos = total && total.capacidad > 0 ? (total.vendidos / total.capacidad) * 100 : 0
  const porcentajeLibres = total && total.capacidad > 0 ? (total.libres / total.capacidad) * 100 : 0

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Consulta de Ocupación por Vuelo</h1>
            <p className="mt-1 text-sm text-slate-500">Consultá el inventario de asientos para una salida específica.</p>
          </div>
          <form method="GET" className="grid gap-4 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Vuelo
              <select
                name="vuelo"
                required
                defaultValue={vueloId}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="" disabled>Seleccioná un vuelo</option>
                {vuelos.map((vuelo) => (
                  <option key={vuelo.id} value={vuelo.id}>
                    {vuelo.codigoVuelo} · {vuelo.origen} → {vuelo.destino} · {vuelo.horaSalida}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Fecha
              <input
                name="fecha"
                type="date"
                required
                defaultValue={fechaInicial}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-[#00677d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005568]"
            >
              Ver Ocupación Tabular
            </button>
          </form>
        </section>

        {resultado?.estado === 'NO_OPERA' && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm">
            El vuelo no opera en la fecha seleccionada
          </div>
        )}

        {resultadoOk && total && resultadoOk.vuelo && resultadoOk.clases && (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Administración <span className="text-slate-400">›</span> Ocupación
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Consulta de Ocupación por Vuelo</h2>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm">
                <p className="font-mono text-3xl font-bold text-[#00677d]">{resultadoOk.vuelo.codigoVuelo}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {resultadoOk.vuelo.origen} → {resultadoOk.vuelo.destino} • {resultadoOk.vuelo.horaSalida}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Capacidad nominal</p>
                <p className="mt-2 font-mono text-3xl font-bold text-slate-900">{total.capacidad}</p>
                <p className="mt-1 text-xs text-slate-500">Butacas fijas</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Asientos vendidos</p>
                  <span className="rounded-full bg-[#f3f3ff] px-2.5 py-1 font-mono text-xs font-semibold text-[#515c96]">{mostrarPorcentaje(total.factor)}</span>
                </div>
                <p className="mt-2 font-mono text-3xl font-bold text-[#00677d]">{total.vendidos}</p>
                <p className="mt-1 text-xs text-slate-500">asientos reservados</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cupos disponibles</p>
                <p className="mt-2 font-mono text-3xl font-bold text-slate-900">{total.libres}</p>
                <p className="mt-1 text-xs text-slate-500">libres</p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Distribución de Butacas {resultadoOk.vuelo.codigoVuelo}</h3>
                <span className="font-mono text-xs font-semibold text-slate-500">{mostrarPorcentaje(total.factor)} ocupación</span>
              </div>
              {total.capacidad > 0 && (
                <div className="mt-4 overflow-hidden rounded-full bg-[#9de3ff]">
                  <div className="h-4 rounded-full bg-[#00677d]" style={{ width: `${porcentajeTotal}%` }} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-600">
                <span><strong className="text-[#00677d]">Vendidos:</strong> {total.vendidos} ({mostrarPorcentaje(porcentajeVendidos)})</span>
                <span><strong className="text-sky-600">Disponibles:</strong> {total.libres} ({mostrarPorcentaje(porcentajeLibres)})</span>
              </div>
            </section>

            <section className="rounded-2xl bg-[#f3f3ff] p-5 md:p-6">
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900">Desglose de Ocupación por Clase de Servicio</h3>
                <p className="mt-1 text-sm text-slate-500">Control de inventario segmentado y disponibilidad remanente.</p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-[#e7e7f5] font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    <tr>
                      <th scope="col" className="px-5 py-3">Cabina / clase</th>
                      <th scope="col" className="px-5 py-3">Capacidad</th>
                      <th scope="col" className="px-5 py-3">Asientos vendidos</th>
                      <th scope="col" className="px-5 py-3">Cupos libres</th>
                      <th scope="col" className="px-5 py-3">Factor ocupación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultadoOk.clases.map((clase) => {
                      const color = clase.clave === 'PRIMERA' ? '#00677d' : '#86d2ea'
                      const ancho = limitarAncho(clase.factor)
                      return (
                        <tr key={clase.clave}>
                          <th scope="row" className="px-5 py-5 font-normal">
                            <div className="flex items-center gap-3">
                              <span className="h-10 w-1 rounded-full" style={{ backgroundColor: color }} />
                              <span className="font-bold text-slate-800">{clase.nombre}</span>
                            </div>
                          </th>
                          <td className="px-5 py-5 font-mono font-semibold text-slate-700">{clase.capacidad ?? '—'}</td>
                          <td className="px-5 py-5">
                            <div className="font-mono font-semibold text-slate-800">
                              {clase.vendidos} <span className="text-xs font-normal text-slate-500">({mostrarPorcentaje(clase.factor)})</span>
                            </div>
                            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${ancho}%`, backgroundColor: color }} />
                            </div>
                          </td>
                          <td className="px-5 py-5 text-slate-700">{clase.libres === null ? '—' : `${clase.libres} libres`}</td>
                          <td className="px-5 py-5 font-mono font-semibold text-slate-700">{mostrarPorcentaje(clase.factor)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-[#e7e7f5]">
                      <th scope="row" className="px-5 py-5">
                        <p className="font-bold text-slate-900">Total Vuelo {resultadoOk.vuelo.codigoVuelo}</p>
                        <p className="mt-1 text-xs font-normal text-slate-500">{resultadoOk.vuelo.tipoAvion}</p>
                      </th>
                      <td className="px-5 py-5 font-mono font-bold text-slate-800">{total.capacidad}</td>
                      <td className="px-5 py-5 font-mono font-bold text-slate-800">{total.vendidos} <span className="text-xs font-normal text-slate-500">({mostrarPorcentaje(total.factor)})</span></td>
                      <td className="px-5 py-5 font-semibold text-slate-800">{total.libres} libres</td>
                      <td className="px-5 py-5 font-mono font-bold text-slate-800">{mostrarPorcentaje(total.factor)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
