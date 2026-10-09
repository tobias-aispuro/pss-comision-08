import Link from 'next/link'

const CLASES_TARIFA = [
  { clase: 'ECONOMY', nombre: 'Economy', precio: 'precioEconomy' },
  { clase: 'PRIMERA', nombre: 'Primera', precio: 'precioPrimera' },
] as const

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

type VueloConTarifas = {
  id?: string
  clasesDisponibles?: string[]
  precioEconomy?: number | null
  precioPrimera?: number | null
}

// Una opción por clase con cupo; lleva a la carga de pasajeros de ese tramo (US-10).
// `extra` agrega parámetros del viaje (fecha de regreso, reserva de ida) para encadenar ida y vuelta.
export default function OpcionesTarifa({
  vuelo,
  fecha,
  asientos,
  extra = {},
}: {
  vuelo: VueloConTarifas
  fecha: string
  asientos: string
  extra?: Record<string, string>
}) {
  const clases = CLASES_TARIFA.filter(({ clase }) => vuelo.clasesDisponibles?.includes(clase))

  return (
    <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
      {clases.map(({ clase, nombre, precio }) => (
        <Link
          key={clase}
          href={`/pasajero/compra?${new URLSearchParams({ vueloId: vuelo.id ?? '', fecha, clase, asientos, ...extra })}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
        >
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{nombre}</span>
            <span className="block text-lg font-bold text-slate-900">{formatearPrecio(vuelo[precio])}</span>
          </span>
          <span className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm">Seleccionar</span>
        </Link>
      ))}
    </div>
  )
}
