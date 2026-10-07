'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { validarCancelacion } from '@/lib/cancelacion-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CancelarVueloState = {
  error: string
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

  // 4. Create
  try {
    await prisma.cancelacionVuelo.create({
      data: {
        vueloId: vuelo.id,
        fecha: validacion.valores.fecha,
        motivo: validacion.valores.motivo,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: 'Esa salida ya fue cancelada.' }
    }
    return { error: 'Error al guardar la cancelación en la base de datos.' }
  }

  // 5. Revalidar y redirigir
  revalidatePath('/admin/vuelos')
  redirect('/admin/vuelos?cancelado=1')
}
