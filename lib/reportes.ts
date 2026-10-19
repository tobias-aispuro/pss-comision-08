import { prisma } from '@/lib/prisma'

export const CLASES_REPORTE = {
  ECONOMY: { nombre: 'Economy', capacidad: 'capacidadEconomy' },
  PRIMERA: { nombre: 'Primera clase', capacidad: 'capacidadPrimera' },
} as const

export type ClaseReporte = keyof typeof CLASES_REPORTE

export type FiltrosReporte = {
  desde: string
  hasta: string
  clase: ClaseReporte | 'TODAS'
  ruta: string
}

export type FilaOcupacion = {
  ruta: string
  origen: string
  destino: string
  economy: { ocupados: number; capacidad: number }
  primera: { ocupados: number; capacidad: number }
}

export type ReporteOcupacion = {
  filas: FilaOcupacion[]
  total: { ocupados: number; capacidad: number }
  porClase: Record<ClaseReporte, { ocupados: number; capacidad: number }>
  cantidadSalidas: number
}

const DIAS_A_NUMERO: Record<string, number> = {
  DOM: 0,
  LUN: 1,
  MAR: 2,
  'MIÉ': 3,
  JUE: 4,
  VIE: 5,
  'SÁB': 6,
}

const ACTIVAS = ['PENDIENTE', 'CONFIRMADA'] as const

export function fechaValida(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const valor = new Date(Date.UTC(anio, mes - 1, dia))
  return valor.getUTCFullYear() === anio && valor.getUTCMonth() === mes - 1 && valor.getUTCDate() === dia
}

function sumarDias(fecha: string, dias: number) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const valor = new Date(Date.UTC(anio, mes - 1, dia + dias))
  return valor.toISOString().slice(0, 10)
}

function diaDeSemana(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
}

function claveRuta(origen: string, destino: string) {
  return `${origen}|${destino}`
}

function claseIncluida(filtros: FiltrosReporte, clase: ClaseReporte) {
  return filtros.clase === 'TODAS' || filtros.clase === clase
}

export function normalizarFiltros(params: Record<string, string | string[] | undefined>, hoy: string): {
  filtros: FiltrosReporte
  error: string | null
} {
  const leer = (nombre: string) => {
    const valor = params[nombre]
    return Array.isArray(valor) ? valor[0] ?? '' : valor ?? ''
  }

  const desde = leer('desde') || hoy
  const hasta = leer('hasta') || sumarDias(hoy, 30)
  const clase = leer('clase')
  const filtros: FiltrosReporte = {
    desde,
    hasta,
    clase: clase === 'ECONOMY' || clase === 'PRIMERA' ? clase : 'TODAS',
    ruta: leer('ruta'),
  }

  if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
    return { filtros, error: 'El rango de fechas seleccionado no es válido' }
  }

  return { filtros, error: null }
}

export async function obtenerRutasReporte() {
  const vuelos = await prisma.vuelo.findMany({
    orderBy: [{ origen: 'asc' }, { destino: 'asc' }],
    select: { origen: true, destino: true },
  })

  return Array.from(new Map(vuelos.map((vuelo) => [claveRuta(vuelo.origen, vuelo.destino), vuelo])).values())
}

export async function obtenerReporteOcupacion(filtros: FiltrosReporte): Promise<ReporteOcupacion> {
  const vuelos = await prisma.vuelo.findMany({
    where: filtros.ruta
      ? {
          origen: filtros.ruta.split('|')[0],
          destino: filtros.ruta.split('|')[1],
        }
      : undefined,
    select: {
      id: true,
      origen: true,
      destino: true,
      diasOperacion: true,
      capacidadEconomy: true,
      capacidadPrimera: true,
      cancelaciones: {
        where: { fecha: { gte: filtros.desde, lte: filtros.hasta } },
        select: { fecha: true },
      },
    },
  })

  const reservas = await prisma.reserva.findMany({
    where: {
      fecha: { gte: filtros.desde, lte: filtros.hasta },
      estado: { in: [...ACTIVAS] },
      ...(filtros.clase !== 'TODAS' ? { clase: filtros.clase } : {}),
      ...(filtros.ruta
        ? {
            vuelo: {
              origen: filtros.ruta.split('|')[0],
              destino: filtros.ruta.split('|')[1],
            },
          }
        : {}),
    },
    select: {
      vueloId: true,
      fecha: true,
      clase: true,
      _count: { select: { pasajeros: { where: { canceladoAt: null } } } },
    },
  })

  const ocupadosPorSalida = new Map<string, number>()
  for (const reserva of reservas) {
    const clave = `${reserva.vueloId}|${reserva.fecha}|${reserva.clase}`
    ocupadosPorSalida.set(clave, (ocupadosPorSalida.get(clave) ?? 0) + reserva._count.pasajeros)
  }

  const filas = new Map<string, FilaOcupacion>()
  let cantidadSalidas = 0

  for (const vuelo of vuelos) {
    const canceladas = new Set(vuelo.cancelaciones.map((cancelacion) => cancelacion.fecha))
    for (let fecha = filtros.desde; fecha <= filtros.hasta; fecha = sumarDias(fecha, 1)) {
      const operaEseDia = vuelo.diasOperacion.some((dia) => DIAS_A_NUMERO[dia] === diaDeSemana(fecha))
      if (!operaEseDia || canceladas.has(fecha)) continue

      cantidadSalidas += 1
      const ruta = claveRuta(vuelo.origen, vuelo.destino)
      const fila = filas.get(ruta) ?? {
        ruta,
        origen: vuelo.origen,
        destino: vuelo.destino,
        economy: { ocupados: 0, capacidad: 0 },
        primera: { ocupados: 0, capacidad: 0 },
      }

      if (claseIncluida(filtros, 'ECONOMY') && vuelo.capacidadEconomy !== null) {
        fila.economy.capacidad += vuelo.capacidadEconomy
        fila.economy.ocupados += ocupadosPorSalida.get(`${vuelo.id}|${fecha}|ECONOMY`) ?? 0
      }
      if (claseIncluida(filtros, 'PRIMERA') && vuelo.capacidadPrimera !== null) {
        fila.primera.capacidad += vuelo.capacidadPrimera
        fila.primera.ocupados += ocupadosPorSalida.get(`${vuelo.id}|${fecha}|PRIMERA`) ?? 0
      }
      filas.set(ruta, fila)
    }
  }

  const lista = Array.from(filas.values()).sort((a, b) => a.ruta.localeCompare(b.ruta))
  const porClase = {
    ECONOMY: lista.reduce(
      (total, fila) => ({
        ocupados: total.ocupados + fila.economy.ocupados,
        capacidad: total.capacidad + fila.economy.capacidad,
      }),
      { ocupados: 0, capacidad: 0 },
    ),
    PRIMERA: lista.reduce(
      (total, fila) => ({
        ocupados: total.ocupados + fila.primera.ocupados,
        capacidad: total.capacidad + fila.primera.capacidad,
      }),
      { ocupados: 0, capacidad: 0 },
    ),
  }

  return {
    filas: lista,
    porClase,
    cantidadSalidas,
    total: {
      ocupados: porClase.ECONOMY.ocupados + porClase.PRIMERA.ocupados,
      capacidad: porClase.ECONOMY.capacidad + porClase.PRIMERA.capacidad,
    },
  }
}
