export type AsientoMapa = { codigo: string; fila: number; letra: string; clase: 'PRIMERA' | 'ECONOMY' }
export type SeleccionAsiento = { pasajeroId: string; asiento: string }
type Capacidades = { capacidadPrimera: number | null; capacidadEconomy: number | null }

// Filas consecutivas entre clases: un código identifica un único lugar de la salida.
export function construirMapa(vuelo: Capacidades): AsientoMapa[] {
  const mapa: AsientoMapa[] = []
  let primeraFila = 1
  for (const [clase, capacidad, letras] of [
    ['PRIMERA', vuelo.capacidadPrimera, 'ACDF'],
    ['ECONOMY', vuelo.capacidadEconomy, 'ABCDEF'],
  ] as const) {
    // Sin ambas capacidades no se puede establecer la numeración de las secciones.
    if (capacidad === null || !Number.isSafeInteger(capacidad) || capacidad < 0) return []
    for (let i = 0; i < capacidad; i++) {
      const fila = primeraFila + Math.floor(i / letras.length)
      const letra = letras[i % letras.length]
      mapa.push({ codigo: `${fila}${letra}`, fila, letra, clase })
    }
    primeraFila += Math.ceil(capacidad / letras.length)
  }
  return mapa
}

export function validarSeleccion(seleccion: SeleccionAsiento[], pendientes: string[], clase: string, mapa: AsientoMapa[]): string | null {
  if (mapa.length === 0) return 'No está configurada la capacidad del avión. No se pueden seleccionar asientos.'
  if (seleccion.length === 0) return 'Debe seleccionar un asiento para continuar'
  if (seleccion.length !== pendientes.length) return 'Seleccioná un asiento para cada pasajero pendiente de check-in.'
  const pasajeros = new Set<string>()
  const asientos = new Set<string>()
  for (const s of seleccion) {
    if (!s || typeof s.pasajeroId !== 'string' || typeof s.asiento !== 'string' || !pendientes.includes(s.pasajeroId) || pasajeros.has(s.pasajeroId)) {
      return 'La selección contiene pasajeros inválidos.'
    }
    if (!mapa.some((a) => a.codigo === s.asiento && a.clase === clase)) return 'Elegí un asiento válido de la clase comprada.'
    if (asientos.has(s.asiento)) return 'No podés asignar el mismo asiento a dos pasajeros.'
    pasajeros.add(s.pasajeroId)
    asientos.add(s.asiento)
  }
  return null
}
