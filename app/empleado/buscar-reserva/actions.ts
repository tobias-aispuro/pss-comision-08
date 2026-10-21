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

export async function buscarReservasPorVuelo(codigo: string) {
  // 1. Seguridad: solo empleados
  await requireRole(['EMPLEADO_MOSTRADOR', 'ADMINISTRADOR'])

  // 2. Validaciones backend
  const codigoVuelo = (codigo || '').trim().toUpperCase()
  if (codigoVuelo === '') {
    return { error: 'Ingrese un número de vuelo para buscar.', pasajeros: [] }
  }

  try {
    // 3. Buscar el vuelo con sus reservas no canceladas y los pasajeros de cada una
    const vuelo = await prisma.vuelo.findUnique({
      where: { codigoVuelo },
      include: {
        reservas: {
          where: { estado: { not: 'CANCELADA' } },
          include: {
            user: true,
            pasajeros: { where: { canceladoAt: null } },
          },
          orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    // 4. Vuelo inexistente (Escenario 2)
    if (!vuelo) {
      return { error: 'No existe un vuelo con el número ingresado.', pasajeros: [] }
    }

    // 5. Una fila por pasajero; si la reserva no tiene pasajeros cargados se usa el titular
    const pasajeros = vuelo.reservas.flatMap((reserva) => {
      const base = {
        reservaId: reserva.id,
        pnr: reserva.id.slice(0, 6),
        fecha: reserva.fecha,
        estado: reserva.estado,
      }
      if (reserva.pasajeros.length === 0) {
        return [{
          ...base,
          id: reserva.id,
          nombre: `${reserva.user.nombre} ${reserva.user.apellido}`,
          dni: reserva.user.dni,
        }]
      }
      return reserva.pasajeros.map((p) => ({ ...base, id: p.id, nombre: p.nombre, dni: p.dni }))
    })

    // 6. Vuelo sin pasajes vendidos (Escenario 2)
    if (pasajeros.length === 0) {
      return { error: `El vuelo ${vuelo.codigoVuelo} no tiene reservas registradas.`, pasajeros: [] }
    }

    const datosVuelo = {
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origen,
      destino: vuelo.destino,
      horaSalida: vuelo.horaSalida,
      horaLlegada: vuelo.horaLlegada,
      tipoAvion: vuelo.tipoAvion,
    }
    return { error: null, pasajeros, vuelo: datosVuelo }

  } catch (e) {
    console.error(e)
    return { error: 'Error interno al buscar en la base de datos.', pasajeros: [] }
  }
}
