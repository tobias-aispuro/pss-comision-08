'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { calculatePaymentTotal, esReservaExpirada } from '@/lib/payment-utils'

type PaymentInput = {
  reservaId: string
  idaId?: string
  metodo: 'CREDITO' | 'DEBITO'
  cuotas: number
  tiempoExpirado?: boolean
}

type PaymentResult = { error?: string }

export async function confirmarPagoSimulado(input: PaymentInput): Promise<PaymentResult> {
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') {
    return { error: 'Iniciá sesión como pasajero para continuar.' }
  }

  if (!['CREDITO', 'DEBITO'].includes(input.metodo)) {
    return { error: 'El medio de pago seleccionado no es válido.' }
  }

  if (![1, 3, 6].includes(input.cuotas) || (input.metodo === 'DEBITO' && input.cuotas !== 1)) {
    return { error: 'El plan de cuotas seleccionado no es válido.' }
  }

  const reservationIds = [...new Set([input.reservaId, input.idaId].filter((id): id is string => Boolean(id)))]
  let total: number
  let reservaExpirada = false

  try {
    total = await prisma.$transaction(async (transaction) => {
      const reservations = await transaction.reserva.findMany({
        where: { id: { in: reservationIds }, userId: user.id },
        include: { vuelo: true },
      })

      if (reservations.length !== reservationIds.length) {
        throw new Error('No se encontró la reserva o no pertenece a tu cuenta.')
      }

      if (
        input.tiempoExpirado ||
        reservations.some(
          (reservation) => reservation.estado === 'CANCELADA' || esReservaExpirada(reservation.createdAt)
        )
      ) {
        await transaction.pasajeroReserva.updateMany({
          where: { reservaId: { in: reservationIds }, canceladoAt: null },
          data: { canceladoAt: new Date() },
        })
        await transaction.reserva.updateMany({
          where: { id: { in: reservationIds } },
          data: { estado: 'CANCELADA' },
        })
        reservaExpirada = true
        return 0
      }

      if (reservations.some((reservation) => reservation.estado !== 'PENDIENTE')) {
        throw new Error('Solo se pueden pagar reservas pendientes.')
      }

      const amount = calculatePaymentTotal(reservations)
      const paidAt = new Date()

      await Promise.all(reservations.map((reservation) => {
        const price = reservation.clase === 'PRIMERA'
          ? reservation.vuelo.precioPrimera
          : reservation.vuelo.precioEconomy

        return transaction.reserva.update({
          where: { id: reservation.id },
          data: {
            estado: 'CONFIRMADA',
            metodoPago: input.metodo,
            cuotasPago: input.cuotas,
            importePagado: price! * reservation.asientos,
            pagadoAt: paidAt,
          },
        })
      }))

      return amount
    })
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : 'No se pudo confirmar el pago simulado. Intentá nuevamente.',
    }
  }

  if (reservaExpirada) {
    revalidatePath('/pasajero/reservas')
    revalidatePath('/pasajero/busquedaVuelo')
    redirect('/pasajero/busquedaVuelo?error=El%20tiempo%20para%20completar%20la%20compra%20ha%20expirado.%20La%20reserva%20ha%20sido%20cancelada%20y%20los%20asientos%20liberados')
  }

  if (!Number.isSafeInteger(total) || total <= 0) {
    return { error: 'El importe de la reserva no es válido.' }
  }

  revalidatePath('/pasajero/reservas')
  revalidatePath(`/pasajero/compra/${input.reservaId}`)

  const confirmation = new URLSearchParams({ pagado: '1' })
  if (input.idaId) confirmation.set('ida', input.idaId)
  redirect(`/pasajero/compra/${input.reservaId}?${confirmation}`)
}

export async function cancelarPorExpiracion(reservaId: string, idaId?: string): Promise<void> {
  const user = await getCurrentAppUser()
  if (user?.rol === 'PASAJERO') {
    const reservationIds = [...new Set([reservaId, idaId].filter((id): id is string => Boolean(id)))]
    await prisma.$transaction(async (tx) => {
      await tx.pasajeroReserva.updateMany({
        where: { reservaId: { in: reservationIds }, canceladoAt: null },
        data: { canceladoAt: new Date() },
      })
      await tx.reserva.updateMany({
        where: { id: { in: reservationIds }, userId: user.id },
        data: { estado: 'CANCELADA' },
      })
    })
    revalidatePath('/pasajero/reservas')
    revalidatePath('/pasajero/busquedaVuelo')
  }
  redirect('/pasajero/busquedaVuelo?error=El%20tiempo%20para%20completar%20la%20compra%20ha%20expirado.%20La%20reserva%20ha%20sido%20cancelada%20y%20los%20asientos%20liberados')
}
