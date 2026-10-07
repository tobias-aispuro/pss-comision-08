const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { fechasOperativas } = require('../lib/cancelacion-utils')

const VUELO = {
  id: 'vuelo-1',
  codigoVuelo: 'SL1402',
  origen: 'Buenos Aires',
  destino: 'Córdoba',
  horaSalida: '08:30',
  diasOperacion: ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'],
  periodoDesde: '2026-01',
  periodoHasta: '2099-12',
  activo: true,
  cancelaciones: [],
}

function reserva(email, fecha, id = `${email}-${fecha}`) {
  return { id, fecha, user: { email, nombre: 'Ana', apellido: 'Pérez' } }
}

function escenario({ rol = 'ADMINISTRADOR', count = 1, falla = false, reservas = [], fallaEmail = false } = {}) {
  const llamadas = []
  const eventos = []
  const enviados = []
  const mod = { exports: {} }
  const tx = {
    cancelacionVuelo: { create: async (args) => eventos.push(['create', args]) },
    reserva: {
      findMany: async (args) => { eventos.push(['findMany', args]); return reservas },
      updateMany: async (args) => eventos.push(['updateMany', args]),
    },
  }
  const mocks = {
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    '@/lib/cancelacion-utils': require('../lib/cancelacion-utils'),
    '@/lib/cancelacion-email': require('../lib/cancelacion-email'),
    '@/lib/search-utils': require('../lib/search-utils'),
    '@/lib/mailer': { enviarEmail: async (email) => {
      eventos.push(['email', email.to])
      if (fallaEmail) throw new Error('SMTP unavailable')
      enviados.push(email)
    } },
    '@/lib/role-access': {
      getCurrentAppUser: async () => rol ? { rol } : null,
      requireRole: async () => ({ rol }),
    },
    '@/lib/prisma': { prisma: {
      $transaction: async (fn) => fn(tx),
      vuelo: {
        findUnique: async (args) => {
          eventos.push(['findUnique', args])
          return count === 0 ? null : { ...VUELO, reservas }
        },
        deleteMany: async (args) => {
          llamadas.push(args)
          eventos.push(['deleteMany', args])
          if (falla) throw new Error('Database unavailable')
          return { count }
        },
      },
    } },
    'next/cache': { revalidatePath: (ruta) => llamadas.push(ruta) },
    'next/navigation': { redirect: (ruta) => { throw new Error(`REDIRECT:${ruta}`) } },
  }
  const source = fs.readFileSync(path.join(__dirname, '../app/admin/vuelos/actions.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(outputText, { exports: mod.exports, require: (name) => {
    assert.ok(mocks[name], `Unexpected dependency: ${name}`)
    return mocks[name]
  } })
  return { ejecutarModalidad: (datos) => mod.exports.cancelarVuelo({ error: '' }, new Map(Object.entries(datos))),
    ejecutar: (datos = { id: 'vuelo-1', confirmacion: 'ELIMINAR' }) =>
    mod.exports.cancelarFrecuencia({ error: '' }, new Map(Object.entries(datos))), llamadas, eventos, enviados }
}

test('cancelación rechaza usuarios sin sesión o sin rol administrador antes de borrar', async () => {
  for (const rol of [null, 'PASAJERO', 'EMPLEADO_MOSTRADOR']) {
    const caso = escenario({ rol })
    assert.match((await caso.ejecutar()).error, /permisos/)
    assert.equal(caso.llamadas.length, 0)
  }
})

test('cancelación requiere un ID válido y confirmación explícita', async () => {
  for (const datos of [{ id: ' ', confirmacion: 'ELIMINAR' }, { id: 'vuelo-1' }]) {
    const caso = escenario()
    assert.ok((await caso.ejecutar(datos)).error)
    assert.equal(caso.llamadas.length, 0)
  }
})

