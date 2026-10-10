import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import PasajeroNav from '@/components/PasajeroNav'

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

          <PasajeroNav />
        </div>
      </nav>

      {children}
    </div>
  )
}
