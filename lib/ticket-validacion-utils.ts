export interface ValidacionIdentificadorResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export type EstadoValidacionTicket = 'VALIDO' | 'YA_VALIDADO' | 'INVALIDO' | 'INEXISTENTE';

export interface DatosPasajeroTicket {
  nombre: string;
  dni: string;
  telefono: string;
  asiento: string;
  grupoEmbarque: string;
}

export interface DatosVueloTicket {
  codigoVuelo: string;
  origen: string;
  destino: string;
  fecha: string;
  horaSalida: string;
  horaLlegada: string;
  tipoAvion: string;
  clase: string;
  pnr: string;
}

export interface DatosDetalleValidacion {
  ticketId: string;
  validadoAt: string;
  pasajero: DatosPasajeroTicket;
  vuelo: DatosVueloTicket;
}

export interface EvaluacionTicketResult {
  ok: boolean;
  estado: EstadoValidacionTicket;
  mensaje: string;
  datos?: DatosDetalleValidacion;
}

export interface TicketParaValidacion {
  id: string;
  validado: boolean;
  validadoAt?: Date | string | null;
  validadoPorId?: string | null;
  pasajeroReserva?: {
    id: string;
    nombre: string;
    dni: string;
    telefono?: string | null;
    asiento: string | null;
    grupoEmbarque?: string | null;
    canceladoAt?: Date | string | null;
    checkInCompletado: boolean;
    reserva?: {
      id: string;
      clase: string;
      fecha: string;
      estado: string;
      user?: {
        nombre?: string | null;
        apellido?: string | null;
        email?: string | null;
        telefono?: string | null;
        dni?: string | null;
      } | null;
      vuelo?: {
        id: string;
        codigoVuelo: string;
        origen: string;
        destino: string;
        horaSalida: string;
        horaLlegada: string;
        tipoAvion: string;
        activo: boolean;
        cancelaciones?: Array<{ fecha: string }> | null;
      } | null;
    } | null;
  } | null;
}

export function validarIdentificadorTicket(identificador: unknown): ValidacionIdentificadorResult {
  if (typeof identificador !== 'string' || identificador.trim().length === 0) {
    return {
      ok: false,
      error: 'Por favor, ingrese o escanee un identificador de ticket.',
    };
  }

  let id = identificador.trim();
  // Si un lector de QR o código de barras envía una URL o prefijo (ej. 'ticket:uuid' o '/tickets/uuid')
  const urlMatch = id.match(/(?:tickets?[\/:]\s*)([a-zA-Z0-9-]+)/i);
  if (urlMatch && urlMatch[1]) {
    id = urlMatch[1].trim();
  }

  return {
    ok: true,
    id,
  };
}

export function formatearFechaHoraValidacion(fecha: Date | string | number | null | undefined): string {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d);
}

export function evaluarEstadoTicket(ticket: TicketParaValidacion | null | undefined): EvaluacionTicketResult {
  if (!ticket) {
    return {
      ok: false,
      estado: 'INEXISTENTE',
      mensaje: 'Ticket no válido. El identificador ingresado no corresponde a ningún ticket electrónico registrado.',
    };
  }

  if (ticket.validado) {
    const fechaStr = ticket.validadoAt ? ` el ${formatearFechaHoraValidacion(ticket.validadoAt)}` : '';
    return {
      ok: false,
      estado: 'YA_VALIDADO',
      mensaje: `Ticket ya validado previamente${fechaStr}. No puede utilizarse nuevamente para completar el proceso de embarque.`,
    };
  }

  const pax = ticket.pasajeroReserva;
  if (!pax) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. No se encontraron datos del pasajero asociado. Embarque denegado.',
    };
  }

  if (pax.canceladoAt) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. El pasaje de este pasajero ha sido cancelado. Embarque denegado.',
    };
  }

  const reserva = pax.reserva;
  if (!reserva || reserva.estado !== 'CONFIRMADA') {
    const detalle =
      !reserva || reserva.estado === 'CANCELADA'
        ? 'La reserva asociada al ticket se encuentra cancelada.'
        : 'La reserva asociada al ticket no está confirmada.';
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: `Ticket no válido. ${detalle} Embarque denegado.`,
    };
  }

  const vuelo = reserva.vuelo;
  if (!vuelo || !vuelo.activo) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. El vuelo asociado a este ticket se encuentra inactivo. Embarque denegado.',
    };
  }

  const vueloCancelado = vuelo.cancelaciones?.some((c) => c.fecha === reserva.fecha);
  if (vueloCancelado) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. El vuelo correspondiente a la fecha de la reserva fue cancelado. Embarque denegado.',
    };
  }

  if (!pax.checkInCompletado) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. El check-in no ha sido completado para este ticket. Embarque denegado.',
    };
  }

  if (!pax.asiento || pax.asiento.trim().length === 0) {
    return {
      ok: false,
      estado: 'INVALIDO',
      mensaje: 'Ticket no válido. El pasajero no posee un asiento asignado. Embarque denegado.',
    };
  }

  const ahora = new Date();
  return {
    ok: true,
    estado: 'VALIDO',
    mensaje: 'Ticket electrónico válido. Habilitado para continuar con el proceso de embarque.',
    datos: {
      ticketId: ticket.id,
      validadoAt: formatearFechaHoraValidacion(ticket.validadoAt ?? ahora),
      pasajero: {
        nombre: pax.nombre,
        dni: pax.dni,
        telefono: pax.telefono || reserva.user?.telefono || '—',
        asiento: pax.asiento,
        grupoEmbarque: pax.grupoEmbarque || 'General',
      },
      vuelo: {
        codigoVuelo: vuelo.codigoVuelo,
        origen: vuelo.origen,
        destino: vuelo.destino,
        fecha: reserva.fecha,
        horaSalida: vuelo.horaSalida,
        horaLlegada: vuelo.horaLlegada,
        tipoAvion: vuelo.tipoAvion,
        clase: reserva.clase,
        pnr: reserva.id,
      },
    },
  };
}
