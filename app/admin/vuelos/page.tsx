import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'

export default async function TodosLosVuelosPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  await requireRole(['ADMINISTRADOR'])
  const params = (await searchParams) ?? {}
  const fueModificado = params.success === '1'

  const vuelos = await prisma.vuelo.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
            {fueModificado && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
              Vuelo modificado correctamente.
            </div>
          )}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
                Administración
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Todos los vuelos
              </h2>
            </div>
          </div>

          {vuelos.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              No hay vuelos cargados todavía.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Código</th>
                    <th className="px-5 py-3">Ruta</th>
                    <th className="px-5 py-3">Horario</th>
                    <th className="px-5 py-3">Días</th>
                    <th className="px-5 py-3">Avión</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vuelos.map((v) => (
                    <tr key={v.id} className="hover:bg-sky-50/40">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {v.codigoVuelo}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {v.origen} → {v.destino}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {v.horaSalida} - {v.horaLlegada}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {v.diasOperacion.join(', ')}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{v.tipoAvion}</td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/vuelos/${v.id}/editar`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          Modificar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
   
  )
}