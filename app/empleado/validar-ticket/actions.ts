'use server'

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/role-access';
import {
  evaluarEstadoTicket,
  formatearFechaHoraValidacion,
  validarIdentificadorTicket,
  type EvaluacionTicketResult,
} from '@/lib/ticket-validacion-utils';

export type ResultadoValidacionTicket = EvaluacionTicketResult;

export type TicketRecienteInfo = {
  id: string;
  pasajeroNombre: string;
  pasajeroDni: string;
  codigoVuelo: string;
  asiento: string | null;
  validado: boolean;
  validadoAt: string | null;
};

export async function validarTicketAction(
  identificador: unknown
): Promise<ResultadoValidacionTicket> {
  const empleado = await requireRole(['EMPLEADO_MOSTRADOR']);

  const validacionId = validarIdentificadorTicket(identificador);
  if (!validacionId.ok || !validacionId.id) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: validacionId.error || 'Por favor, ingrese o escanee un identificador de ticket.',
    };
  }

  const ticketId = validacionId.id;
  const ticketIdLower = ticketId.toLowerCase();

  // Buscamos por el ID exacto o en minúsculas para tolerar scanners que envían mayúsculas
  let ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      pasajeroReserva: {
        include: {
          reserva: {
            include: {
              user: true,
              vuelo: {
                include: {
                  cancelaciones: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket && ticketId !== ticketIdLower) {
    ticket = await prisma.ticket.findUnique({
      where: { id: ticketIdLower },
      include: {
        pasajeroReserva: {
          include: {
            reserva: {
              include: {
                user: true,
                vuelo: {
                  include: {
                    cancelaciones: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  const evaluacion = evaluarEstadoTicket(ticket);
  if (!evaluacion.ok) {
    return evaluacion;
  }

  const canonicalTicketId = ticket!.id;
  const ahora = new Date();

  // Actualización atómica para evitar colisiones concurrentes
  const updated = await prisma.ticket.updateMany({
    where: {
      id: canonicalTicketId,
      validado: false,
    },
    data: {
      validado: true,
      validadoAt: ahora,
      validadoPorId: empleado.id,
    },
  });

  if (updated.count === 0) {
    // Si count === 0, otro empleado o proceso lo validó en paralelo
    const ticketExistente = await prisma.ticket.findUnique({
      where: { id: canonicalTicketId },
      select: { validadoAt: true },
    });

    const fechaStr = ticketExistente?.validadoAt
      ? ` el ${formatearFechaHoraValidacion(ticketExistente.validadoAt)}`
      : '';

    return {
      ok: false,
      estado: 'YA_VALIDADO',
      mensaje: `Ticket ya validado previamente${fechaStr}. No puede utilizarse nuevamente para completar el proceso de embarque.`,
    };
  }

  if (evaluacion.datos) {
    evaluacion.datos.validadoAt = formatearFechaHoraValidacion(ahora);
  }

  return evaluacion;
}

export async function obtenerTicketsRecientesAction(): Promise<TicketRecienteInfo[]> {
  await requireRole(['EMPLEADO_MOSTRADOR']);

  const tickets = await prisma.ticket.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
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
  });

  return tickets.map((t) => ({
    id: t.id,
    pasajeroNombre: t.pasajeroReserva?.nombre ?? 'Desconocido',
    pasajeroDni: t.pasajeroReserva?.dni ?? '—',
    codigoVuelo: t.pasajeroReserva?.reserva?.vuelo?.codigoVuelo ?? '—',
    asiento: t.pasajeroReserva?.asiento ?? null,
    validado: t.validado,
    validadoAt: t.validadoAt ? formatearFechaHoraValidacion(t.validadoAt) : null,
  }));
}
