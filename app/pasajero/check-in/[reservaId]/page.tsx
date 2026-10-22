import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import EstadoCheckIn from '@/components/EstadoCheckIn'
import { evaluarCheckIn } from '@/lib/check-in-utils'
import { construirMapa } from '@/lib/asientos-check-in'
import MapaAsientos from '@/components/MapaAsientos'

export default async function AccesoCheckInPage({ params }: { params: Promise<{ reservaId: string }> }) {
  const user = await requireRole(['PASAJERO'])
  const { reservaId } = await params
  // Volver a consultar al entrar evita eludir el control con una URL directa o una pantalla antigua.
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, userId: user.id, pasajeros: { some: { canceladoAt: null } } },
    include: {
      vuelo: { include: { cancelaciones: { select: { fecha: true } } } },
      pasajeros: { where: { canceladoAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, nombre: true, asiento: true, checkInCompletado: true } },
    },
  })
  if (!reserva) notFound()
  // eslint-disable-next-line react-hooks/purity -- Página de servidor: revalidar el horario actual en cada acceso.
  const ahora = Date.now()
  const cancelado = reserva.vuelo.cancelaciones.some((c) => c.fecha === reserva.fecha)
  const acceso = evaluarCheckIn({ reserva, vuelo: reserva.vuelo, cancelado }, ahora)
  const ocupados = acceso.ok ? await prisma.pasajeroReserva.findMany({
    where: { canceladoAt: null, asiento: { not: null }, reserva: { vueloId: reserva.vueloId, fecha: reserva.fecha, estado: 'CONFIRMADA' } },
    select: { asiento: true },
  }) : []

  return (
    <main className="flex-1 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/pasajero/check-in" className="text-sm font-semibold text-sky-700 hover:underline">← Check-in online</Link>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Check-in · {reserva.vuelo.codigoVuelo}</h2>
          <p className="mt-2 text-slate-600">{reserva.vuelo.origen} → {reserva.vuelo.destino}</p>
          <p className="mt-1 text-sm text-slate-500">Salida: {reserva.fecha.split('-').reverse().join('/')} · {reserva.vuelo.horaSalida} (hora del aeropuerto de origen)</p>
          <EstadoCheckIn reservaId={reserva.id} fecha={reserva.fecha} estado={reserva.estado}
            vuelo={{ horaSalida: reserva.vuelo.horaSalida, zonaOrigen: reserva.vuelo.zonaOrigen, activo: reserva.vuelo.activo }}
            cancelado={cancelado} ahora={ahora} acceso={acceso.ok}>
            {acceso.ok && (
              <MapaAsientos reservaId={reserva.id} clase={reserva.clase} mapa={construirMapa(reserva.vuelo)}
                pasajeros={reserva.pasajeros} ocupadosIniciales={ocupados.flatMap((p) => p.asiento ? [p.asiento] : [])} />
            )}
          </EstadoCheckIn>
        </section>
      </div>
    </main>
  )
}
