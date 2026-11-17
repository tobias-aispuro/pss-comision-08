import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  CLASES_REPORTE,
  type FiltrosReporte,
  type ReporteOcupacion,
} from '@/lib/reportes'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', color: '#0f172a', fontSize: 9 },
  header: { borderBottom: '2px solid #08A6C9', paddingBottom: 12, marginBottom: 18 },
  brand: { color: '#046A7A', fontSize: 10, fontWeight: 'bold', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#64748b', fontSize: 9, marginTop: 5 },
  filters: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, color: '#475569' },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  metric: { flexGrow: 1, flexBasis: 0, border: '1px solid #dbe3e8', borderRadius: 4, padding: 10 },
  metricLabel: { color: '#64748b', fontSize: 8, marginBottom: 5 },
  metricValue: { color: '#00677d', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 7, paddingHorizontal: 6, color: '#475569', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 8, paddingHorizontal: 6 },
  route: { width: '30%', fontWeight: 'bold' },
  economy: { width: '23%' },
  first: { width: '23%' },
  average: { width: '24%' },
  muted: { color: '#64748b' },
  empty: { padding: 14, color: '#64748b', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, color: '#94a3b8', fontSize: 8, textAlign: 'center' },
})

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)))
}

function porcentaje(ocupados: number, capacidad: number) {
  return capacidad > 0 ? (ocupados / capacidad) * 100 : 0
}

function mostrarPorcentaje(valor: number) {
  return `${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`
}

function valorClase(ocupados: number, capacidad: number) {
  return `${ocupados} / ${capacidad} (${mostrarPorcentaje(porcentaje(ocupados, capacidad))})`
}

export function ReporteOcupacionPDF({ filtros, reporte }: { filtros: FiltrosReporte; reporte: ReporteOcupacion }) {
  const ruta = filtros.ruta ? filtros.ruta.replace('|', ' → ') : 'Todas las rutas'
  const clase = filtros.clase === 'TODAS' ? 'Todas las clases' : CLASES_REPORTE[filtros.clase].nombre

  return (
    <Document title="Reporte de ocupación" author="SkyLink">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>SkyLink · ADMINISTRACIÓN</Text>
          <Text style={styles.title}>Reporte de ocupación</Text>
          <Text style={styles.subtitle}>Resumen de capacidad y pasajeros registrados por ruta.</Text>
        </View>

        <View style={styles.filters}>
          <Text>Período: {formatearFecha(filtros.desde)} al {formatearFecha(filtros.hasta)}</Text>
          <Text>Clase: {clase} · Ruta: {ruta}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>OCUPACIÓN TOTAL</Text>
            <Text style={styles.metricValue}>{mostrarPorcentaje(porcentaje(reporte.total.ocupados, reporte.total.capacidad))}</Text>
            <Text style={styles.muted}>{reporte.total.ocupados} de {reporte.total.capacidad} asientos</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>VUELOS ANALIZADOS</Text>
            <Text style={styles.metricValue}>{reporte.cantidadSalidas}</Text>
            <Text style={styles.muted}>salidas en el período</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>ECONOMY</Text>
            <Text style={styles.metricValue}>{mostrarPorcentaje(porcentaje(reporte.porClase.ECONOMY.ocupados, reporte.porClase.ECONOMY.capacidad))}</Text>
            <Text style={styles.muted}>{reporte.porClase.ECONOMY.ocupados} de {reporte.porClase.ECONOMY.capacidad} asientos</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>PRIMERA CLASE</Text>
            <Text style={styles.metricValue}>{mostrarPorcentaje(porcentaje(reporte.porClase.PRIMERA.ocupados, reporte.porClase.PRIMERA.capacidad))}</Text>
            <Text style={styles.muted}>{reporte.porClase.PRIMERA.ocupados} de {reporte.porClase.PRIMERA.capacidad} asientos</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ocupación por ruta</Text>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.route}>Ruta</Text>
          <Text style={styles.economy}>Economy</Text>
          <Text style={styles.first}>Primera clase</Text>
          <Text style={styles.average}>Promedio ruta</Text>
        </View>
        {reporte.filas.length === 0 ? (
          <Text style={styles.empty}>No hay vuelos programados para los filtros seleccionados.</Text>
        ) : (
          reporte.filas.map((fila) => {
            const ocupados = fila.economy.ocupados + fila.primera.ocupados
            const capacidad = fila.economy.capacidad + fila.primera.capacidad
            return (
              <View key={fila.ruta} style={styles.tableRow} wrap={false}>
                <Text style={styles.route}>{fila.origen} → {fila.destino}</Text>
                <Text style={styles.economy}>{valorClase(fila.economy.ocupados, fila.economy.capacidad)}</Text>
                <Text style={styles.first}>{valorClase(fila.primera.ocupados, fila.primera.capacidad)}</Text>
                <Text style={styles.average}>{valorClase(ocupados, capacidad)}</Text>
              </View>
            )
          })
        )}
        <Text style={styles.footer} fixed>Reporte generado por SkyLink · Administración</Text>
      </Page>
    </Document>
  )
}