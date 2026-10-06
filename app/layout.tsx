import { ClerkProvider } from '@clerk/nextjs'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css' // Asegura que tus estilos globales de Tailwind carguen

// 1. Descargamos e instanciamos la fuente principal (Hanken Grotesk)
const hanken = Hanken_Grotesk({ 
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

// 2. Descargamos e instanciamos la fuente para códigos/etiquetas (JetBrains Mono)
const jetbrains = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata = {
  title: 'SkyLink | Airline & Airport Operations',
  description: 'Sistema de gestión de pasajeros',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      {/* 3. Inyectamos las variables de las fuentes en el HTML base */}
      <html lang="es" className={`${hanken.variable} ${jetbrains.variable}`}>
        <body className="antialiased bg-white text-slate-900">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}