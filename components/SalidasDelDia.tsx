import type { SalidaDelDia } from '@/lib/panel-datos'

// Tabla de salidas del día con ocupación, según el wireframe de monitoreo de vuelos.
export default function SalidasDelDia({
  salidas,
  titulo,
  descripcion,
}: {
  salidas: SalidaDelDia[]
  titulo: string
  descripcion: string
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
          <p className="text-sm text-slate-500">{descripcion}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          {salidas.length} {salidas.length === 1 ? 'salida' : 'salidas'}
        </span>
      </div>

      {salidas.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500">No hay vuelos programados para hoy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Vuelo</th>
                <th className="px-5 py-3">Ruta</th>
                <th className="px-5 py-3">Salida / llegada</th>
                <th className="px-5 py-3">Aeronave</th>
                <th className="px-5 py-3">Ocupación</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salidas.map((s) => {
                const ocupacion = s.capacidad ? Math.min(Math.round((s.reservados / s.capacidad) * 100), 100) : null
                return (
                  <tr key={s.id} className="hover:bg-sky-50/40">
                    <td className="px-5 py-4 font-bold text-slate-900">{s.codigoVuelo}</td>
                    <td className="px-5 py-4 text-slate-700">
                      <span className="font-semibold">{s.origen}</span> → <span className="font-semibold">{s.destino}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-700">
                      {s.horaSalida} <span className="text-slate-400">→</span> {s.horaLlegada}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{s.tipoAvion}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-700">
                          {s.reservados}
                          {s.capacidad !== null && ` / ${s.capacidad}`}
                        </span>
                        {ocupacion !== null && <span className="font-mono text-sky-700">{ocupacion}%</span>}
                      </div>
                      <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[#08A6C9]" style={{ width: `${ocupacion ?? 0}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {s.pasajeros} {s.pasajeros === 1 ? 'pasajero registrado' : 'pasajeros registrados'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                        Programado
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
