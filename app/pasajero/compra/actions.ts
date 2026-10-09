'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/role-access'
import { esFechaValida } from '@/lib/search-utils'
import {
  CAMPOS_PASAJERO,
  validarCantidad,
  validarPasajeros,
  validarSalida,
  asientosDisponibles,
} from '@/lib/compra-utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type CompraPasajesState = {
  error: string
  errores: Array<Record<string, string>>
}

class CompraError extends Error {}

function leer(formData: FormData, clave: string) {
  const valor = formData.get(clave)
  return typeof valor === 'string' ? valor : ''
}

export async function registrarPasajeros(
  _prevState: CompraPasajesState,
  formData: FormData
): Promise<CompraPasajesState> {
  // 1. Auth
  const user = await getCurrentAppUser()
  if (user?.rol !== 'PASAJERO') {
    return { error: 'Tenés que iniciar sesión como pasajero para comprar pasajes.', errores: [] }
  }

  // 2. Cantidad (hasta 9 por transacción)
  const cantidad = validarCantidad(leer(formData, 'cantidad'))
  if (!cantidad.ok) {
    return { error: cantidad.error, errores: [] }
  }

  // 3. Datos de cada pasajero
  const pasajeros = Array.from({ length: cantidad.valor }, (_, i) =>
    Object.fromEntries(CAMPOS_PASAJERO.map((campo) => [campo, leer(formData, `${campo}-${i}`)]))
  )
  const validacion = validarPasajeros(pasajeros)
  if (!validacion.ok) {
    return { error: 'Revisá los datos marcados para poder registrar a los pasajeros.', errores: validacion.errores }
  }

  // 4. Salida elegida
  const vueloId = leer(formData, 'vueloId')
  const fecha = leer(formData, 'fecha')
  const clase = leer(formData, 'clase')

  const vuelo = vueloId
    ? await prisma.vuelo.findUnique({
        where: { id: vueloId },
        include: { cancelaciones: { where: { fecha }, select: { fecha: true } } },
      })
    : null
  const errorSalida = validarSalida(vuelo, fecha, clase, vuelo?.cancelaciones.map((c) => c.fecha))
  if (errorSalida || !vuelo) {
    return { error: errorSalida ?? 'El vuelo seleccionado no existe.', errores: [] }
  }

  // 5. Reserva pendiente de pago + pasajeros, controlando el cupo en la misma transacción
  let reservaId: string
  try {
    reservaId = await prisma.$transaction(
      async (tx) => {
        const reservados = await tx.reserva.aggregate({
          _sum: { asientos: true },
          where: { vueloId: vuelo.id, fecha, clase, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
        })
        const disponibles = asientosDisponibles(vuelo, clase, reservados._sum.asientos ?? 0)
        const cupo = validarCantidad(cantidad.valor, disponibles)
        if (!cupo.ok) {
          throw new CompraError(cupo.error)
        }

        const reserva = await tx.reserva.create({
          data: {
            userId: user.id,
            vueloId: vuelo.id,
            fecha,
            clase,
            asientos: cantidad.valor,
            estado: 'PENDIENTE',
            pasajeros: { create: validacion.valores },
          },
        })
        return reserva.id
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (e) {
    if (e instanceof CompraError) {
      return { error: e.message, errores: [] }
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      return { error: 'Otra compra se registró al mismo tiempo. Intentá nuevamente.', errores: [] }
    }
    return { error: 'Error al guardar los pasajeros en la base de datos.', errores: [] }
  }

  // 6. Revalidar y avanzar al siguiente paso: en ida y vuelta, el resumen de la ida ofrece elegir la vuelta
  //    y el de la vuelta muestra los dos tramos.
  const siguiente = new URLSearchParams({ guardado: '1' })
  const idaId = leer(formData, 'idaId')
  const regreso = leer(formData, 'regreso')
  if (idaId) {
    siguiente.set('ida', idaId)
  } else if (esFechaValida(regreso) && regreso >= fecha) {
    siguiente.set('regreso', regreso)
  }

  revalidatePath('/pasajero/busquedaVuelo')
  redirect(`/pasajero/compra/${reservaId}?${siguiente}`)
}
