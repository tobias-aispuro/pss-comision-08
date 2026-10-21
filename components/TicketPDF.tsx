import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '2px solid #08A6C9', paddingBottom: 15, marginBottom: 20 },
  logoText: { fontSize: 24, color: '#046A7A', fontWeight: 'bold' },
  boardingPass: { fontSize: 14, color: '#6475AC', textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  section: { flex: 1 },
  label: { fontSize: 9, color: '#6475AC', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  value: { fontSize: 14, color: '#0f172a', fontWeight: 'bold' },
  valueLarge: { fontSize: 28, color: '#0f172a', fontWeight: 'bold' },
  card: { backgroundColor: '#ffffff', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' },
  footer: { marginTop: 30, fontSize: 10, color: '#94a3b8', textAlign: 'center' }
})

// Función para formatear la fecha estilo pasaje (Ej: JUE 24 OCT 2025)
function formatearFechaTicket(fecha: string) {
  if (!fecha) return '';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia));
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short', 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric', 
    timeZone: 'UTC'
  }).format(date).toUpperCase();
}

export function TicketPDF({ reserva, pasajero }: { reserva: any, pasajero: any }) {
  // Asignamos valores por defecto en caso de que aún no los tengas en tu BD
  const asiento = pasajero.asiento || 'Por asignar'
  const puerta = 'TBA'
  const grupo = pasajero.grupoEmbarque || '3'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.logoText}>✈ SkyLink</Text>
              <Text style={styles.boardingPass}>Ticket de Embarque Electrónico</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>VUELO</Text>
              <Text style={styles.valueLarge}>{reserva.vuelo.codigoVuelo}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.section}>
              <Text style={styles.label}>Pasajero</Text>
              <Text style={styles.value}>{pasajero.nombre}</Text>
              <Text style={{ fontSize: 10, color: '#6475AC', marginTop: 2 }}>DNI: {pasajero.dni}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Clase / Tarifa</Text>
              <Text style={styles.value}>{reserva.clase}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.section}>
              <Text style={styles.label}>Origen</Text>
              <Text style={styles.valueLarge}>{reserva.vuelo.origen}</Text>
              <Text style={{ fontSize: 12, color: '#6475AC', marginTop: 4, fontWeight: 'bold' }}>
                {formatearFechaTicket(reserva.fecha)}
              </Text>
              <Text style={{ fontSize: 12, color: '#6475AC', marginTop: 2 }}>
                {reserva.vuelo.horaSalida} hrs
              </Text>
            </View>
            <View style={{ justifyContent: 'center', paddingHorizontal: 20 }}>
              <Text style={{ color: '#08A6C9', fontSize: 20 }}>➔</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Destino</Text>
              <Text style={styles.valueLarge}>{reserva.vuelo.destino}</Text>
              <Text style={{ fontSize: 12, color: '#6475AC', marginTop: 4, fontWeight: 'bold' }}>
                {formatearFechaTicket(reserva.fecha)}
              </Text>
              <Text style={{ fontSize: 12, color: '#6475AC', marginTop: 2 }}>
                {reserva.vuelo.horaLlegada} hrs
              </Text>
            </View>
          </View>

          <View style={[styles.row, { borderTop: '1px solid #e2e8f0', paddingTop: 20, marginBottom: 0 }]}>
            <View style={styles.section}>
              <Text style={styles.label}>Asiento</Text>
              <Text style={[styles.value, { color: '#046A7A' }]}>{asiento}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Puerta Embarque</Text>
              <Text style={styles.value}>{puerta}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>Grupo Embarque</Text>
              <Text style={styles.value}>{grupo}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.footer}>Este documento es válido como pasaje oficial de embarque. Generado el {new Date().toLocaleDateString('es-AR')}.</Text>
      </Page>
    </Document>
  )
}