const { construirFiltroTramo } = require('./search-utils')

const CLASES = {
  ECONOMY: { precio: 'precioEconomy', capacidad: 'capacidadEconomy' },
  PRIMERA: { precio: 'precioPrimera', capacidad: 'capacidadPrimera' },
}

const MS_DIA = 24 * 60 * 60 * 1000
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function offsetMinutos(instanteMs, zona) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instanteMs))

  const v = {}
  for (const p of partes) {
    v[p.type] = Number(p.value)
  }

  const comoUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second)
  return Math.round((comoUtc - Math.floor(instanteMs / 1000) * 1000) / 60000)
}

function instanteLocal(fecha, hora, zona) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  const local = Date.UTC(anio, mes - 1, dia, h, m)
  const primero = local - offsetMinutos(local, zona) * 60000

  return local - offsetMinutos(primero, zona) * 60000
}

function calcularDuracionMinutos(vuelo, fecha) {
  const { horaSalida, horaLlegada, zonaOrigen, zonaDestino } = vuelo

  if (!zonaOrigen || !zonaDestino) {
    return null
  }

  if (!FORMATO_HORA.test(horaSalida) || !FORMATO_HORA.test(horaLlegada)) {
    return null
  }

  try {
    const salida = instanteLocal(fecha, horaSalida, zonaOrigen)
    let llegada = instanteLocal(fecha, horaLlegada, zonaDestino)

    while (llegada <= salida) {
      llegada += MS_DIA
    }

    return Math.round((llegada - salida) / 60000)
  } catch {
    return null
  }
}

function formatearDuracion(minutos) {
  if (minutos === null || minutos === undefined) {
    return null
  }

  const horas = String(Math.floor(minutos / 60)).padStart(2, '0')
  const resto = String(minutos % 60).padStart(2, '0')

  return `${horas}h ${resto}m`
}

function prepararVuelo(vuelo, fecha, opciones = {}) {
  const { asientos = 1, clases = Object.keys(CLASES), precioMax = null } = opciones

  const clasesDisponibles = clases.filter((clase) => {
    const capacidad = vuelo[CLASES[clase].capacidad]
    return capacidad === null || capacidad === undefined || capacidad >= asientos
  })

  if (clasesDisponibles.length === 0) {
    return null
  }

  const precios = clasesDisponibles
    .map((clase) => vuelo[CLASES[clase].precio])
    .filter((precio) => precio !== null && precio !== undefined)

  const precioDesde = precios.length > 0 ? Math.min(...precios) : null

  if (precioMax !== null && precioDesde !== null && precioDesde > precioMax) {
    return null
  }

  const duracionMinutos = calcularDuracionMinutos(vuelo, fecha)

  return {
    ...vuelo,
    clasesDisponibles,
    precioDesde,
    duracionMinutos,
    duracion: formatearDuracion(duracionMinutos),
  }
}

function ordenarVuelos(vuelos, orden = 'PRECIO') {
  return [...vuelos].sort((a, b) => {
    if (orden === 'PRECIO') {
      if (a.precioDesde === null && b.precioDesde !== null) return 1
      if (a.precioDesde !== null && b.precioDesde === null) return -1
      if (a.precioDesde !== b.precioDesde && a.precioDesde !== null) {
        return a.precioDesde - b.precioDesde
      }
    }

    return a.horaSalida.localeCompare(b.horaSalida)
  })
}

async function buscarTramo(prisma, origen, destino, fecha, opciones) {
  const vuelos = await prisma.vuelo.findMany({
    where: construirFiltroTramo(origen, destino, fecha),
    orderBy: { horaSalida: 'asc' },
  })

  const preparados = vuelos
    .map((vuelo) => prepararVuelo(vuelo, fecha, opciones))
    .filter((vuelo) => vuelo !== null)

  return ordenarVuelos(preparados, opciones.orden)
}

async function buscarVuelosDirectos(prisma, valores, filtros = {}) {
  const opciones = {
    asientos: valores.asientos,
    clases: filtros.clases,
    precioMax: filtros.precioMax ?? null,
    orden: filtros.orden ?? 'PRECIO',
  }

  const ida = await buscarTramo(prisma, valores.origen, valores.destino, valores.fechaIda, opciones)

  const vuelta =
    valores.tipoTramo === 'IDA_VUELTA'
      ? await buscarTramo(prisma, valores.destino, valores.origen, valores.fechaRegreso, opciones)
      : []

  return { ida, vuelta }
}

async function obtenerOpcionesBusqueda(prisma) {
  const vuelos = await prisma.vuelo.findMany({
    where: { activo: true },
    select: { origen: true, destino: true },
  })

  const unicos = (valores) => [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'))

  return {
    origenes: unicos(vuelos.map((vuelo) => vuelo.origen)),
    destinos: unicos(vuelos.map((vuelo) => vuelo.destino)),
  }
}

module.exports = {
  calcularDuracionMinutos,
  formatearDuracion,
  prepararVuelo,
  ordenarVuelos,
  buscarVuelosDirectos,
  obtenerOpcionesBusqueda,
}