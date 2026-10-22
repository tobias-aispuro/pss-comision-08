const test = require('node:test')
const assert = require('node:assert/strict')

const { construirOcupacion, obtenerOcupacionVuelo } = require('../lib/ocupacion-vuelo')
const { asientosReservados } = require('../lib/vuelos-search')

function vueloBase(extra = {}) {
  return {
    id: 'vuelo-1',
    codigoVuelo: 'SL1402',
    origen: 'Buenos Aires',
    destino: 'Córdoba',
    horaSalida: '08:30',
    horaLlegada: '09:45',
    tipoAvion: 'Airbus A320',
    capacidadEconomy: 100,
    capacidadPrimera: 20,
    ...extra,
  }
}

function prismaFalso(vuelo, grupos = []) {
  const llamadasVuelos = []
  const llamadasReservas = []

  return {
    llamadasVuelos,
    llamadasReservas,
    vuelo: {
      findUnique: async (args) => {
        llamadasVuelos.push(args)
        return vuelo
      },
    },
    reserva: {
      groupBy: async (args) => {
        llamadasReservas.push(args)
        return grupos
      },
    },
  }
}

test('construirOcupacion calcula filas y total por clase', () => {
  const resultado = construirOcupacion(vueloBase(), { ECONOMY: 40, PRIMERA: 20 })

  assert.deepEqual(resultado, {
    clases: [
      { clave: 'ECONOMY', nombre: 'Economy', capacidad: 100, vendidos: 40, libres: 60, factor: 40 },
      { clave: 'PRIMERA', nombre: 'Primera clase', capacidad: 20, vendidos: 20, libres: 0, factor: 100 },
    ],
    total: { capacidad: 120, vendidos: 60, libres: 60, factor: 50 },
  })
})

test('construirOcupacion trata la ausencia de reservas como cero', () => {
  const resultado = construirOcupacion(vueloBase(), {})

  assert.deepEqual(resultado.clases, [
    { clave: 'ECONOMY', nombre: 'Economy', capacidad: 100, vendidos: 0, libres: 100, factor: 0 },
    { clave: 'PRIMERA', nombre: 'Primera clase', capacidad: 20, vendidos: 0, libres: 20, factor: 0 },
  ])
  assert.deepEqual(resultado.total, { capacidad: 120, vendidos: 0, libres: 120, factor: 0 })
})

test('construirOcupacion redondea el factor a un decimal', () => {
  const resultado = construirOcupacion(
    vueloBase({ capacidadEconomy: 42, capacidadPrimera: 268 }),
    { ECONOMY: 38, PRIMERA: 232 }
  )

  assert.equal(resultado.clases[0].factor, 90.5)
  assert.equal(resultado.clases[1].factor, 86.6)
})

test('construirOcupacion excluye una capacidad null de la fila y del total', () => {
  const resultado = construirOcupacion(
    vueloBase({ capacidadPrimera: null }),
    { ECONOMY: 10, PRIMERA: 3 }
  )

  assert.deepEqual(resultado.clases[1], {
    clave: 'PRIMERA',
    nombre: 'Primera clase',
    capacidad: null,
    vendidos: 3,
    libres: null,
    factor: null,
  })
  assert.deepEqual(resultado.total, { capacidad: 100, vendidos: 10, libres: 90, factor: 10 })
})

test('construirOcupacion conserva la igualdad entre vendidos, libres y capacidad', () => {
  const resultado = construirOcupacion(vueloBase(), { ECONOMY: 37, PRIMERA: 4 })

  for (const fila of resultado.clases) {
    assert.equal(fila.vendidos + fila.libres, fila.capacidad)
  }
  assert.equal(resultado.total.vendidos + resultado.total.libres, resultado.total.capacidad)
})

test('obtenerOcupacionVuelo devuelve null sin consultar reservas si no existe el vuelo', async () => {
  const prisma = prismaFalso(null)

  assert.equal(await obtenerOcupacionVuelo(prisma, 'inexistente', '2026-11-20'), null)
  assert.equal(prisma.llamadasReservas.length, 0)
})

test('obtenerOcupacionVuelo reenvia los filtros de asientosReservados', async () => {
  const prisma = prismaFalso(vueloBase(), [{ vueloId: 'vuelo-1', clase: 'ECONOMY', _sum: { asientos: 12 } }])

  await obtenerOcupacionVuelo(prisma, 'vuelo-1', '2026-11-20')

  assert.deepEqual(prisma.llamadasReservas[0], {
    by: ['vueloId', 'clase'],
    where: {
      vueloId: { in: ['vuelo-1'] },
      fecha: '2026-11-20',
      estado: { in: ['PENDIENTE', 'CONFIRMADA'] },
    },
    _sum: { asientos: true },
  })
})

test('obtenerOcupacionVuelo coincide con asientosReservados para los mismos datos', async () => {
  const grupos = [
    { vueloId: 'vuelo-1', clase: 'ECONOMY', _sum: { asientos: 12 } },
    { vueloId: 'vuelo-1', clase: 'PRIMERA', _sum: { asientos: 5 } },
  ]
  const prisma = prismaFalso(vueloBase(), grupos)
  const esperado = await asientosReservados(prisma, ['vuelo-1'], '2026-11-20')
  const resultado = await obtenerOcupacionVuelo(prisma, 'vuelo-1', '2026-11-20')

  assert.deepEqual(
    Object.fromEntries(resultado.clases.map((clase) => [clase.clave, clase.vendidos])),
    esperado['vuelo-1']
  )
})
