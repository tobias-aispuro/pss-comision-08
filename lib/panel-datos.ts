import { prisma } from '@/lib/prisma'
import { construirFiltroSalida } from '@/lib/search-utils'

const ACTIVAS = ['PENDIENTE', 'CONFIRMADA'] as const

export type SalidaDelDia = {
  id: string
  codigoVuelo: string
  origen: string
  destino: string
  horaSalida: string
  horaLlegada: string
  tipoAvion: string
  capacidad: number | null
  reservados: number
  pasajeros: number
}

// Vuelos que salen en la fecha, con los asientos reservados y los pasajeros activos de cada uno.
export async function obtenerSalidasDelDia(fecha: string): Promise<SalidaDelDia[]> {
  const vuelos = await prisma.vuelo.findMany({
    where: construirFiltroSalida(fecha),
    orderBy: { horaSalida: 'asc' },
    include: {
      reservas: {
        where: { fecha, estado: { in: [...ACTIVAS] } },
        select: { asientos: true, _count: { select: { pasajeros: { where: { canceladoAt: null } } } } },
      },
    },
  })

  return vuelos.map((vuelo) => {
    const capacidad =
      vuelo.capacidadEconomy === null && vuelo.capacidadPrimera === null
        ? null
        : (vuelo.capacidadEconomy ?? 0) + (vuelo.capacidadPrimera ?? 0)

    return {
      id: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origen,
      destino: vuelo.destino,
      horaSalida: vuelo.horaSalida,
      horaLlegada: vuelo.horaLlegada,
      tipoAvion: vuelo.tipoAvion,
      capacidad,
      reservados: vuelo.reservas.reduce((total, r) => total + r.asientos, 0),
      pasajeros: vuelo.reservas.reduce((total, r) => total + r._count.pasajeros, 0),
    }
  })
}

export async function contarReservasActivas(desde: string) {
  return prisma.reserva.aggregate({
    where: { fecha: { gte: desde }, estado: { in: [...ACTIVAS] } },
    _count: true,
    _sum: { asientos: true },
  })
}
