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

  // 2. Extraer ID
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) {
    return { error: 'ID de vuelo inválido.' }
  }

  // 3. Extraer y validar datos manualmente
  const codigoVuelo = formData.get('codigoVuelo')?.toString().trim()
  const origen = formData.get('origen')?.toString().trim()
  const destino = formData.get('destino')?.toString().trim()
  const tipoAvion = formData.get('tipoAvion')?.toString().trim()
  const horaSalida = formData.get('horaSalida')?.toString()
  const horaLlegada = formData.get('horaLlegada')?.toString()
  const periodoDesde = formData.get('periodoDesde')?.toString()
  const periodoHasta = formData.get('periodoHasta')?.toString()
  const diasOperacion = formData.getAll('diasOperacion').map(String)
  
  const precioEconomy = Number(formData.get('precioEconomy'))
  const precioPrimera = Number(formData.get('precioPrimera'))

  // Validaciones básicas
  if (!codigoVuelo || !origen || !destino || !tipoAvion || !horaSalida || !horaLlegada || !periodoDesde || !periodoHasta || diasOperacion.length === 0) {
    return { error: 'Todos los campos son obligatorios.' }
  }
  if (origen === destino) {
    return { error: 'El origen y el destino deben ser distintos.' }
  }
  if (horaLlegada <= horaSalida) {
    return { error: 'La hora de llegada debe ser posterior a la hora de salida.' }
  }
  if (!precioEconomy || !precioPrimera || precioEconomy < 1 || precioPrimera < 1) {
    return { error: 'Los precios deben ser mayores a 0.' }
  }

  // 4. Código duplicado
  const existente = await prisma.vuelo.findUnique({
    where: { codigoVuelo },
  })
  if (existente && existente.id !== id) {
    return { error: 'Ya existe otro vuelo con ese código.' }
  }

  // 5. Update
  try {
    await prisma.vuelo.update({
      where: { id },
      data: {
        codigoVuelo,
        origen,
        destino,
        diasOperacion,
        horaSalida,
        horaLlegada,
        periodoDesde,
        periodoHasta,
        tipoAvion,
        precioEconomy,
        precioPrimera,
      },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Error al guardar los cambios en la base de datos.' }
  }

  // 6. Revalidar y redirigir
  revalidatePath('/admin/vuelos')
  redirect('/admin/vuelos?success=1')
}