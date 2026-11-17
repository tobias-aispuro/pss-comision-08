/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS para compartir la regla con node --test. */
const { instanteDespegue } = require('./reserva-cancelacion-utils')

const MS_HORA = 60 * 60 * 1000

/**
 * El estado de check-in se deriva de los pasajes activos de la reserva.
 * @param {{ checkInCompletado: boolean, canceladoAt?: Date | string | null }[]} pasajeros
 */
function checkInCompleto(pasajeros) {
  const activos = pasajeros.filter((pasajero) => !pasajero.canceladoAt)
  return activos.length > 0 && activos.every((pasajero) => pasajero.checkInCompletado)
}

/**
 * Ventana inclusiva: desde 14 días hasta 48 horas antes del despegue.
 * Usa la fecha de la reserva y el huso del aeropuerto de origen.
 * @param {{ reserva: { fecha: string, estado: string }, vuelo: { horaSalida: string, zonaOrigen?: string | null, activo: boolean }, cancelado?: boolean, pasajeros?: { checkInCompletado: boolean, canceladoAt?: Date | string | null }[] }} datos
 * @param {number} [ahora]
 */
function evaluarCheckIn({ reserva, vuelo, cancelado = false, pasajeros }, ahora = Date.now()) {
  if (reserva.estado !== 'CONFIRMADA') {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'El check-in requiere una reserva confirmada.' }
  }
  if (!vuelo.activo || cancelado) {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'El vuelo está cancelado o no está disponible para check-in.' }
  }
  if (pasajeros && !pasajeros.some((pasajero) => !pasajero.canceladoAt)) {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'La reserva no tiene pasajeros activos para realizar el check-in.' }
  }
  // Un check-in ya realizado sigue completado aunque haya cerrado la ventana online.
  if (pasajeros && checkInCompleto(pasajeros)) {
    return { ok: false, estado: 'COMPLETADO', mensaje: 'Check-in completado.' }
  }

  let despegue
  try {
    const fecha = new Date(`${reserva.fecha}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reserva.fecha) || !Number.isFinite(fecha.getTime()) ||
        fecha.toISOString().slice(0, 10) !== reserva.fecha || !/^([01]\d|2[0-3]):[0-5]\d$/.test(vuelo.horaSalida)) {
      throw new Error('Horario inválido')
    }
    despegue = instanteDespegue(vuelo, reserva.fecha)
    if (!Number.isFinite(despegue) || !Number.isFinite(ahora)) throw new Error('Horario inválido')
  } catch {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'No se pudo verificar el horario de check-in del vuelo.' }
  }

  const apertura = despegue - 14 * 24 * MS_HORA
  const cierre = despegue - 48 * MS_HORA
  if (ahora < apertura) {
    return { ok: false, estado: 'ANTICIPADO', apertura, cierre, mensaje: 'El check-in online todavía no está habilitado.' }
  }
  if (ahora > cierre) {
    return { ok: false, estado: 'VENCIDO', apertura, cierre, mensaje: 'El período de check-in online ha finalizado. Acercate al mostrador del aeropuerto para realizar el check-in.' }
  }
  return { ok: true, estado: 'HABILITADO', apertura, cierre, mensaje: 'El check-in online está habilitado.' }
}

module.exports = { evaluarCheckIn, checkInCompleto }
