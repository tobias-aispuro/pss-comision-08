import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'

const diasDisponibles = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

async function crearVuelo(formData: FormData) {
  'use server'

  const { parseFlightFormData } = await import('@/lib/flight-utils')
  const vuelo = parseFlightFormData(formData)

  const existente = await prisma.vuelo.findUnique({
    where: { codigoVuelo: vuelo.codigoVuelo },
  })

  if (existente) {
    throw new Error('Ya existe un vuelo con ese código.')
  }

  await prisma.vuelo.create({
    data: {
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origen,
      destino: vuelo.destino,
      diasOperacion: vuelo.diasOperacion,
      horaSalida: vuelo.horaSalida,
      horaLlegada: vuelo.horaLlegada,
      periodoDesde: vuelo.periodoDesde,
      periodoHasta: vuelo.periodoHasta,
      tipoAvion: vuelo.tipoAvion,
    },
  })

  redirect('/admin/nuevoVuelo?success=1')
}

export default async function NuevoVueloPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  const user = await requireRole(['ADMINISTRADOR']);
  const params = (await searchParams) ?? {}
  const fueCreado = params.success === '1'

  return (
    <div className="min-h-screen bg-[#edf3f6] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-6 md:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Administración</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Crear nuevo vuelo</h1>
          </div>

          <form action={crearVuelo} className="space-y-7 p-6 md:p-8">
            {fueCreado && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
                El vuelo fue creado correctamente.
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">1</span>
                  <h2 className="text-lg font-bold text-slate-800">Ruta e identificación</h2>
                </div>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-sky-700">Requerido</span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Código de vuelo</label>
                  <input name="codigoVuelo" required className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" placeholder="AR123" />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tipo de avión</label>
                  <select name="tipoAvion" required className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100">
                    <option value="">Seleccionar</option>
                    <option>Regional</option>
                    <option>Fuselaje Estrecho</option>
                    <option>Fuselaje Ancho</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Origen</label>
                  <input name="origen" required className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" placeholder="Buenos Aires" />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Destino</label>
                  <input name="destino" required className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" placeholder="Córdoba" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">2</span>
                <h2 className="text-lg font-bold text-slate-800">Periodo y horarios</h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Disponibilidad anual</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input type="month" name="periodoDesde" required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" />
                      <input type="month" name="periodoHasta" required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Días de operación</label>
                    <div className="grid grid-cols-7 gap-2">
                      {diasDisponibles.map((dia) => (
                        <label key={dia} className="cursor-pointer">
                          <input type="checkbox" name="diasOperacion" value={dia} className="peer sr-only" />
                          <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-600 shadow-sm transition peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-checked:text-white peer-checked:shadow-md hover:border-sky-200 hover:bg-sky-50">
                            {dia}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Hora de salida</label>
                    <input type="time" name="horaSalida" required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Hora de llegada</label>
                    <input type="time" name="horaLlegada" required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100" />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-sky-600 px-5 py-2.75 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700">
                Guardar vuelo
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
