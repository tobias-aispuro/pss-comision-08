'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { evaluarCheckIn } from '@/lib/check-in-utils'
import { construirMapa, validarSeleccion, type SeleccionAsiento } from '@/lib/asientos-check-in'
import { revalidatePath } from 'next/cache'

export type ConfirmarAsientosResult = { ok: boolean; mensaje: string; ocupados?: string[] }

class SeleccionError extends Error {}

export async function consultarAsientos(reservaId: string): Promise<ConfirmarAsientosResult> {
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO' || typeof reservaId !== 'string') return { ok: false, mensaje: 'Iniciá sesión como pasajero para continuar.' }
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, userId: user.id },
    include: { vuelo: { include: { cancelaciones: true } } },
  })
  if (!reserva) return { ok: false, mensaje: 'La reserva no existe.' }
  const ventana = evaluarCheckIn({ reserva, vuelo: reserva.vuelo, cancelado: reserva.vuelo.cancelaciones.some((c) => c.fecha === reserva.fecha) })
  if (!ventana.ok) return { ok: false, mensaje: ventana.mensaje }
  const asignados = await prisma.pasajeroReserva.findMany({
    where: { canceladoAt: null, asiento: { not: null }, reserva: { vueloId: reserva.vueloId, fecha: reserva.fecha, estado: 'CONFIRMADA' } },
    select: { asiento: true },
  })
  return { ok: true, mensaje: '', ocupados: asignados.flatMap((p) => p.asiento ? [p.asiento] : []) }
}

export async function confirmarAsientos(reservaId: string, seleccion: SeleccionAsiento[]): Promise<ConfirmarAsientosResult> {
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') return { ok: false, mensaje: 'Iniciá sesión como pasajero para continuar.' }
  if (typeof reservaId !== 'string' || !reservaId || !Array.isArray(seleccion) || seleccion.length > 9) {
    return { ok: false, mensaje: 'La selección de asientos no es válida.' }
  }

  try {
    const resultado = await prisma.$transaction(async (tx): Promise<ConfirmarAsientosResult> => {
      // Todas las asignaciones de US19 bloquean el mismo vuelo antes de leer la ocupación.
      // ReadCommitted permite que el segundo comprador vea lo confirmado por el primero.
      // El bloqueo dura hasta el commit/rollback; la consulta usa parámetros, nunca SQL del cliente.
      const filas = await tx.$queryRaw<{ id: string }[]>`
        SELECT v.id FROM "Vuelo" v JOIN "Reserva" r ON r."vueloId" = v.id
        WHERE r.id = ${reservaId} AND r."userId" = ${user.id}
        FOR UPDATE OF v, r
      `
      if (filas.length === 0) throw new SeleccionError('No se encontró la reserva o no pertenece a tu cuenta.')

      const reserva = await tx.reserva.findFirst({
        where: { id: reservaId, userId: user.id },
        include: { pasajeros: { where: { canceladoAt: null }, orderBy: { createdAt: 'asc' } }, vuelo: { include: { cancelaciones: true } } },
      })
      if (!reserva) throw new SeleccionError('La reserva no existe.')
      const ventana = evaluarCheckIn({
        reserva, vuelo: reserva.vuelo, cancelado: reserva.vuelo.cancelaciones.some((c) => c.fecha === reserva.fecha),
      })
      if (!ventana.ok) throw new SeleccionError(ventana.mensaje)

      const pendientes = reserva.pasajeros.filter((p) => !p.checkInCompletado)
      if (pendientes.length === 0) throw new SeleccionError('El check-in de esta reserva ya está completado.')
      const mapa = construirMapa(reserva.vuelo)
      const error = validarSeleccion(seleccion, pendientes.map((p) => p.id), reserva.clase, mapa)
      if (error) throw new SeleccionError(error)

      const asignados = await tx.pasajeroReserva.findMany({
        where: { canceladoAt: null, asiento: { not: null }, reserva: { vueloId: reserva.vueloId, fecha: reserva.fecha, estado: 'CONFIRMADA' } },
        select: { asiento: true },
      })
      const ocupados = asignados.flatMap((p) => p.asiento ? [p.asiento] : [])
      if (seleccion.some((s) => ocupados.includes(s.asiento))) {
        return { ok: false, mensaje: 'El asiento ya no se encuentra disponible. Elegí una nueva ubicación libre.', ocupados }
      }

      // El grupo se confirma completo o no se asigna ningún asiento.
      for (const s of seleccion) {
        const cambio = await tx.pasajeroReserva.updateMany({
          where: { id: s.pasajeroId, reservaId, canceladoAt: null, checkInCompletado: false },
          data: { asiento: s.asiento, checkInCompletado: true },
        })
        if (cambio.count !== 1) throw new SeleccionError('La reserva cambió. Actualizá la página antes de continuar.')
      }
      return { ok: true, mensaje: 'Asiento seleccionado correctamente' }
    }, { isolationLevel: 'ReadCommitted' })

    if (resultado.ok) {
      revalidatePath('/pasajero/check-in')
      revalidatePath('/pasajero/reservas')
    }
    return resultado
  } catch (error) {
    if (error instanceof SeleccionError) return { ok: false, mensaje: error.message }
    console.error('Error al confirmar asientos de check-in:', error)
    return { ok: false, mensaje: 'No se pudieron confirmar los asientos. Intentá nuevamente.' }
  }
}
