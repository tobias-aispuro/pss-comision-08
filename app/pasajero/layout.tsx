import PanelLayout from '@/components/PanelLayout'

export default function PasajeroLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <PanelLayout
      inicio="/pasajero"
      subtitulo="Panel del pasajero"
      etiquetaNav="Navegación de pasajero"
      opciones={[
        { href: '/pasajero', texto: 'Inicio', exacta: true },
        { href: '/pasajero/busquedaVuelo', texto: 'Buscar vuelos', rutas: ['/pasajero/compra'] },
        { href: '/pasajero/reservas', texto: 'Mis reservas' },
      ]}
      pendientes={['Check-in online', 'Estado de vuelo']}
    >
      {children}
    </PanelLayout>
  )
}
