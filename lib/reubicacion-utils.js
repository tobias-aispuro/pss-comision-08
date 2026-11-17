/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS para compartir las reglas con node --test. */
const { validarSalida, asientosDisponibles } = require('./compra-utils')
const { instanteDespegue } = require('./reserva-cancelacion-utils')
const { esFechaValida, fechaDeHoy } = require('./search-utils')

/**
 * Pasajes de la reserva que siguen activos (los cancelados por el pasajero no se reubican).
 * @template {{ canceladoAt?: Date | string | null }} P
 * @param {P[]} pasajeros
 * @returns {P[]}
 */
function pasajerosActivos(pasajeros) {
  return pasajeros.filter((pasajero) => !pasajero.canceladoAt)
}

/**
 * Una reserva se puede reubicar si la canceló el admin al cancelar el vuelo (no el pasajero),
 * estaba paga y le quedan pasajeros activos.
 * @param {{ estado: string, canceladaPorVuelo?: boolean, pagadoAt?: Date | string | null }} reserva
 * @param {{ canceladoAt?: Date | string | null }[]} pasajeros
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
function evaluarReubicable(reserva, pasajeros) {
  if (reserva.estado !== 'CANCELADA' || !reserva.canceladaPorVuelo) {
    return { ok: false, motivo: 'La reserva no está afectada por la cancelación de un vuelo.' }
  }
  if (!reserva.pagadoAt) {
    return { ok: false, motivo: 'La reserva no estaba paga: el pasajero tiene que hacer una compra nueva.' }
  }
  if (pasajerosActivos(pasajeros).length === 0) {
    return { ok: false, motivo: 'La reserva no tiene pasajeros activos para reubicar.' }
  }
  return { ok: true }
}

/**
 * Valida el vuelo alternativo elegido para una reserva afectada.
 * Tiene que ser la misma ruta, otra salida, con despegue futuro y lugar en la misma clase
 * para todos los pasajeros activos.
 * @param {{
 *   reserva: { vueloId: string, fecha: string, clase: string },
 *   vueloOriginal: { origen: string, destino: string },
 *   alternativa: { id: string, origen: string, destino: string, horaSalida: string, zonaOrigen?: string | null, activo: boolean, periodoDesde: string, periodoHasta: string, diasOperacion: string[] } | null,
 *   fecha: string,
 *   canceladas?: string[],
 *   reservados: number,
 *   cantidad: number,
 * }} datos
 * @param {number} [ahora]
 * @returns {{ ok: true, disponibles: number | null } | { ok: false, motivo: string, sinLugar?: boolean }}
 */
function validarAlternativa(
  { reserva, vueloOriginal, alternativa, fecha, canceladas = [], reservados, cantidad },
  ahora = Date.now()
) {
  if (!alternativa) {
    return { ok: false, motivo: 'El vuelo alternativo no existe.' }
  }
  if (alternativa.origen !== vueloOriginal.origen || alternativa.destino !== vueloOriginal.destino) {
    return { ok: false, motivo: 'El vuelo alternativo tiene que cubrir la misma ruta que el vuelo cancelado.' }
  }
  if (alternativa.id === reserva.vueloId && fecha === reserva.fecha) {
    return { ok: false, motivo: 'Esa es la salida que fue cancelada.' }
  }
  if (!esFechaValida(fecha) || fecha < fechaDeHoy(new Date(ahora))) {
    return { ok: false, motivo: 'Elegí una fecha a partir de hoy.' }
  }

  const errorSalida = validarSalida(alternativa, fecha, reserva.clase, canceladas, fechaDeHoy(new Date(ahora)))
  if (errorSalida) {
    return { ok: false, motivo: errorSalida }
  }

  let despegue
  try {
    despegue = instanteDespegue(alternativa, fecha)
  } catch {
    despegue = NaN
  }
  if (!Number.isFinite(despegue) || despegue <= ahora) {
    return { ok: false, motivo: 'Ese vuelo ya despegó o no tiene un horario válido.' }
  }

  const disponibles = asientosDisponibles(alternativa, reserva.clase, reservados)
  if (disponibles !== null && disponibles < cantidad) {
    return {
      ok: false,
      sinLugar: true,
      motivo: `No es posible completar la reubicación: el vuelo no tiene disponibilidad para ${cantidad} ${cantidad === 1 ? 'pasajero' : 'pasajeros'} en esa clase.`,
    }
  }

  return { ok: true, disponibles }
}

// La reserva reubicada vuelve a quedar confirmada (solo se reubican reservas pagas).
const ESTADO_TRAS_REUBICACION = 'CONFIRMADA'

module.exports = {
  pasajerosActivos,
  evaluarReubicable,
  validarAlternativa,
  ESTADO_TRAS_REUBICACION,
}
