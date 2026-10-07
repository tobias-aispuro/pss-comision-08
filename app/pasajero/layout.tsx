import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

const opcionesPendientes = ['Mis reservas', 'Check-in online', 'Estado de vuelo']

export default function PasajeroLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="border-b border-slate-200 bg-white shadow-sm" aria-label="Navegación de pasajero">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link href="/pasajero" className="text-xl font-bold text-sky-600">
                SkyLink
              </Link>
              <p className="text-sm text-slate-500">Panel del pasajero</p>
            </div>
            <UserButton />
          </div>

          <div className="flex flex-wrap items-center gap-2" role="list">
            <Link
              href="/pasajero/busquedaVuelo"
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              role="listitem"
            >
              Buscar vuelos
            </Link>
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
        </div>
      </nav>

      {children}
    </div>
  )
}
