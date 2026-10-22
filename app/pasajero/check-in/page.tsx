import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import EstadoCheckIn from '@/components/EstadoCheckIn'

export default async function CheckInPage() {
  const user = await requireRole(['PASAJERO'])
  const reservas = await prisma.reserva.findMany({
    where: { userId: user.id, estado: 'CONFIRMADA', pasajeros: { some: { canceladoAt: null } } },
    include: { vuelo: { include: { cancelaciones: { select: { fecha: true } } } } },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
  })
  // eslint-disable-next-line react-hooks/purity -- Página de servidor: evaluar la ventana al recibir la solicitud autenticada.
  const ahora = Date.now()

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Check-in online</h2>
        <p className="mt-2 text-sm text-slate-600">Disponible desde 14 días hasta 48 horas antes de la salida de tu vuelo.</p>
        <div className="mt-6 space-y-4">
          {reservas.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No tenés reservas confirmadas para realizar el check-in.</p>
          )}
          {reservas.map((reserva) => (
            <article key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{reserva.vuelo.codigoVuelo} · {reserva.vuelo.origen} → {reserva.vuelo.destino}</h3>
              <p className="mt-1 text-sm text-slate-600">Salida: {reserva.fecha.split('-').reverse().join('/')} · {reserva.vuelo.horaSalida} (hora del aeropuerto de origen)</p>
              <EstadoCheckIn reservaId={reserva.id} fecha={reserva.fecha} estado={reserva.estado}
                vuelo={{ horaSalida: reserva.vuelo.horaSalida, zonaOrigen: reserva.vuelo.zonaOrigen, activo: reserva.vuelo.activo }}
                cancelado={reserva.vuelo.cancelaciones.some((c) => c.fecha === reserva.fecha)} ahora={ahora} />
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
