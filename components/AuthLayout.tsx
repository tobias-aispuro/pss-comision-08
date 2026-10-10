import Image from 'next/image'
import aeropuerto from '@/public/aeropuerto.jpeg'
import LogoSkyLink from '@/components/LogoSkyLink'
import RutaAnimada from '@/components/RutaAnimada'

// Pantallas de acceso (inicio de sesión y registro) según el wireframe Inicio-Sesion-Escritorio:
// formulario a la izquierda y foto del aeropuerto con la leyenda de la plataforma a la derecha.
export default function AuthLayout({
  etiqueta,
  titulo,
  subtitulo,
  children,
}: {
  etiqueta?: string
  titulo: string
  subtitulo: string
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <LogoSkyLink href="/" subtitulo="Airline & Airport Operations" />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {etiqueta && (
            <span className="mb-4 self-start rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-sky-700">
              {etiqueta}
            </span>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{titulo}</h1>
          <p className="mt-2 text-slate-500">{subtitulo}</p>

          <div className="mt-8">{children}</div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
          <span>© SkyLink · Sistema de reservas de vuelos</span>
          <span className="font-mono tracking-wide">Conexión segura</span>
        </footer>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <Image src={aeropuerto} alt="" fill sizes="55vw" placeholder="blur" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/55 to-slate-900/20" />

        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-14">
          <RutaAnimada className="mb-8 w-full max-w-xl" />
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur-sm">
            ✈ SkyLink Global Platform
          </span>
          <p className="mt-5 max-w-lg text-3xl font-bold leading-snug text-white">
            “Conectando cada vuelo con precisión y seguridad.”
          </p>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80">
            Buscá vuelos, comprá los pasajes de todo tu grupo y gestioná tus reservas desde un solo lugar.
          </p>
        </div>
      </div>
    </div>
  )
}
