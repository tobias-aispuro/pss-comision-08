import Image from 'next/image'
import Link from 'next/link'
import logo from '@/public/Logo.png'

// Logo + nombre de la marca para la cabecera de cada panel.
export default function LogoSkyLink({ href, subtitulo }: { href: string; subtitulo: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
      <Image src={logo} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
      <span>
        <span className="block text-xl font-bold text-sky-600">SkyLink</span>
        <span className="block text-sm text-slate-500">{subtitulo}</span>
      </span>
    </Link>
  )
}