test('cancelación elimina únicamente el vuelo indicado y actualiza ambas vistas', async () => {
  const caso = escenario()
  await assert.rejects(caso.ejecutar(), /REDIRECT:\/admin\/vuelos\?success=cancelado/)
  assert.equal(JSON.stringify(caso.llamadas[0]), JSON.stringify({ where: { id: 'vuelo-1' } }))
  assert.deepEqual(caso.llamadas.slice(1), ['/admin/vuelos', '/pasajero/busquedaVuelo'])
})

test('vuelo inexistente o error de base de datos no muestra éxito ni redirige', async () => {
  for (const opciones of [{ count: 0 }, { falla: true }]) {
    const caso = escenario(opciones)
    assert.ok((await caso.ejecutar()).error)
    assert.equal(caso.llamadas.length, 1)
  }
})

test('modalidad definitiva permite eliminar sin fecha ni motivo', async () => {
  const caso = escenario()
  await assert.rejects(caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'DEFINITIVA', confirmacion: 'ELIMINAR' }), /REDIRECT:/)
  assert.equal(caso.llamadas.length, 3)
})

test('modalidad desconocida no modifica datos', async () => {
  const caso = escenario()
  assert.match((await caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'OTRA' })).error, /modalidad/)
  assert.equal(caso.llamadas.length, 0)
})

test('eliminar la frecuencia lee las reservas antes de borrar y notifica después', async () => {
  const caso = escenario({ reservas: [reserva('ana@mail.com', '2099-01-05'), reserva('luis@mail.com', '2099-01-06')] })
  await assert.rejects(caso.ejecutar(), /REDIRECT:\/admin\/vuelos\?success=cancelado&notificados=2&fallidos=0$/)
  assert.deepEqual(caso.eventos.map(([tipo]) => tipo), ['findUnique', 'deleteMany', 'email', 'email'])
  assert.equal(caso.eventos[0][1].include.reservas.where.estado, 'CONFIRMADA')
  assert.deepEqual(caso.enviados.map((email) => email.to), ['ana@mail.com', 'luis@mail.com'])
  assert.match(caso.enviados[0].text, /de manera definitiva/)
})

test('si la eliminación falla no se envía ningún email', async () => {
  for (const opciones of [{ count: 0 }, { falla: true }]) {
    const caso = escenario({ ...opciones, reservas: [reserva('ana@mail.com', '2099-01-05')] })
    assert.ok((await caso.ejecutar()).error)
    assert.equal(caso.enviados.length, 0)
  }
})

test('cancelar en fecha puntual cancela las reservas de esa salida y notifica con el motivo', async () => {
  const fecha = fechasOperativas(VUELO)[0]
  const caso = escenario({ reservas: [reserva('ana@mail.com', fecha, 'r1')] })
  await assert.rejects(
    caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'FECHA_PUNTUAL', fecha, motivo: 'Tormenta' }),
    /REDIRECT:\/admin\/vuelos\?cancelado=1&notificados=1&fallidos=0$/
  )
  assert.deepEqual(caso.eventos.map(([tipo]) => tipo), ['findUnique', 'create', 'findMany', 'updateMany', 'email'])
  assert.equal(JSON.stringify(caso.eventos[2][1].where), JSON.stringify({ vueloId: 'vuelo-1', fecha, estado: 'CONFIRMADA' }))
  assert.equal(JSON.stringify(caso.eventos[3][1]), JSON.stringify({ where: { id: { in: ['r1'] } }, data: { estado: 'CANCELADA' } }))
  assert.match(caso.enviados[0].text, /Motivo: Tormenta/)
})

test('un email fallido no revierte la cancelación y se informa en la redirección', async () => {
  const fecha = fechasOperativas(VUELO)[0]
  const caso = escenario({ reservas: [reserva('ana@mail.com', fecha)], fallaEmail: true })
  const original = console.error
  console.error = () => {}
  try {
    await assert.rejects(
      caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'FECHA_PUNTUAL', fecha, motivo: 'Tormenta' }),
      /REDIRECT:\/admin\/vuelos\?cancelado=1&notificados=0&fallidos=1$/
    )
  } finally {
    console.error = original
  }
})
