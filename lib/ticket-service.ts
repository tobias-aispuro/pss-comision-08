import { renderToBuffer } from '@react-pdf/renderer'
import type { Attachment } from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { enviarEmail } from '@/lib/mailer'
import { TicketPDF } from '@/components/TicketPDF'

const EMAIL_LOCK_MS = 5 * 60 * 1000

type TicketData = {
  reserva: {
    clase: string
    fecha: string
    vuelo: {
      codigoVuelo: string
      origen: string
      destino: string
      horaSalida: string
      horaLlegada: string
    }
  }
  pasajero: {
    nombre: string
    dni: string
    asiento: string
    grupoEmbarque: string | null
  }
}

export type TicketEmissionResult = {
  ticketId: string
  pasajeroReservaId: string
  emailEstado: 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'ERROR'
  emailError?: string
}

export type EmitirTicketsResult = {
  tickets: TicketEmissionResult[]
}

type TicketWithData = {
  id: string
  pasajeroReservaId: string
  emailEstado: TicketEmissionResult['emailEstado']
  pasajeroReserva: {
    nombre: string
    dni: string
    asiento: string
    grupoEmbarque: string | null
    reserva: {
      clase: string
      fecha: string
      user: { email: string }
      vuelo: {
        codigoVuelo: string
        origen: string
        destino: string
        horaSalida: string
        horaLlegada: string
      }
    }
  }
}

function construirDatosTicket(ticket: TicketWithData): TicketData {
  return {
    reserva: {
      clase: ticket.pasajeroReserva.reserva.clase,
      fecha: ticket.pasajeroReserva.reserva.fecha,
      vuelo: ticket.pasajeroReserva.reserva.vuelo,
    },
    pasajero: {
      nombre: ticket.pasajeroReserva.nombre,
      dni: ticket.pasajeroReserva.dni,
      asiento: ticket.pasajeroReserva.asiento,
      grupoEmbarque: ticket.pasajeroReserva.grupoEmbarque,
    },
  }
}

function construirNombreArchivo(ticket: TicketWithData) {
  const nombre = ticket.pasajeroReserva.nombre.replace(/\s+/g, '_')
  return `Ticket_${ticket.pasajeroReserva.reserva.vuelo.codigoVuelo}_${nombre}.pdf`
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caracter] ?? caracter)
}

function construirEmail(ticket: TicketWithData, pdf: Buffer): {
  to: string
  subject: string
  text: string
  html: string
  attachments: Attachment[]
} {
  const { reserva } = ticket.pasajeroReserva
  const pasajero = ticket.pasajeroReserva
  const ruta = `${reserva.vuelo.origen} → ${reserva.vuelo.destino}`
  const asunto = `Tu ticket electrónico ${reserva.vuelo.codigoVuelo}`
  const nombreHtml = escaparHtml(pasajero.nombre)
  const codigoVueloHtml = escaparHtml(reserva.vuelo.codigoVuelo)
  const rutaHtml = escaparHtml(ruta)
  const fechaHtml = escaparHtml(reserva.fecha)

  return {
    to: reserva.user.email,
    subject: asunto,
    text: `Hola ${pasajero.nombre},\n\nAdjuntamos tu ticket electrónico para el vuelo ${reserva.vuelo.codigoVuelo} (${ruta}) del ${reserva.fecha}.`,
    html: `<p>Hola ${nombreHtml},</p><p>Adjuntamos tu ticket electrónico para el vuelo <strong>${codigoVueloHtml}</strong> (${rutaHtml}) del ${fechaHtml}.</p>`,
    attachments: [{
      filename: construirNombreArchivo(ticket),
      content: pdf,
      contentType: 'application/pdf',
    }],
  }
}

async function recuperarOCrearTicket(userId: string, pasajeroReservaId: string): Promise<TicketWithData> {
  const pasajero = await prisma.pasajeroReserva.findFirst({
    where: {
      id: pasajeroReservaId,
      canceladoAt: null,
      checkInCompletado: true,
      asiento: { not: null },
      reserva: {
        userId,
        estado: 'CONFIRMADA',
      },
    },
    include: {
      ticket: true,
      reserva: {
        include: {
          user: { select: { email: true } },
          vuelo: {
            select: {
              codigoVuelo: true,
              origen: true,
              destino: true,
              horaSalida: true,
              horaLlegada: true,
            },
          },
        },
      },
    },
  })

  if (!pasajero) {
    throw new Error('El pasajero no pertenece a una reserva válida con check-in completado.')
  }

  const ticket = await prisma.ticket.upsert({
    where: { pasajeroReservaId: pasajero.id },
    create: { pasajeroReservaId: pasajero.id },
    update: {},
  })

  return {
    id: ticket.id,
    pasajeroReservaId: pasajero.id,
    emailEstado: ticket.emailEstado,
    pasajeroReserva: {
      nombre: pasajero.nombre,
      dni: pasajero.dni,
      asiento: pasajero.asiento as string,
      grupoEmbarque: pasajero.grupoEmbarque,
      reserva: {
        clase: pasajero.reserva.clase,
        fecha: pasajero.reserva.fecha,
        user: pasajero.reserva.user,
        vuelo: pasajero.reserva.vuelo,
      },
    },
  }
}

