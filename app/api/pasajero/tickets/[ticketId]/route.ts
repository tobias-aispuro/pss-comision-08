import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { TicketPDF } from '@/components/TicketPDF'

export const runtime = 'nodejs'

function errorJson(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status })
}

function nombreArchivoSeguro(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'SkyLink'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const user = await getCurrentAppUser()

  if (!user) {
    return errorJson('Debés iniciar sesión para descargar el ticket.', 401)
  }

  if (user.rol !== 'PASAJERO') {
    return errorJson('Solo los pasajeros pueden descargar tickets.', 403)
  }

  const { ticketId } = await params
  if (!ticketId) {
    return errorJson('El identificador del ticket es inválido.', 400)
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        pasajeroReserva: {
          reserva: { userId: user.id },
        },
      },
      include: {
        pasajeroReserva: {
          include: {
            reserva: {
              include: {
                vuelo: true,
              },
            },
          },
        },
      },
    })

    if (!ticket) {
      return errorJson('El ticket no existe o no pertenece a tu cuenta.', 404)
    }

    const pasajero = ticket.pasajeroReserva
    const reserva = pasajero.reserva

    if (reserva.estado !== 'CONFIRMADA') {
      return errorJson('El ticket no está disponible porque la reserva no está confirmada.', 409)
    }

    if (pasajero.canceladoAt) {
      return errorJson('El ticket no está disponible porque el pasajero fue cancelado.', 409)
    }

    if (!pasajero.checkInCompletado) {
      return errorJson('Debés completar el check-in antes de descargar el ticket.', 409)
    }

    if (!pasajero.asiento) {
      return errorJson('El ticket no está disponible porque no tiene asiento asignado.', 409)
    }

    const pdf = await renderToBuffer(TicketPDF({
      reserva: {
        clase: reserva.clase,
        fecha: reserva.fecha,
        vuelo: {
          codigoVuelo: reserva.vuelo.codigoVuelo,
          origen: reserva.vuelo.origen,
          destino: reserva.vuelo.destino,
          horaSalida: reserva.vuelo.horaSalida,
          horaLlegada: reserva.vuelo.horaLlegada,
        },
      },
      pasajero: {
        nombre: pasajero.nombre,
        dni: pasajero.dni,
        asiento: pasajero.asiento,
        grupoEmbarque: pasajero.grupoEmbarque,
      },
    }))

    if (pdf.length === 0 || pdf.subarray(0, 5).toString() !== '%PDF-') {
      return errorJson('No se pudo generar un PDF válido.', 500)
    }

    const codigoVuelo = nombreArchivoSeguro(reserva.vuelo.codigoVuelo)
    const nombrePasajero = nombreArchivoSeguro(pasajero.nombre)

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Ticket_${codigoVuelo}_${nombrePasajero}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Error al descargar el ticket electrónico:', error)
    return errorJson('No se pudo descargar el ticket electrónico.', 500)
  }
}
