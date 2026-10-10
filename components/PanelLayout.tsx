import { UserButton } from '@clerk/nextjs'
import LogoSkyLink from '@/components/LogoSkyLink'
import NavPanel, { type OpcionNav } from '@/components/NavPanel'

// Estructura común de los paneles de cada rol: cabecera con logo, usuario y menú de secciones.
export default function PanelLayout({
  inicio,
  subtitulo,
  etiquetaNav,
  opciones,
  pendientes,
  children,
}: {
  inicio: string
  subtitulo: string
  etiquetaNav: string
  opciones: OpcionNav[]
  pendientes?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#edf3f6]">
      <nav className="border-b border-slate-200 bg-white shadow-sm" aria-label={etiquetaNav}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <LogoSkyLink href={inicio} subtitulo={subtitulo} />
            <UserButton />
          </div>
          <NavPanel opciones={opciones} pendientes={pendientes} />
        </div>
      </nav>

      {children}
    </div>
  )
}
