'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentAppUser } from '@/lib/role-access'
import { validarCancelacion } from '@/lib/cancelacion-utils'
import { notificarCancelacion } from '@/lib/cancelacion-email'
import { enviarEmail } from '@/lib/mailer'
import { fechaDeHoy } from '@/lib/search-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CancelarVueloState = {
  error: string
}

// Avisa por email a los pasajeros afectados y devuelve el resumen para el cartel de éxito.
async function notificarPasajeros(datos: Parameters<typeof notificarCancelacion>[0]) {
  const { notificados, fallidos } = await notificarCancelacion(datos, enviarEmail)
  return `&notificados=${notificados}&fallidos=${fallidos.length}`
}

export async function cancelarVueloEnFecha(
  _prevState: CancelarVueloState,
  formData: FormData
): Promise<CancelarVueloState> {
  // 1. Auth
  try {
    await requireRole(['ADMINISTRADOR'])
  } catch {
    return { error: 'No tenés permisos para cancelar vuelos.' }
  }

  // 2. Vuelo
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { error: 'ID de vuelo inválido.' }
  }

  const vuelo = await prisma.vuelo.findUnique({
    where: { id },
    include: { cancelaciones: { select: { fecha: true } } },
  })
  if (!vuelo) {
    return { error: 'El vuelo no existe.' }
  }

  // 3. Validaciones
  const validacion = validarCancelacion(
    { fecha: formData.get('fecha'), motivo: formData.get('motivo') },
    vuelo,
    vuelo.cancelaciones.map((c) => c.fecha)
  )
  if (!validacion.ok) {
    return { error: Object.values(validacion.errores).join(' ') }
  }

  // 4. Create + cancelar las reservas de esa salida
  const { fecha, motivo } = validacion.valores
  let reservas
  try {
    reservas = await prisma.$transaction(async (tx) => {
      await tx.cancelacionVuelo.create({
        data: { vueloId: vuelo.id, fecha, motivo },
      })
      const afectadas = await tx.reserva.findMany({
        where: { vueloId: vuelo.id, fecha, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
        include: { user: true },
      })
      await tx.reserva.updateMany({
        where: { id: { in: afectadas.map((r) => r.id) } },
        data: { estado: 'CANCELADA' },
      })
      return afectadas
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Esa salida ya fue cancelada.' }
    }
    return { error: 'Error al guardar la cancelación en la base de datos.' }
  }

  // 5. Notificar a los pasajeros afectados
  const resumen = await notificarPasajeros({ vuelo, reservas, motivo })

  // 6. Revalidar y redirigir
  revalidatePath('/admin/vuelos')
  redirect(`/admin/vuelos?cancelado=1${resumen}`)
}

export async function cancelarFrecuencia(
  _prevState: CancelarVueloState,
  formData: FormData
): Promise<CancelarVueloState> {
  const user = await getCurrentAppUser()
  if (user?.rol !== 'ADMINISTRADOR') {
    return { error: 'No tenés permisos para cancelar vuelos.' }
  }
  const id = formData.get('id')
  if (typeof id !== 'string' || !id.trim()) {
    return { error: 'ID de vuelo inválido.' }
  }
  if (formData.get('confirmacion') !== 'ELIMINAR') {
    return { error: 'Confirmá la eliminación de la frecuencia.' }
  }
  // Al eliminar el vuelo sus reservas se borran con él: se leen antes para poder notificar.
  let vuelo
  try {
    vuelo = await prisma.vuelo.findUnique({
      where: { id },
      include: {
        reservas: {
          where: { estado: { in: ['PENDIENTE', 'CONFIRMADA'] }, fecha: { gte: fechaDeHoy() } },
          include: { user: true },
        },
      },
    })
    const resultado = await prisma.vuelo.deleteMany({ where: { id } })
    if (resultado.count === 0) {
      return { error: 'El vuelo ya no existe. Actualizá el listado.' }
    }
  } catch {
    return { error: 'No se pudo cancelar la frecuencia. Intentá nuevamente.' }
  }
  const resumen = vuelo
    ? await notificarPasajeros({ vuelo, reservas: vuelo.reservas, definitiva: true })
    : ''
  revalidatePath('/admin/vuelos')
  revalidatePath('/pasajero/busquedaVuelo')
  redirect(`/admin/vuelos?success=cancelado${resumen}`)
}

export async function cancelarVuelo(
  prevState: CancelarVueloState,
  formData: FormData
): Promise<CancelarVueloState> {
  const modalidad = formData.get('modalidad')
  if (modalidad === 'DEFINITIVA') return cancelarFrecuencia(prevState, formData)
  if (modalidad === 'FECHA_PUNTUAL') return cancelarVueloEnFecha(prevState, formData)
  return { error: 'Seleccioná una modalidad de cancelación válida.' }
}
