import { renderToBuffer } from '@react-pdf/renderer'
import { ReporteOcupacionPDF } from '@/components/ReporteOcupacionPDF'
import { fechaDeHoy } from '@/lib/search-utils'
import { requireRole } from '@/lib/role-access'
import { normalizarFiltros, obtenerReporteOcupacion } from '@/lib/reportes'

export async function GET(request: Request) {
  await requireRole(['ADMINISTRADOR'])

  const searchParams = new URL(request.url).searchParams
  const { filtros, error } = normalizarFiltros(
    {
      desde: searchParams.get('desde') ?? '',
      hasta: searchParams.get('hasta') ?? '',
      clase: searchParams.get('clase') ?? '',
      ruta: searchParams.get('ruta') ?? '',
    },
    fechaDeHoy(),
  )

  if (error) return new Response(error, { status: 400 })

  const reporte = await obtenerReporteOcupacion(filtros)
  const pdf = await renderToBuffer(ReporteOcupacionPDF({ filtros, reporte }))

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-ocupacion_${filtros.desde}_${filtros.hasta}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}