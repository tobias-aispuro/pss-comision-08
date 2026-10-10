'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { evaluarCancelacion } from '@/lib/reserva-cancelacion-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CancelarReservaState = {
  error: string
}

class CancelacionError extends Error {}

export async function cancelarReserva(
  _prevState: CancelarReservaState,
  formData: FormData
): Promise<CancelarReservaState> {
  // 1. Auth
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') {
    return { error: 'Tenés que iniciar sesión como pasajero para cancelar una reserva.' }
  }

  const reservaId = formData.get('reservaId')
  if (typeof reservaId !== 'string' || !reservaId) {
    return { error: 'Reserva inválida.' }
  }

  // 2. Se vuelve a validar dentro de la transacción: dueño de la reserva y plazo de 48 hs
  let codigoVuelo: string
  try {
    codigoVuelo = await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findFirst({
        where: { id: reservaId, userId: user.id },
        include: { vuelo: true },
      })
      if (!reserva) {
        throw new CancelacionError('La reserva no existe.')
      }

      const evaluacion = evaluarCancelacion({ reserva, vuelo: reserva.vuelo })
      if (!evaluacion.ok) {
        throw new CancelacionError(evaluacion.motivo)
      }

      // 3. Cancelación en cascada: se anulan los pasajes de todos los pasajeros de la compra.
      //    La reserva pasa a CANCELADA y sus asientos dejan de contar en la disponibilidad del vuelo.
      await tx.pasajeroReserva.updateMany({
        where: { reservaId: reserva.id, canceladoAt: null },
        data: { canceladoAt: new Date() },
      })
      await tx.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'CANCELADA' },
      })

      return reserva.vuelo.codigoVuelo
    })
  } catch (e) {
    if (e instanceof CancelacionError) {
      return { error: e.message }
    }
    console.error('Error al cancelar la reserva:', e)
    return { error: 'No se pudo cancelar la reserva. Intentá nuevamente.' }
  }

  // 4. Revalidar y volver a Mis reservas con el mensaje de confirmación
  revalidatePath('/pasajero')
  revalidatePath('/pasajero/reservas')
  revalidatePath('/pasajero/busquedaVuelo')
  redirect(`/pasajero/reservas?${new URLSearchParams({ cancelada: codigoVuelo })}`)
}
