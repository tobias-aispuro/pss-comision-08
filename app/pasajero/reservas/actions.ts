'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { evaluarCancelacion } from '@/lib/reserva-cancelacion-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CancelarPasajeState = {
  error: string
}

class CancelacionError extends Error {}

export async function cancelarMiPasaje(
  _prevState: CancelarPasajeState,
  formData: FormData
): Promise<CancelarPasajeState> {
  // 1. Auth
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') {
    return { error: 'Tenés que iniciar sesión como pasajero para cancelar un pasaje.' }
  }

  const reservaId = formData.get('reservaId')
  if (typeof reservaId !== 'string' || !reservaId) {
    return { error: 'Reserva inválida.' }
  }

  // 2. Se vuelve a validar dentro de la transacción: dueño de la reserva, pasaje del titular y plazo de 48 hs
  let codigoVuelo: string
  try {
    codigoVuelo = await prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.findFirst({
        where: { id: reservaId, userId: user.id },
        include: { vuelo: true, pasajeros: true },
      })
      if (!reserva) {
        throw new CancelacionError('La reserva no existe.')
      }

      const evaluacion = evaluarCancelacion({
        reserva,
        vuelo: reserva.vuelo,
        pasajeros: reserva.pasajeros,
        dniTitular: user.dni,
      })
      if (!evaluacion.ok) {
        throw new CancelacionError(evaluacion.motivo)
      }

      // 3. Se anula solo el pasaje del titular y se libera su asiento.
      //    Si no queda ningún pasajero activo, la reserva completa pasa a CANCELADA.
      await tx.pasajeroReserva.update({
        where: { id: evaluacion.pasajero.id },
        data: { canceladoAt: new Date() },
      })
      const quedanActivos = reserva.pasajeros.filter((p) => !p.canceladoAt && p.id !== evaluacion.pasajero.id).length
      await tx.reserva.update({
        where: { id: reserva.id },
        data: {
          asientos: { decrement: 1 },
          ...(quedanActivos === 0 && { estado: 'CANCELADA' }),
        },
      })

      return reserva.vuelo.codigoVuelo
    })
  } catch (e) {
    if (e instanceof CancelacionError) {
      return { error: e.message }
    }
    console.error('Error al cancelar el pasaje:', e)
    return { error: 'No se pudo cancelar el pasaje. Intentá nuevamente.' }
  }

  // 4. Revalidar y volver a Mis reservas con el mensaje de confirmación
  revalidatePath('/pasajero/reservas')
  revalidatePath('/pasajero/busquedaVuelo')
  redirect(`/pasajero/reservas?${new URLSearchParams({ cancelada: codigoVuelo })}`)
}
