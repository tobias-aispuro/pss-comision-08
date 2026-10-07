/**
 * @typedef {{ codigoVuelo: string, origen: string, destino: string, horaSalida: string }} VueloCancelado
 * @typedef {{ fecha: string, user: { email: string, nombre: string, apellido: string } }} ReservaAfectada
 * @typedef {{ email: string, nombre: string, apellido: string, fechas: string[] }} PasajeroAfectado
 * @typedef {{ to: string, subject: string, text: string, html: string }} Email
 */

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatearFecha(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Un destinatario por pasajero, con todas sus fechas afectadas en orden.
 * @param {ReservaAfectada[]} reservas
 * @returns {PasajeroAfectado[]}
 */
function agruparPorPasajero(reservas) {
  const porEmail = new Map()

  for (const { fecha, user } of reservas) {
    if (!user?.email) continue

    const pasajero = porEmail.get(user.email) ?? {
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      fechas: [],
    }

    if (!pasajero.fechas.includes(fecha)) {
      pasajero.fechas.push(fecha)
    }
    porEmail.set(user.email, pasajero)
  }

  return [...porEmail.values()].map((pasajero) => ({ ...pasajero, fechas: [...pasajero.fechas].sort() }))
}

/**
 * @param {{ vuelo: VueloCancelado, pasajero: PasajeroAfectado, motivo?: string, definitiva?: boolean }} datos
 * @returns {Email}
 */
function armarEmailCancelacion({ vuelo, pasajero, motivo = '', definitiva = false }) {
  const fechas = pasajero.fechas.map(formatearFecha)
  const unaFecha = fechas.length === 1

  const subject = unaFecha
    ? `SkyLink: tu vuelo ${vuelo.codigoVuelo} del ${fechas[0]} fue cancelado`
    : `SkyLink: tu vuelo ${vuelo.codigoVuelo} fue cancelado`

  const saludo = `Hola ${pasajero.nombre} ${pasajero.apellido}:`
  const detalle = `${vuelo.codigoVuelo} (${vuelo.origen} → ${vuelo.destino}), con salida a las ${vuelo.horaSalida}`
  const intro = unaFecha
    ? `Te informamos que el vuelo ${detalle}, fue cancelado para la siguiente fecha:`
    : `Te informamos que el vuelo ${detalle}, fue cancelado para las siguientes fechas:`
  const explicacion = definitiva
    ? 'SkyLink dejó de operar este vuelo de manera definitiva.'
    : motivo
      ? `Motivo: ${motivo}`
      : ''
  const estado = unaFecha
    ? 'Tu reserva para esa salida quedó cancelada.'
    : 'Tus reservas para esas salidas quedaron canceladas.'
  const cierre = 'Lamentamos los inconvenientes. Podés buscar un vuelo alternativo desde tu panel de pasajero.'
  const firma = 'Equipo SkyLink'

  const text = [
    saludo,
    '',
    intro,
    ...fechas.map((fecha) => `- ${fecha}`),
    '',
    ...(explicacion ? [explicacion] : []),
    estado,
    '',
    cierre,
    '',
    firma,
  ].join('\n')

  const html = [
    `<p>${escaparHtml(saludo)}</p>`,
    `<p>${escaparHtml(intro)}</p>`,
    `<ul>${fechas.map((fecha) => `<li>${escaparHtml(fecha)}</li>`).join('')}</ul>`,
    ...(explicacion ? [`<p>${escaparHtml(explicacion)}</p>`] : []),
    `<p>${escaparHtml(estado)}</p>`,
    `<p>${escaparHtml(cierre)}</p>`,
    `<p>${escaparHtml(firma)}</p>`,
  ].join('\n')

  return { to: pasajero.email, subject, text, html }
}

/**
 * Envía un email por pasajero afectado. Un envío fallido no frena al resto.
 * @param {{ vuelo: VueloCancelado, reservas: ReservaAfectada[], motivo?: string, definitiva?: boolean }} datos
 * @param {(email: Email) => Promise<unknown>} enviar
 * @returns {Promise<{ notificados: number, fallidos: string[] }>}
 */
async function notificarCancelacion({ vuelo, reservas, motivo, definitiva }, enviar) {
  const pasajeros = agruparPorPasajero(reservas)

  const resultados = await Promise.allSettled(
    pasajeros.map(async (pasajero) => enviar(armarEmailCancelacion({ vuelo, pasajero, motivo, definitiva })))
  )

  const fallidos = []
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'rejected') {
      fallidos.push(pasajeros[i].email)
      console.error(`No se pudo notificar la cancelación a ${pasajeros[i].email}:`, resultado.reason)
    }
  })

  return { notificados: pasajeros.length - fallidos.length, fallidos }
}

module.exports = {
  agruparPorPasajero,
  armarEmailCancelacion,
  notificarCancelacion,
}
