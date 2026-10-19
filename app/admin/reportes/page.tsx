import { requireRole } from '@/lib/role-access'
import { fechaDeHoy } from '@/lib/search-utils'
import {
  CLASES_REPORTE,
  normalizarFiltros,
  obtenerReporteOcupacion,
  obtenerRutasReporte,
} from '@/lib/reportes'

function porcentaje(ocupados: number, capacidad: number) {
  if (capacidad <= 0) return 0

  return Math.min((ocupados / capacidad) * 100, 100)
}

function mostrarPorcentaje(valor: number) {
  return `${valor.toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })}%`
}

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, dia)),
  )
}

function BarraOcupacion({ ocupados, capacidad, color = 'bg-[#08A6C9]' }: { ocupados: number; capacidad: number; color?: string }) {
  const valor = porcentaje(ocupados, capacidad)
  // Una ocupación muy pequeña puede ser menor que un píxel; se amplía solo visualmente.
  const anchoVisible = valor > 0 ? Math.max(valor, 3) : 0
  return (
    <div className="w-full min-w-[260px]">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700">
          {ocupados} / {capacidad}
        </span>
        <span className="font-mono font-semibold text-sky-700">{mostrarPorcentaje(valor)}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${anchoVisible}%` }} title={`Ocupación real: ${mostrarPorcentaje(valor)}`} />
      </div>
    </div>
  )
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['ADMINISTRADOR'])
  const { filtros, error } = normalizarFiltros((await searchParams) ?? {}, fechaDeHoy())
  const rutas = await obtenerRutasReporte()
  const reporte = error ? null : await obtenerReporteOcupacion(filtros)
  const ocupacionTotal = reporte ? porcentaje(reporte.total.ocupados, reporte.total.capacidad) : 0

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Administración <span className="text-slate-400">›</span> Analítica
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Reportes gerenciales</h2>
          <p className="mt-1 text-sm text-slate-500">Compará la ocupación por período, clase y ruta.</p>
        </div>

        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">Filtros del reporte</h3>
            <p className="text-sm text-slate-500">Elegí un período y aplicá los filtros para actualizar los indicadores.</p>
          </div>
          <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] lg:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Desde
              <input name="desde" type="date" defaultValue={filtros.desde} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Hasta
              <input name="hasta" type="date" defaultValue={filtros.hasta} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Clase
              <select name="clase" defaultValue={filtros.clase} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                <option value="TODAS">Todas las clases</option>
                <option value="ECONOMY">Economy</option>
                <option value="PRIMERA">Primera clase</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Ruta
              <select name="ruta" defaultValue={filtros.ruta} className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                <option value="">Todas las rutas</option>
                {rutas.map((ruta) => (
                  <option key={`${ruta.origen}|${ruta.destino}`} value={`${ruta.origen}|${ruta.destino}`}>
                    {ruta.origen} → {ruta.destino}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-xl bg-[#08A6C9] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(8,166,201,0.2)] transition hover:bg-[#318098]">
              Aplicar filtros
            </button>
          </form>
        </section>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 border-r-4 border-r-[#08A6C9] bg-white p-5 shadow-sm">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ocupación total</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{mostrarPorcentaje(ocupacionTotal)}</p>
                <p className="mt-1 text-xs text-slate-500">{reporte?.total.ocupados} de {reporte?.total.capacidad} asientos</p>
              </div>
              <div className="rounded-2xl border border-slate-200 border-r-4 border-r-[#318098] bg-white p-5 shadow-sm">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vuelos analizados</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{reporte?.cantidadSalidas}</p>
                <p className="mt-1 text-xs text-slate-500">{formatearFecha(filtros.desde)} al {formatearFecha(filtros.hasta)}</p>
              </div>
              {(['ECONOMY', 'PRIMERA'] as const).map((clase) => (
                <div key={clase} className="rounded-2xl border border-slate-200 border-r-4 border-r-[#6475AC] bg-white p-5 shadow-sm">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{CLASES_REPORTE[clase].nombre}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{mostrarPorcentaje(porcentaje(reporte?.porClase[clase].ocupados ?? 0, reporte?.porClase[clase].capacidad ?? 0))}</p>
                  <p className="mt-1 text-xs text-slate-500">{reporte?.porClase[clase].ocupados} de {reporte?.porClase[clase].capacidad} asientos</p>
                </div>
              ))}
            </div>

            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-lg font-bold text-slate-900">Comparativa de ocupación por ruta</h3>
                <p className="text-sm text-slate-500">Las barras muestran pasajeros registrados sobre la capacidad disponible del período.</p>
              </div>
              {reporte?.filas.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No hay vuelos programados para los filtros seleccionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-slate-50 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Ruta</th>
                        <th className="px-5 py-3">Economy</th>
                        <th className="px-5 py-3">Primera clase</th>
                        <th className="px-5 py-3">Promedio ruta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reporte?.filas.map((fila) => {
                        const ocupados = fila.economy.ocupados + fila.primera.ocupados
                        const capacidad = fila.economy.capacidad + fila.primera.capacidad
                        return (
                          <tr key={fila.ruta} className="hover:bg-sky-50/40">
                            <td className="px-5 py-4 font-semibold text-slate-800">{fila.origen} → {fila.destino}</td>
                            <td className="px-5 py-4"><BarraOcupacion {...fila.economy} /></td>
                            <td className="px-5 py-4"><BarraOcupacion {...fila.primera} color="bg-[#6475AC]" /></td>
                            <td className="px-5 py-4"><BarraOcupacion ocupados={ocupados} capacidad={capacidad} color="bg-[#318098]" /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
