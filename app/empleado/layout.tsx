import PanelLayout from '@/components/PanelLayout'

export default function EmpleadoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <PanelLayout
      inicio="/empleado"
      subtitulo="Panel de empleado"
      etiquetaNav="Navegación de empleado"
      opciones={[
        { href: '/empleado', texto: 'Salidas del día', exacta: true },
        { href: '/empleado/buscar-reserva', texto: 'Búsqueda de Reservas' }
      ]}
      pendientes={['Check-in en mostrador', 'Equipaje', 'Embarque']}
    >
      {children}
    </PanelLayout>
  )
}