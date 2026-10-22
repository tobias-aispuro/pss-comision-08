import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { calculatePaymentTotal, formatearARS } from '@/lib/payment-utils'
import PagoSimuladoForm from './PagoSimuladoForm'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

export default async function PagoReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ reservaId: string }>
  searchParams: Promise<{ ida?: string }>
}) {
  const user = await requireRole(['PASAJERO'])
  const { reservaId } = await params
  const { ida: idaId } = await searchParams
  const reservationIds = [...new Set([reservaId, idaId].filter((id): id is string => Boolean(id)))]

  const reservations = await prisma.reserva.findMany({
    where: { id: { in: reservationIds }, userId: user.id },
    include: {
      vuelo: true,
      pasajeros: { where: { canceladoAt: null }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (reservations.length !== reservationIds.length) notFound()

  const currentReservation = reservations.find((reservation) => reservation.id === reservaId)
  if (!currentReservation) notFound()

  const backUrl = `/pasajero/compra/${reservaId}${idaId ? `?ida=${encodeURIComponent(idaId)}` : ''}`
  const reservationError = reservations.some((reservation) => reservation.estado !== 'PENDIENTE')
    ? 'Esta reserva ya no está pendiente de pago.'
    : null

  let total = 0
  let fareError: string | null = null
  try {
    total = calculatePaymentTotal(reservations)
  } catch (error) {
    fareError = error instanceof Error ? error.message : 'No se pudo calcular el importe de la reserva.'
  }

  const paymentError = reservationError ?? fareError
  const paymentItems = reservations.map((reservation) => {
    const unitPrice = reservation.clase === 'PRIMERA'
      ? reservation.vuelo.precioPrimera
      : reservation.vuelo.precioEconomy

    return {
      id: reservation.id,
      codigoVuelo: reservation.vuelo.codigoVuelo,
      origen: reservation.vuelo.origen,
      destino: reservation.vuelo.destino,
      fecha: reservation.fecha,
      clase: reservation.clase === 'PRIMERA' ? 'Primera' : 'Economy',
      asientos: reservation.asientos,
      pasajeros: reservation.pasajeros.length,
      unitPrice,
      subtotal: (unitPrice ?? 0) * reservation.asientos,
    }
  })

  return (
    <main className="min-h-screen bg-[#f6f7fc] px-4 py-6 text-slate-800 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 sm:text-sm" aria-label="Pasos de compra">
          <li className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">1. Vuelo</li>
          <li aria-hidden="true">›</li>
          <li className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">2. Pasajeros</li>
          <li aria-hidden="true">›</li>
          <li aria-current="step" className="rounded-full bg-sky-800 px-3 py-2 text-white">3. Pago seguro</li>
          <li aria-hidden="true">›</li>
          <li className="rounded-full bg-white px-3 py-2 text-slate-400">4. Confirmación</li>
        </ol>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">Pago de reserva</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Finalizar y abonar reserva</h1>
            </div>

            {paymentError ? (
              <div className="space-y-4">
                <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{paymentError}</p>
                <Link href={backUrl} className="inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Volver al resumen
                </Link>
              </div>
            ) : (
              <PagoSimuladoForm
                reservaId={reservaId}
                idaId={idaId}
                total={total}
              />
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-[#006b7b] p-5 text-white">
                <div className="flex items-start justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/75">
                  <span>Vuelo regular directo</span>
                  <span>Reserva {currentReservation.id.slice(-6).toUpperCase()}</span>
                </div>
                {paymentItems.map((item) => (
                  <div key={item.id} className="mt-4 border-t border-white/20 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-3xl font-bold">{item.origen.slice(0, 3).toUpperCase()}</span>
                      <span className="text-xs text-white/80">{item.codigoVuelo} · {item.clase}</span>
                      <span className="text-3xl font-bold">{item.destino.slice(0, 3).toUpperCase()}</span>
                    </div>
                    <p className="mt-2 text-xs text-white/80">{item.origen} → {item.destino}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4 p-5">
                {paymentItems.map((item) => (
                  <div key={item.id} className="space-y-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between gap-4 text-xs text-slate-600">
                      <span>{formatDate(item.fecha)} · {item.codigoVuelo}</span>
                      <span>{item.asientos} {item.asientos === 1 ? 'pasaje' : 'pasajes'}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-slate-600">Tarifa {item.clase} ({item.asientos} × {formatearARS(item.unitPrice ?? 0)})</span>
                      <span className="font-semibold text-slate-800">{formatearARS(item.subtotal)}</span>
                    </div>
                  </div>
                ))}

                <div className="flex items-end justify-between border-t border-slate-200 pt-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Importe total</p>
                      <p className="text-xs text-slate-500">Total por pasajes</p>
                  </div>
                  <p className="text-2xl font-bold text-[#006b7b]">{formatearARS(total)}</p>
                </div>
              </div>
            </section>

            <Link href={backUrl} className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50">
              Volver al resumen
            </Link>
          </aside>
        </div>
      </div>
    </main>
  )
}
