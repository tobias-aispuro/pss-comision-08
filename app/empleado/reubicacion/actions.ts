'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import {
  ESTADO_TRAS_REUBICACION,
  evaluarReubicable,
  pasajerosActivos,
  validarAlternativa,
} from '@/lib/reubicacion-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ReubicarState = {
  error: string
}

class ReubicacionError extends Error {}

function leer(formData: FormData, campo: string) {
  const valor = formData.get(campo)
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function reubicarReserva(_prevState: ReubicarState, formData: FormData): Promise<ReubicarState> {
  // 1. Auth: solo el empleado de mostrador puede modificar reservas de otros pasajeros
  const empleado = await getCurrentAppUser()
  if (empleado?.rol !== 'EMPLEADO_MOSTRADOR') {
    return { error: 'No tenés permisos para reubicar pasajeros.' }
  }

  const reservaId = leer(formData, 'reservaId')
  const vueloId = leer(formData, 'vueloId')
  const fecha = leer(formData, 'fecha')
  if (!reservaId || !vueloId || !fecha) {
    return { error: 'Faltan datos para reubicar al pasajero.' }
  }

  // 2. Todo se vuelve a validar dentro de la transacción: la reserva sigue afectada
  //    y el vuelo alternativo sigue teniendo lugar para todos sus pasajeros activos.
  let codigoVuelo: string
  try {
    codigoVuelo = await prisma.$transaction(
      async (tx) => {
        const reserva = await tx.reserva.findUnique({
          where: { id: reservaId },
          include: { vuelo: true, pasajeros: true },
        })
        if (!reserva) {
          throw new ReubicacionError('La reserva no existe.')
        }

        const reubicable = evaluarReubicable(reserva, reserva.pasajeros)
        if (!reubicable.ok) {
          throw new ReubicacionError(reubicable.motivo)
        }

        const activos = pasajerosActivos(reserva.pasajeros)
        const alternativa = await tx.vuelo.findUnique({
          where: { id: vueloId },
          include: { cancelaciones: { where: { fecha }, select: { fecha: true } } },
        })
        const ocupados = await tx.reserva.aggregate({
          where: { vueloId, fecha, clase: reserva.clase, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
          _sum: { asientos: true },
        })

        const validacion = validarAlternativa({
          reserva,
          vueloOriginal: reserva.vuelo,
          alternativa,
          fecha,
          canceladas: alternativa?.cancelaciones.map((c) => c.fecha) ?? [],
          reservados: ocupados._sum.asientos ?? 0,
          cantidad: activos.length,
        })
        if (!validacion.ok || !alternativa) {
          throw new ReubicacionError(validacion.ok ? 'El vuelo alternativo no existe.' : validacion.motivo)
        }

        // 3. La reserva pasa al vuelo nuevo y vuelve a quedar confirmada.
        //    El check-in del vuelo cancelado deja de valer: se tiene que hacer de nuevo.
        await tx.reserva.update({
          where: { id: reserva.id },
          data: {
            vueloId: alternativa.id,
            fecha,
            estado: ESTADO_TRAS_REUBICACION,
            canceladaPorVuelo: false,
            asientos: activos.length,
          },
        })
        await tx.pasajeroReserva.updateMany({
          where: { reservaId: reserva.id, canceladoAt: null },
          data: { checkInCompletado: false, asiento: null, grupoEmbarque: null },
        })
        await tx.reubicacion.create({
          data: {
            reservaId: reserva.id,
            vueloAnteriorId: reserva.vueloId,
            fechaAnterior: reserva.fecha,
            vueloNuevoId: alternativa.id,
            fechaNueva: fecha,
            empleadoId: empleado.id,
          },
        })

        return alternativa.codigoVuelo
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (e) {
    if (e instanceof ReubicacionError) {
      return { error: e.message }
    }
    // Otro empleado tomó los últimos lugares (o reubicó la misma reserva) al mismo tiempo
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      return { error: 'Los lugares cambiaron mientras confirmabas. Revisá las alternativas e intentá nuevamente.' }
    }
    console.error('Error al reubicar la reserva:', e)
    return { error: 'No se pudo reubicar al pasajero. Intentá nuevamente.' }
  }

  // 4. Revalidar y volver al listado con el mensaje de confirmación
  revalidatePath('/empleado/reubicacion')
  revalidatePath('/empleado')
  revalidatePath('/pasajero/reservas')
  redirect(`/empleado/reubicacion?${new URLSearchParams({ reubicada: codigoVuelo, fecha })}`)
}
