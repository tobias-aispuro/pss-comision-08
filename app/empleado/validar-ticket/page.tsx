import { requireRole } from '@/lib/role-access';
import { prisma } from '@/lib/prisma';
import { formatearFechaHoraValidacion } from '@/lib/ticket-validacion-utils';
import ValidadorTicket from '@/components/ValidadorTicket';

export default async function ValidarTicketPage() {
  await requireRole(['EMPLEADO_MOSTRADOR']);

  // Consultamos los últimos tickets emitidos para facilitar la operativa en mostrador
  const ticketsRecientes = await prisma.ticket.findMany({
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

  const ticketsRecientesMapeados = ticketsRecientes.map((t) => ({
    id: t.id,
    pasajeroNombre: t.pasajeroReserva?.nombre ?? 'Desconocido',
    pasajeroDni: t.pasajeroReserva?.dni ?? '—',
    codigoVuelo: t.pasajeroReserva?.reserva?.vuelo?.codigoVuelo ?? '—',
    asiento: t.pasajeroReserva?.asiento ?? null,
    validado: t.validado,
    validadoAt: t.validadoAt ? formatearFechaHoraValidacion(t.validadoAt) : null,
  }));

  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Mostrador <span className="text-slate-400">›</span> Validación de tickets
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Validación de tickets electrónicos
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulte y valide el ticket electrónico presentado por el pasajero al momento del embarque.
            El sistema registrará la validación e impedirá reusar tickets ya utilizados.
          </p>
        </div>

        <ValidadorTicket initialTicketsRecientes={ticketsRecientesMapeados} />
      </div>
    </main>
  );
}
