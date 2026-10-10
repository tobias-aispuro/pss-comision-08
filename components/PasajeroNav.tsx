'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// La compra de pasajes es parte del flujo de búsqueda, así que también resalta "Buscar vuelos".
const opciones = [
  { href: '/pasajero/busquedaVuelo', texto: 'Buscar vuelos', rutas: ['/pasajero/busquedaVuelo', '/pasajero/compra'] },
  { href: '/pasajero/reservas', texto: 'Mis reservas', rutas: ['/pasajero/reservas'] },
]

const opcionesPendientes = ['Check-in online', 'Estado de vuelo']

const claseBase =
  'rounded-lg px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
const claseActiva = 'bg-sky-600 font-semibold text-white shadow-sm hover:bg-sky-700'
const claseInactiva = 'font-medium text-slate-700 hover:bg-slate-100'

export default function PasajeroNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap items-center gap-2" role="list">
      {opciones.map(({ href, texto, rutas }) => {
        const activa = rutas.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? 'page' : undefined}
            className={`${claseBase} ${activa ? claseActiva : claseInactiva}`}
            role="listitem"
          >
            {texto}
          </Link>
        )
      })}
      {opcionesPendientes.map((opcion) => (
        <span
          key={opcion}
          aria-disabled="true"
          className="cursor-not-allowed rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
          role="listitem"
          title="Disponible próximamente"
        >
          {opcion}
        </span>
      ))}
    </div>
  )
}
