import { prisma } from '@/lib/prisma'
import { construirFiltroTramo } from '@/lib/search-utils'
import { asientosReservados, calcularDuracionMinutos, formatearDuracion } from '@/lib/vuelos-search'
import { asientosDisponibles } from '@/lib/compra-utils'
import { evaluarReubicable, pasajerosActivos, validarAlternativa } from '@/lib/reubicacion-utils'

// Reservas que el admin canceló al cancelar su vuelo y que el mostrador puede reubicar (US-24).
// `busqueda` filtra por código de vuelo o por DNI de alguno de los pasajeros.
export async function obtenerReservasAfectadas(busqueda = '') {
  const texto = busqueda.trim()

  const reservas = await prisma.reserva.findMany({
    where: {
      estado: 'CANCELADA',
      canceladaPorVuelo: true,
      pagadoAt: { not: null },
      ...(texto && {
        OR: [
          { vuelo: { codigoVuelo: { contains: texto, mode: 'insensitive' as const } } },
          { pasajeros: { some: { dni: texto } } },
        ],
      }),
    },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    include: {
      vuelo: { include: { cancelaciones: true } },
      user: { select: { nombre: true, apellido: true, email: true } },
      pasajeros: { orderBy: { createdAt: 'asc' } },
    },
  })

  return reservas
    .filter((reserva) => evaluarReubicable(reserva, reserva.pasajeros).ok)
    .map((reserva) => ({
      ...reserva,
      activos: pasajerosActivos(reserva.pasajeros),
      motivo: reserva.vuelo.cancelaciones.find((c) => c.fecha === reserva.fecha)?.motivo ?? null,
    }))
}

export type ReservaAfectada = Awaited<ReturnType<typeof obtenerReservasAfectadas>>[number]

export async function obtenerReservaAfectada(id: string) {
  const reserva = await prisma.reserva.findUnique({
    where: { id },
    include: {
      vuelo: { include: { cancelaciones: true } },
      user: { select: { nombre: true, apellido: true, email: true } },
      pasajeros: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!reserva) {
    return null
  }

  return {
    ...reserva,
    reubicable: evaluarReubicable(reserva, reserva.pasajeros),
    activos: pasajerosActivos(reserva.pasajeros),
    motivo: reserva.vuelo.cancelaciones.find((c) => c.fecha === reserva.fecha)?.motivo ?? null,
  }
}

export type ReservaParaReubicar = NonNullable<Awaited<ReturnType<typeof obtenerReservaAfectada>>>

export type Alternativa = {
  id: string
  codigoVuelo: string
  origen: string
  destino: string
  horaSalida: string
  horaLlegada: string
  tipoAvion: string
  duracion: string | null
  // null = el vuelo no tiene capacidad cargada para esa clase (sin límite)
  disponibles: number | null
  sinLugar: boolean
}

// Vuelos de la misma ruta que salen en `fecha`. Los que no tienen lugar para todos los pasajeros
// se devuelven igual, marcados con `sinLugar`, para que el empleado vea por qué no se pueden elegir.
export async function obtenerAlternativas(reserva: ReservaParaReubicar, fecha: string): Promise<Alternativa[]> {
  const vuelos = await prisma.vuelo.findMany({
    where: construirFiltroTramo(reserva.vuelo.origen, reserva.vuelo.destino, fecha),
    orderBy: { horaSalida: 'asc' },
  })
  // Asientos ocupados por vuelo y clase en esa fecha (reservas pendientes y confirmadas).
  const reservados: Record<string, Record<string, number>> = await asientosReservados(
    prisma,
    vuelos.map((vuelo) => vuelo.id),
    fecha
  )

  const alternativas: Alternativa[] = []
  for (const vuelo of vuelos) {
    const validacion = validarAlternativa({
      reserva,
      vueloOriginal: reserva.vuelo,
      alternativa: vuelo,
      fecha,
      reservados: reservados[vuelo.id]?.[reserva.clase] ?? 0,
      cantidad: reserva.activos.length,
    })
    if (!validacion.ok && !validacion.sinLugar) {
      // Otra razón (la misma salida cancelada, ya despegó, etc.): no es una alternativa.
      continue
    }

    let duracion: string | null = null
    try {
      duracion = formatearDuracion(calcularDuracionMinutos(vuelo, fecha))
    } catch {
      duracion = null
    }

    alternativas.push({
      id: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origen,
      destino: vuelo.destino,
      horaSalida: vuelo.horaSalida,
      horaLlegada: vuelo.horaLlegada,
      tipoAvion: vuelo.tipoAvion,
      duracion,
      disponibles: asientosDisponibles(vuelo, reserva.clase, reservados[vuelo.id]?.[reserva.clase] ?? 0),
      sinLugar: !validacion.ok,
    })
  }

  return alternativas
}

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

// "lun, 23 nov 2026" a partir de "2026-11-23"
export function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)))
}
