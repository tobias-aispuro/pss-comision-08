import Link from 'next/link'

// Tarjeta de un vuelo en los resultados, según el wireframe Busqueda-Vuelos-Pasajero:
// horarios grandes a los lados, la duración en el medio y "Elegir tarifa" despliega Economy / Primera.

const TARIFAS = [
  { clase: 'ECONOMY', nombre: 'Economy', precio: 'precioEconomy', descripcion: 'Tarifa estándar para viajar con lo esencial.' },
  { clase: 'PRIMERA', nombre: 'Primera', precio: 'precioPrimera', descripcion: 'La máxima comodidad y prioridad en todo el viaje.' },
] as const

export type VueloResultado = {
  id: string
  codigoVuelo: string
  origen: string
  destino: string
  horaSalida: string
  horaLlegada: string
  tipoAvion?: string | null
  duracion?: string | null
  precioDesde?: number | null
  precioEconomy?: number | null
  precioPrimera?: number | null
  clasesDisponibles?: string[]
}

export function formatearPrecio(precio: number | null | undefined) {
  if (precio === null || precio === undefined) {
    return 'Precio no disponible'
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function TarjetaVuelo({
  vuelo,
  fecha,
  asientos,
  extra = {},
  abierta = false,
  clases,
}: {
  vuelo: VueloResultado
  fecha: string
  asientos: string
  // Parámetros del viaje que se suman al link de compra (fecha de regreso, reserva de ida).
  extra?: Record<string, string>
  abierta?: boolean
  // Clases que el pasajero eligió ver en los filtros (por defecto, todas).
  clases?: string[]
}) {
  const tarifas = clases ? TARIFAS.filter(({ clase }) => clases.includes(clase)) : TARIFAS

  return (
    <details
      open={abierta}
      className="group overflow-hidden rounded-2xl border border-slate-200 border-l-4 border-l-sky-600 bg-white shadow-sm open:shadow-md"
    >
      <summary className="cursor-pointer list-none p-4 md:p-5 [&::-webkit-details-marker]:hidden">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          SkyLink <span className="text-slate-800">{vuelo.codigoVuelo}</span>
          {vuelo.tipoAvion && <span className="font-medium normal-case tracking-normal text-slate-500"> · {vuelo.tipoAvion}</span>}
        </p>

        <div className="mt-3 grid items-center gap-4 sm:grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto]">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{vuelo.horaSalida}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{vuelo.origen}</p>
          </div>

          <div className="px-2 text-center">
            <p className="text-xs font-medium text-slate-500">{vuelo.duracion ?? 'Duración no disponible'}</p>
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

          <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:col-span-3 md:col-span-1 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="md:text-right">
              <p className="text-[11px] font-medium text-slate-500">Desde</p>
              <p className="text-2xl font-bold text-sky-700">{formatearPrecio(vuelo.precioDesde)}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:bg-sky-700">
              Elegir tarifa
              <span className="transition group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </span>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-200 bg-slate-50 p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">Seleccioná tu categoría para este trayecto</p>
          <p className="text-xs text-slate-500">Precio por pasajero</p>
        </div>

        <div className={`grid gap-4 ${tarifas.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {tarifas.map(({ clase, nombre, precio, descripcion }) => {
            const disponible = vuelo.clasesDisponibles?.includes(clase) ?? true
            const primera = clase === 'PRIMERA'

            return (
              <div
                key={clase}
                className={`relative flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${
                  primera ? 'border-sky-700' : 'border-slate-200'
                } ${disponible ? '' : 'opacity-60'}`}
              >
                {primera && (
                  <span className="absolute -top-2.5 left-4 rounded-md bg-sky-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    Servicio exclusivo
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg font-bold text-slate-900">{nombre}</p>
                  <p className="text-lg font-bold text-sky-700">{formatearPrecio(vuelo[precio])}</p>
                </div>
                <p className="mt-1 flex-1 text-sm text-slate-600">{descripcion}</p>

                {disponible ? (
                  <Link
                    href={`/pasajero/compra?${new URLSearchParams({ vueloId: vuelo.id, fecha, clase, asientos, ...extra })}`}
                    className={`mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                      primera
                        ? 'bg-sky-800 text-white shadow-sm hover:bg-sky-900'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    Seleccionar {nombre}
                  </Link>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-500">
                    Sin lugares disponibles
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </details>
  )
}
