'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type EditarVueloState = {
  error: string
}

export async function modificarVuelo(
  _prevState: EditarVueloState,
  formData: FormData
): Promise<EditarVueloState> {
  // 1. Auth
  try {
    await requireRole(['ADMINISTRADOR'])
  } catch {
    return { error: 'No tenés permisos para modificar vuelos.' }
  }

  // 2. ID
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { error: 'ID de vuelo inválido.' }
  }

  // 3. Validaciones del form
  let vuelo
  try {
    const { parseFlightFormData } = await import('@/lib/flight-utils')
    vuelo = parseFlightFormData(formData)
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Datos inválidos.',
    }
  }

  // 4. Código duplicado
  const existente = await prisma.vuelo.findUnique({
    where: { codigoVuelo: vuelo.codigoVuelo },
  })
  if (existente && existente.id !== id) {
    return { error: 'Ya existe otro vuelo con ese código.' }
  }

  // 5. Update
  try {
    await prisma.vuelo.update({
      where: { id },
      data: {
        codigoVuelo: vuelo.codigoVuelo,
        origen: vuelo.origen,
        destino: vuelo.destino,
        diasOperacion: vuelo.diasOperacion,
        horaSalida: vuelo.horaSalida,
        horaLlegada: vuelo.horaLlegada,
        periodoDesde: vuelo.periodoDesde,
        periodoHasta: vuelo.periodoHasta,
        tipoAvion: vuelo.tipoAvion,
      },
    })
  } catch {
    return { error: 'Error al guardar los cambios en la base de datos.' }
  }

  // 6. Revalidar y redirigir
  revalidatePath('/admin/vuelos')
  redirect('/admin/vuelos?success=1')
}