const { instanteLocal } = require('./vuelos-search')

const HORAS_LIMITE_CANCELACION = 48
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
 * Decide si el titular de la cuenta puede cancelar su pasaje dentro de una reserva.
 * Solo se cancela el pasaje del pasajero con el DNI del titular; el resto de la reserva no se toca.
 * @template {{ id: string, dni: string, canceladoAt?: Date | null }} P
 * @param {{ reserva: { fecha: string, estado: string }, vuelo: { horaSalida: string, zonaOrigen?: string | null }, pasajeros: P[], dniTitular: string }} datos
 * @param {number} [ahora]
 * @returns {{ ok: true, pasajero: P, limite: number } | { ok: false, motivo: string, limite?: number }}
 */
function evaluarCancelacion({ reserva, vuelo, pasajeros, dniTitular }, ahora = Date.now()) {
  if (reserva.estado === 'CANCELADA') {
    return { ok: false, motivo: 'Esta reserva está cancelada.' }
  }

  const pasajero = pasajeros.find((p) => p.dni === dniTitular)
  if (!pasajero) {
    return { ok: false, motivo: 'Tu DNI no figura entre los pasajeros de esta reserva.' }
  }

  if (pasajero.canceladoAt) {
    return { ok: false, motivo: 'Tu pasaje en esta reserva ya fue cancelado.' }
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

  return { ok: true, pasajero, limite }
}

module.exports = {
  HORAS_LIMITE_CANCELACION,
  instanteDespegue,
  limiteCancelacion,
  evaluarCancelacion,
}
