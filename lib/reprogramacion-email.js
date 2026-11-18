/**
 * @typedef {{ codigoVuelo: string, origen: string, destino: string, horaSalida: string }} VueloReprogramado
 * @typedef {{ fecha: string, horaSalida: string, horaLlegada: string }} CambioHorario
 * @typedef {{ fecha: string, user: { email: string, nombre: string, apellido: string } }} ReservaAfectada
 * @typedef {{ email: string, nombre: string, apellido: string, cambios: CambioHorario[] }} PasajeroAfectado
 * @typedef {{ to: string, subject: string, text: string, html: string }} Email
 */

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
})

const formatoHora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
})

function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.split('-').map(Number)
    return formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
}

function formatearHora(horaString) {
    const [horas, minutos] = horaString.split(':')
    return formatoHora.format(new Date(Date.UTC(2000, 0, 1, horas, minutos)))
}

function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * Agrupa cambios por pasajero, eliminando duplicados.
 * @param {ReservaAfectada[]} reservas
 * @param {{ [fecha: string]: CambioHorario }} cambiosPorFecha
 * @returns {PasajeroAfectado[]}
 */
function agruparPorPasajero(reservas, cambiosPorFecha) {
    const porEmail = new Map()

    for (const { fecha, user } of reservas) {
        if (!user?.email || !cambiosPorFecha[fecha]) continue

        const pasajero = porEmail.get(user.email) ?? {
            email: user.email,
            nombre: user.nombre,
            apellido: user.apellido,
            cambios: [],
        }

        // Evitar cambios duplicados
        const cambioYaExiste = pasajero.cambios.some((c) => c.fecha === fecha)
        if (!cambioYaExiste) {
            pasajero.cambios.push({ fecha, ...cambiosPorFecha[fecha] })
        }
        porEmail.set(user.email, pasajero)
    }

    return [...porEmail.values()].map((pasajero) => ({
        ...pasajero,
        cambios: [...pasajero.cambios].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }))
}

/**
 * @param {{ vuelo: VueloReprogramado, pasajero: PasajeroAfectado }} datos
 * @returns {Email}
 */
function armarEmailReprogramacion({ vuelo, pasajero }) {
    const unCambio = pasajero.cambios.length === 1
    const cambio = pasajero.cambios[0]

    const subject = unCambio
        ? `SkyLink: tu vuelo ${vuelo.codigoVuelo} del ${formatearFecha(cambio.fecha)} fue reprogramado`
        : `SkyLink: tu vuelo ${vuelo.codigoVuelo} fue reprogramado`

    const saludo = `Hola ${pasajero.nombre} ${pasajero.apellido}:`
    const detalle = `${vuelo.codigoVuelo} (${vuelo.origen} → ${vuelo.destino})`
    const intro = unCambio
        ? `Te informamos que el vuelo ${detalle} fue reprogramado. Aquí están los nuevos horarios:`
        : `Te informamos que el vuelo ${detalle} fue reprogramado en los siguientes horarios:`
    const cambiosTexto = pasajero.cambios
        .map(
            (c) =>
                `Fecha: ${formatearFecha(c.fecha)}\nNueva salida: ${formatearHora(c.horaSalida)} | Llegada: ${formatearHora(c.horaLlegada)}`
        )
        .join('\n\n')
    const cierre =
        'Revisá tu reserva en el panel de pasajero para confirmar tu disponibilidad. Si tenés problemas, contactá a nuestro equipo.'
    const firma = 'Equipo SkyLink'

    const text = [saludo, '', intro, '', cambiosTexto, '', cierre, '', firma].join('\n')

    const html = [
        `<p>${escaparHtml(saludo)}</p>`,
        `<p>${escaparHtml(intro)}</p>`,
        '<ul>',
        ...pasajero.cambios.map(
            (c) =>
                `<li><strong>${escaparHtml(formatearFecha(c.fecha))}</strong><br/>` +
                `Nueva salida: ${escaparHtml(formatearHora(c.horaSalida))} | Llegada: ${escaparHtml(formatearHora(c.horaLlegada))}</li>`
        ),
        '</ul>',
        `<p>${escaparHtml(cierre)}</p>`,
        `<p>${escaparHtml(firma)}</p>`,
    ].join('\n')

    return { to: pasajero.email, subject, text, html }
}

/**
 * Envía un email por pasajero afectado. Un envío fallido no frena al resto.
 * @param {{ vuelo: VueloReprogramado, reservas: ReservaAfectada[], cambiosPorFecha: { [fecha: string]: CambioHorario } }} datos
 * @param {(email: Email) => Promise<unknown>} enviar
 * @returns {Promise<{ notificados: number, fallidos: string[] }>}
 */
async function notificarReprogramacion({ vuelo, reservas, cambiosPorFecha }, enviar) {
    const pasajeros = agruparPorPasajero(reservas, cambiosPorFecha)

    const resultados = await Promise.allSettled(
        pasajeros.map(async (pasajero) =>
            enviar(armarEmailReprogramacion({ vuelo, pasajero }))
        )
    )

    const fallidos = []
    resultados.forEach((resultado, i) => {
        if (resultado.status === 'rejected') {
            fallidos.push(pasajeros[i].email)
            console.error(`No se pudo notificar la reprogramación a ${pasajeros[i].email}:`, resultado.reason)
        }
    })

    return { notificados: pasajeros.length - fallidos.length, fallidos }
}

module.exports = {
    agruparPorPasajero,
    armarEmailReprogramacion,
    notificarReprogramacion,
}