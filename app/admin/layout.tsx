import PanelLayout from '@/components/PanelLayout'

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <PanelLayout
      inicio="/admin"
      subtitulo="Panel administrativo"
      etiquetaNav="Navegación de administración"
      opciones={[
        { href: '/admin', texto: 'Inicio', exacta: true },
        { href: '/admin/vuelos', texto: 'Todos los vuelos' },
        { href: '/admin/nuevoVuelo', texto: 'Crear nuevo vuelo' },
        { href: '/admin/reportes', texto: 'Reportes gerenciales' },
      ]}
      pendientes={['Programación semanal', 'Gestión de slots', 'Asignación de puertas']}
    >
      {children}
    </PanelLayout>
  )
}
