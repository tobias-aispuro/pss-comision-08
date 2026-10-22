/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS para compartir la regla con node --test. */
const { instanteDespegue } = require('./reserva-cancelacion-utils')

const MS_HORA = 60 * 60 * 1000

/**
 * Ventana inclusiva: desde 14 días hasta 48 horas antes del despegue.
 * Usa la fecha de la reserva y el huso del aeropuerto de origen.
 * @param {{ reserva: { fecha: string, estado: string }, vuelo: { horaSalida: string, zonaOrigen?: string | null, activo: boolean }, cancelado?: boolean }} datos
 * @param {number} [ahora]
 */
function evaluarCheckIn({ reserva, vuelo, cancelado = false }, ahora = Date.now()) {
  if (reserva.estado !== 'CONFIRMADA') {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'El check-in requiere una reserva confirmada.' }
  }
  if (!vuelo.activo || cancelado) {
    return { ok: false, estado: 'BLOQUEADO', mensaje: 'El vuelo está cancelado o no está disponible para check-in.' }
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
    return { ok: false, estado: 'VENCIDO', apertura, cierre, mensaje: 'El período de check-in online ha finalizado.' }
  }
  return { ok: true, estado: 'HABILITADO', apertura, cierre, mensaje: 'El check-in online está habilitado.' }
}

module.exports = { evaluarCheckIn }
