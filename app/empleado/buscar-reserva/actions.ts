'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'

export async function buscarReservasPorDni(dni: string) {
  // 1. Seguridad: solo empleados
  await requireRole(['EMPLEADO_MOSTRADOR', 'ADMINISTRADOR'])

  // 2. Validaciones backend (Escenarios 4 y 5)
  if (!dni || dni.trim() === '') {
    return { error: 'Ingrese un DNI para buscar.', reservas: [] }
  }
  if (!/^\d{7,8}$/.test(dni)) {
    return { error: 'Ingrese un número de DNI válido, compuesto únicamente por dígitos numéricos.', reservas: [] }
  }

  try {
    // 3. Buscar al pasajero y sus reservas
    // (Ajustá 'reservas' y 'vuelo' según cómo se llamen en tu schema.prisma)
    const pasajero = await prisma.user.findUnique({
      where: { dni: dni },
      include: {
        reservas: {
          include: {
            vuelo: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // 4. Validar si existe o si tiene reservas (Escenario 3)
    if (!pasajero || !pasajero.reservas || pasajero.reservas.length === 0) {
      return { error: 'No se encontraron reservas asociadas al DNI ingresado.', reservas: [] }
    }

    return { error: null, reservas: pasajero.reservas, pasajero }

  } catch (e) {
    console.error(e)
    return { error: 'Error interno al buscar en la base de datos.', reservas: [] }
  }
}