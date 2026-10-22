const { asientosReservados } = require('./vuelos-search')

const CLASES = [
  { clave: 'ECONOMY', nombre: 'Economy', campo: 'capacidadEconomy' },
  { clave: 'PRIMERA', nombre: 'Primera clase', campo: 'capacidadPrimera' },
]

function redondearFactor(vendidos, capacidad) {
  if (capacidad === 0) {
    return null
  }

  return Math.round((vendidos / capacidad) * 1000) / 10
}

function construirOcupacion(vuelo, reservados) {
  const clases = CLASES.map(({ clave, nombre, campo }) => {
    const vendidos = reservados[clave] ?? 0
    const capacidad = vuelo[campo]

    if (capacidad === null) {
      return { clave, nombre, capacidad: null, vendidos, libres: null, factor: null }
    }

    return {
      clave,
      nombre,
      capacidad,
      vendidos,
      libres: capacidad - vendidos,
      factor: redondearFactor(vendidos, capacidad),
    }
  })

  const definidas = clases.filter((clase) => clase.capacidad !== null)
  const total = {
    capacidad: definidas.reduce((suma, clase) => suma + clase.capacidad, 0),
    vendidos: definidas.reduce((suma, clase) => suma + clase.vendidos, 0),
    libres: definidas.reduce((suma, clase) => suma + clase.libres, 0),
    factor: null,
  }
  total.factor = redondearFactor(total.vendidos, total.capacidad)

  return { clases, total }
}

async function obtenerOcupacionVuelo(prisma, vueloId, fecha) {
  const vuelo = await prisma.vuelo.findUnique({ where: { id: vueloId } })
  if (!vuelo) {
    return null
  }

  const reservadosPorVuelo = await asientosReservados(prisma, [vuelo.id], fecha)
  const ocupacion = construirOcupacion(vuelo, reservadosPorVuelo[vuelo.id] ?? {})

  return {
    vuelo: {
      id: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origen,
      destino: vuelo.destino,
      horaSalida: vuelo.horaSalida,
      horaLlegada: vuelo.horaLlegada,
      tipoAvion: vuelo.tipoAvion,
    },
    fecha,
    ...ocupacion,
  }
}

module.exports = {
  construirOcupacion,
  obtenerOcupacionVuelo,
}
