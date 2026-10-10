'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type OpcionNav = {
  href: string
  texto: string
  // Rutas que también marcan esta opción como activa (además de `href` y sus subrutas).
  rutas?: string[]
  // Solo se activa con la ruta exacta (para el inicio de cada panel).
  exacta?: boolean
}

const claseBase =
  'rounded-lg px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
const claseActiva = 'bg-sky-600 font-semibold text-white shadow-sm hover:bg-sky-700'
const claseInactiva = 'font-medium text-slate-700 hover:bg-slate-100'

// Menú de cada panel: resalta la sección actual y muestra deshabilitadas las que todavía no existen.
export default function NavPanel({ opciones, pendientes = [] }: { opciones: OpcionNav[]; pendientes?: string[] }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap items-center gap-2" role="list">
      {opciones.map(({ href, texto, rutas = [], exacta }) => {
        const activa = exacta
          ? pathname === href
          : [href, ...rutas].some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
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
      {pendientes.map((opcion) => (
        <span
          key={opcion}
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