async function reclamarEnvio(ticket: TicketWithData, ahora: Date) {
  if (ticket.emailEstado === 'ENVIADO') return null

  const lockUntil = new Date(ahora.getTime() + EMAIL_LOCK_MS)
  const condiciones = [
    { emailEstado: 'PENDIENTE' as const, emailLockUntil: null },
    { emailEstado: 'ERROR' as const, emailLockUntil: null },
    { emailEstado: 'ENVIANDO' as const, emailLockUntil: { lt: ahora } },
    { emailEstado: 'ENVIANDO' as const, emailLockUntil: null },
  ]

  const resultado = await prisma.ticket.updateMany({
    where: {
      id: ticket.id,
      OR: condiciones,
    },
    data: {
      emailEstado: 'ENVIANDO',
      emailIntentos: { increment: 1 },
      emailUltimoIntentoAt: ahora,
      emailLockUntil: lockUntil,
      emailError: null,
    },
  })

  return resultado.count === 1 ? lockUntil : null
}

async function enviarTicket(ticket: TicketWithData): Promise<TicketEmissionResult> {
  if (ticket.emailEstado === 'ENVIADO') {
    return {
      ticketId: ticket.id,
      pasajeroReservaId: ticket.pasajeroReservaId,
      emailEstado: 'ENVIADO',
    }
  }

  const ahora = new Date()
  const lockUntil = await reclamarEnvio(ticket, ahora)
  if (!lockUntil) {
    const actual = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { emailEstado: true, emailError: true },
    })
    return {
      ticketId: ticket.id,
      pasajeroReservaId: ticket.pasajeroReservaId,
      emailEstado: actual?.emailEstado ?? 'PENDIENTE',
      emailError: actual?.emailError ?? undefined,
    }
  }

  try {
    const datos = construirDatosTicket(ticket)
    const pdf = await renderToBuffer(TicketPDF(datos))
    await enviarEmail({
      ...construirEmail(ticket, pdf),
    })

    const actualizado = await prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        emailEstado: 'ENVIANDO',
        emailLockUntil: lockUntil,
      },
      data: {
        emailEstado: 'ENVIADO',
        emailEnviadoAt: new Date(),
        emailLockUntil: null,
        emailError: null,
      },
    })

    if (actualizado.count !== 1) {
      const actual = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { emailEstado: true, emailError: true },
      })
      return {
        ticketId: ticket.id,
        pasajeroReservaId: ticket.pasajeroReservaId,
        emailEstado: actual?.emailEstado ?? 'ENVIANDO',
        emailError: actual?.emailError ?? undefined,
      }
    }

    return {
      ticketId: ticket.id,
      pasajeroReservaId: ticket.pasajeroReservaId,
      emailEstado: 'ENVIADO',
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al enviar el ticket.'
    const actualizado = await prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        emailEstado: 'ENVIANDO',
        emailLockUntil: lockUntil,
      },
      data: {
        emailEstado: 'ERROR',
        emailLockUntil: null,
        emailError: mensaje.slice(0, 1000),
      },
    })

    if (actualizado.count !== 1) {
      const actual = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { emailEstado: true, emailError: true },
      })
      return {
        ticketId: ticket.id,
        pasajeroReservaId: ticket.pasajeroReservaId,
        emailEstado: actual?.emailEstado ?? 'ENVIANDO',
        emailError: actual?.emailError ?? undefined,
      }
    }

    return {
      ticketId: ticket.id,
      pasajeroReservaId: ticket.pasajeroReservaId,
      emailEstado: 'ERROR',
      emailError: mensaje,
    }
  }
}

export async function emitirTicketsDeReserva(reservaId: string): Promise<EmitirTicketsResult> {
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') {
    throw new Error('Iniciá sesión como pasajero para emitir tickets.')
  }
  if (!reservaId) {
    throw new Error('La reserva es inválida.')
  }

  const reserva = await prisma.reserva.findFirst({
    where: {
      id: reservaId,
      userId: user.id,
      estado: 'CONFIRMADA',
    },
    select: {
      pasajeros: {
        where: {
          canceladoAt: null,
          checkInCompletado: true,
          asiento: { not: null },
        },
        select: { id: true },
      },
    },
  })

  if (!reserva) {
    throw new Error('La reserva no existe o no pertenece a tu cuenta.')
  }

  const tickets = []
  for (const pasajero of reserva.pasajeros) {
    const ticket = await recuperarOCrearTicket(user.id, pasajero.id)
    tickets.push(await enviarTicket(ticket))
  }

  return { tickets }
}
