const { instanteLocal } = require('./vuelos-search')

const HORAS_LIMITE_CANCELACION = 48
// Tiempo que una reserva cancelada sigue visible en "Mis reservas" después de cancelarse.
const HORAS_VISIBLE_CANCELADA = 1
const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires'
const MS_HORA = 60 * 60 * 1000

// Instante (ms) del despegue, con la hora de salida en el huso del aeropuerto de origen.
function instanteDespegue(vuelo, fecha) {
  return instanteLocal(fecha, vuelo.horaSalida, vuelo.zonaOrigen || ZONA_POR_DEFECTO)
}

// Último instante (ms) en el que el pasajero puede autogestionar la cancelación.
function limiteCancelacion(vuelo, fecha) {
  return instanteDespegue(vuelo, fecha) - HORAS_LIMITE_CANCELACION * MS_HORA
}

/**
 * Decide si el titular de la cuenta puede cancelar una reserva que compró.
 * La cancelación es en cascada: se anulan los pasajes de todos los pasajeros de la compra.
 * @param {{ reserva: { fecha: string, estado: string }, vuelo: { horaSalida: string, zonaOrigen?: string | null } }} datos
 * @param {number} [ahora]
 * @returns {{ ok: true, limite: number } | { ok: false, motivo: string, limite?: number }}
 */
function evaluarCancelacion({ reserva, vuelo }, ahora = Date.now()) {
  if (reserva.estado === 'CANCELADA') {
    return { ok: false, motivo: 'Esta reserva está cancelada.' }
  }

  let limite
  try {
    limite = limiteCancelacion(vuelo, reserva.fecha)
  } catch {
    return { ok: false, motivo: 'No se pudo calcular el horario del vuelo.' }
  }

  if (Number.isNaN(limite)) {
    return { ok: false, motivo: 'No se pudo calcular el horario del vuelo.' }
  }

  if (ahora > limite) {
    return {
      ok: false,
      limite,
      motivo: `Ya expiró el plazo para cancelar: solo se puede hasta ${HORAS_LIMITE_CANCELACION} horas antes del despegue.`,
    }
  }

  return { ok: true, limite }
}

// Instante (ms) en que se canceló la reserva: la cancelación más reciente de sus pasajeros o,
// si se canceló sin marcar pasajeros (p. ej. cancelación del vuelo por el admin), su última actualización.
function instanteCancelacion(reserva, pasajeros = []) {
  const marcas = pasajeros.filter((p) => p.canceladoAt).map((p) => new Date(p.canceladoAt).getTime())
  return marcas.length > 0 ? Math.max(...marcas) : new Date(reserva.updatedAt).getTime()
}

/**
 * Decide si una reserva se sigue mostrando en "Mis reservas":
 * - activa (pendiente o confirmada): hasta el despegue del vuelo;
 * - cancelada: hasta 1 hora después de la cancelación.
 * @param {{ reserva: { fecha: string, estado: string, updatedAt: Date | string }, vuelo: { horaSalida: string, zonaOrigen?: string | null }, pasajeros?: { canceladoAt?: Date | string | null }[] }} datos
 * @param {number} [ahora]
 */
function visibleEnMisReservas({ reserva, vuelo, pasajeros = [] }, ahora = Date.now()) {
  if (reserva.estado === 'CANCELADA') {
    return ahora < instanteCancelacion(reserva, pasajeros) + HORAS_VISIBLE_CANCELADA * MS_HORA
  }

  let despegue
  try {
    despegue = instanteDespegue(vuelo, reserva.fecha)
  } catch {
    return true
  }
  // Si no se puede calcular el horario, se sigue mostrando para no ocultar un viaje vigente.
  return Number.isNaN(despegue) || ahora < despegue
}

module.exports = {
  HORAS_LIMITE_CANCELACION,
  HORAS_VISIBLE_CANCELADA,
  instanteCancelacion,
  visibleEnMisReservas,
  instanteDespegue,
  limiteCancelacion,
  evaluarCancelacion,
}
