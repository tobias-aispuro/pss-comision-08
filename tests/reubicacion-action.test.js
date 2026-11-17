/* eslint-disable @typescript-eslint/no-require-imports -- Tests ejecutados directamente con node --test. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Lunes lejano para que el despegue siempre quede en el futuro
const FECHA_NUEVA = '2099-03-02'

const VUELO_ORIGINAL = {
  id: 'v1',
  codigoVuelo: 'SL712',
  origen: 'Buenos Aires',
  destino: 'Cordoba',
  horaSalida: '07:00',
  zonaOrigen: 'America/Argentina/Buenos_Aires',
  activo: true,
  periodoDesde: '2026-01',
  periodoHasta: '2099-12',
  diasOperacion: ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'],
  capacidadEconomy: 10,
  capacidadPrimera: 2,
}

function reservaAfectada(extra = {}) {
  return {
    id: 'r1',
    vueloId: 'v1',
    fecha: '2099-02-27',
    clase: 'ECONOMY',
    estado: 'CANCELADA',
    canceladaPorVuelo: true,
    pagadoAt: new Date('2026-11-01T12:00:00Z'),
    vuelo: VUELO_ORIGINAL,
    pasajeros: [
      { id: 'p1', canceladoAt: null },
      { id: 'p2', canceladoAt: null },
      { id: 'p3', canceladoAt: new Date() },
    ],
    ...extra,
  }
}

function escenario({ rol = 'EMPLEADO_MOSTRADOR', reserva = reservaAfectada(), ocupados = 0 } = {}) {
  const eventos = []
  const rutas = []
  const mod = { exports: {} }
  const tx = {
    reserva: {
      findUnique: async () => reserva,
      aggregate: async (args) => {
        eventos.push(['aggregate', args])
        return { _sum: { asientos: ocupados } }
      },
      update: async (args) => eventos.push(['update', args]),
    },
    vuelo: {
      findUnique: async () => ({ ...VUELO_ORIGINAL, id: 'v2', codigoVuelo: 'SL799', cancelaciones: [] }),
    },
    pasajeroReserva: { updateMany: async (args) => eventos.push(['updateMany', args]) },
    reubicacion: { create: async (args) => eventos.push(['create', args]) },
  }
  const mocks = {
    '@prisma/client': {
      Prisma: {
        PrismaClientKnownRequestError: class extends Error {},
        TransactionIsolationLevel: { Serializable: 'Serializable' },
      },
    },
    '@/lib/prisma': {
      prisma: {
        $transaction: async (fn, opciones) => {
          eventos.push(['transaction', opciones])
          return fn(tx)
        },
      },
    },
    '@/lib/role-access': { getCurrentAppUser: async () => (rol ? { id: 'empleado-1', rol } : null) },
    '@/lib/reubicacion-utils': require('../lib/reubicacion-utils'),
    'next/cache': { revalidatePath: (ruta) => rutas.push(ruta) },
    'next/navigation': { redirect: (ruta) => { throw new Error(`REDIRECT:${ruta}`) } },
  }
  const source = fs.readFileSync(path.join(__dirname, '../app/empleado/reubicacion/actions.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  vm.runInNewContext(outputText, {
    exports: mod.exports,
    console,
    URLSearchParams,
    require: (name) => {
      assert.ok(mocks[name], `Unexpected dependency: ${name}`)
      return mocks[name]
    },
  })

  const datos = { reservaId: 'r1', vueloId: 'v2', fecha: FECHA_NUEVA }
  return {
    ejecutar: (extra = {}) => mod.exports.reubicarReserva({ error: '' }, new Map(Object.entries({ ...datos, ...extra }))),
    eventos,
    rutas,
  }
}

test('un usuario sin rol de empleado no puede reubicar y no se toca la base', async () => {
  for (const rol of ['PASAJERO', 'ADMINISTRADOR', null]) {
    const caso = escenario({ rol })
    const resultado = await caso.ejecutar()
    assert.match(resultado.error, /No tenés permisos/)
    assert.equal(caso.eventos.length, 0)
  }
})

test('reubica la reserva en el vuelo elegido y la deja confirmada', async () => {
  const caso = escenario()
  await assert.rejects(caso.ejecutar(), /REDIRECT:\/empleado\/reubicacion\?reubicada=SL799&fecha=2099-03-02/)

  const tipos = caso.eventos.map(([tipo]) => tipo)
  assert.deepEqual(tipos, ['transaction', 'aggregate', 'update', 'updateMany', 'create'])
  assert.equal(caso.eventos[0][1].isolationLevel, 'Serializable')

  const actualizacion = caso.eventos[2][1]
  assert.equal(
    JSON.stringify(actualizacion),
    JSON.stringify({
      where: { id: 'r1' },
      data: { vueloId: 'v2', fecha: FECHA_NUEVA, estado: 'CONFIRMADA', canceladaPorVuelo: false, asientos: 2 },
    })
  )
  // El check-in del vuelo cancelado se reinicia para los pasajeros activos
  assert.equal(
    JSON.stringify(caso.eventos[3][1]),
    JSON.stringify({
      where: { reservaId: 'r1', canceladoAt: null },
      data: { checkInCompletado: false, asiento: null, grupoEmbarque: null },
    })
  )
  // Queda registrada la reubicación con el empleado que la hizo
  assert.equal(
    JSON.stringify(caso.eventos[4][1]),
    JSON.stringify({
      data: {
        reservaId: 'r1',
        vueloAnteriorId: 'v1',
        fechaAnterior: '2099-02-27',
        vueloNuevoId: 'v2',
        fechaNueva: FECHA_NUEVA,
        empleadoId: 'empleado-1',
      },
    })
  )
  assert.ok(caso.rutas.includes('/pasajero/reservas'))
})

test('un vuelo sin lugar para todos los pasajeros no permite reubicar', async () => {
  const caso = escenario({ ocupados: 9 })
  const resultado = await caso.ejecutar()

  assert.match(resultado.error, /No es posible completar la reubicación/)
  assert.ok(!caso.eventos.some(([tipo]) => ['update', 'updateMany', 'create'].includes(tipo)))
})

test('una reserva cancelada por el propio pasajero no se reubica', async () => {
  const caso = escenario({ reserva: reservaAfectada({ canceladaPorVuelo: false }) })
  const resultado = await caso.ejecutar()

  assert.match(resultado.error, /no está afectada/)
  assert.ok(!caso.eventos.some(([tipo]) => tipo === 'update'))
})

test('pide todos los datos del formulario', async () => {
  const caso = escenario()
  const resultado = await caso.ejecutar({ vueloId: '' })
  assert.match(resultado.error, /Faltan datos/)
  assert.equal(caso.eventos.length, 0)
})
