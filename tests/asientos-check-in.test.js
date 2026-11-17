/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas de módulos TS con node --test, como los tests de pago. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function cargar(ruta, mocks = {}) {
  const fuente = fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8')
  const js = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  new vm.Script(`(function(require, exports, module) { ${js}\n})`).runInThisContext()((id) => mocks[id] ?? require(id), mod.exports, mod)
  return mod.exports
}

const utils = cargar('lib/asientos-check-in.ts')
const vuelo = { id: 'v1', activo: true, horaSalida: '12:00', zonaOrigen: 'UTC', capacidadPrimera: 4, capacidadEconomy: 6, cancelaciones: [] }
const mapa = utils.construirMapa(vuelo)

test('US18: mapa con dos clases, pasillo, filas consecutivas y códigos únicos', () => {
  assert.deepEqual(mapa.filter((a) => a.clase === 'PRIMERA').map((a) => a.codigo), ['1A', '1C', '1D', '1F'])
  assert.deepEqual(mapa.filter((a) => a.clase === 'ECONOMY').map((a) => a.codigo), ['2A', '2B', '2C', '2D', '2E', '2F'])
  assert.equal(new Set(mapa.map((a) => a.codigo)).size, 10)
  const parcial = utils.construirMapa({ capacidadPrimera: 5, capacidadEconomy: 7 })
  assert.equal(parcial.length, 12)
  assert.equal(parcial.at(-1).codigo, '4A')
})

test('US18: sin capacidad válida no inventa asientos', () => {
  for (const capacidadPrimera of [null, -1, 1.5]) assert.deepEqual(utils.construirMapa({ capacidadPrimera, capacidadEconomy: 6 }), [])
  assert.equal(utils.construirMapa({ capacidadPrimera: 0, capacidadEconomy: 6 })[0].codigo, '1A')
})

test('US18: rechaza selección vacía, clase incorrecta, duplicados y pasajeros ajenos', () => {
  assert.equal(utils.validarSeleccion([], ['p1'], 'ECONOMY', mapa), 'Debe seleccionar un asiento para continuar')
  assert.match(utils.validarSeleccion([{ pasajeroId: 'p1', asiento: '1A' }], ['p1'], 'ECONOMY', mapa), /clase comprada/)
  assert.match(utils.validarSeleccion([{ pasajeroId: 'p1', asiento: '999A' }], ['p1'], 'ECONOMY', mapa), /clase comprada/)
  assert.match(utils.validarSeleccion([{ pasajeroId: 'ajeno', asiento: '2A' }], ['p1'], 'ECONOMY', mapa), /pasajeros inválidos/)
  assert.match(utils.validarSeleccion([{ pasajeroId: 'p1', asiento: '2A' }, { pasajeroId: 'p2', asiento: '2A' }], ['p1', 'p2'], 'ECONOMY', mapa), /mismo asiento/)
  assert.match(utils.validarSeleccion([null], ['p1'], 'ECONOMY', mapa), /pasajeros inválidos/)
})

function reserva(id, userId, opciones = {}) {
  return {
    id, userId, vueloId: 'v1', fecha: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), estado: 'CONFIRMADA', clase: 'ECONOMY',
    vuelo: structuredClone(vuelo), pasajeros: [{ id: `p-${id}`, nombre: 'Pasajero', canceladoAt: null, checkInCompletado: false, asiento: null }], ...opciones,
  }
}

// Modelo transaccional: cambios locales hasta commit y exclusión únicamente al adquirir
// el bloqueo SQL. Si se quita el bloqueo de la acción, la prueba simultánea da dos ganadores.
function base(reservas, fallaSegundo = false, eventos = []) {
  let cola = Promise.resolve()
  const revalidaciones = []
  const prisma = {
    $transaction: async (cb, opciones) => {
      assert.equal(opciones.isolationLevel, 'ReadCommitted')
      let liberar
      const cambios = []
      let reservaActual
      const tx = {
        $queryRaw: async (sql, id, userId) => {
          assert.match(sql.join('?'), /FOR UPDATE OF v, r/)
          const anterior = cola
          cola = new Promise((resolve) => { liberar = resolve })
          await anterior
          reservaActual = reservas.find((r) => r.id === id && r.userId === userId)
          return reservaActual ? [{ id: reservaActual.vueloId }] : []
        },
        reserva: {
          findFirst: async ({ where }) => {
            assert.ok(liberar, 'Debe bloquear antes de leer la reserva')
            const encontrada = structuredClone(reservas.find((r) => r.id === where.id && r.userId === where.userId) ?? null)
            if (encontrada) encontrada.pasajeros = encontrada.pasajeros.filter((p) => !p.canceladoAt)
            return encontrada
          },
        },
        pasajeroReserva: {
          findMany: async ({ where }) => {
            assert.equal(where.canceladoAt, null)
            assert.deepEqual(where.asiento, { not: null })
            return reservas.filter((r) => r.vueloId === where.reserva.vueloId && r.fecha === where.reserva.fecha && r.estado === where.reserva.estado)
              .flatMap((r) => r.pasajeros).filter((p) => !p.canceladoAt && p.asiento).map((p) => ({ asiento: p.asiento }))
          },
          updateMany: async ({ where, data }) => {
            if (fallaSegundo && cambios.length === 1) return { count: 0 }
            const pasajero = reservaActual.pasajeros.find((p) => p.id === where.id && !p.canceladoAt && !p.checkInCompletado)
            if (!pasajero) return { count: 0 }
            cambios.push({ pasajero, data })
            return { count: 1 }
          },
        },
      }
      try {
        const resultado = await cb(tx)
        for (const c of cambios) Object.assign(c.pasajero, c.data)
        eventos.push('commit')
        return resultado
      } finally { if (liberar) liberar() }
    },
  }
  const acciones = (user = { id: 'u1', rol: 'PASAJERO' }, ticketService = { emitirTicketsDeReserva: async () => ({ tickets: [] }) }) => cargar('app/pasajero/check-in/actions.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/role-access': { getCurrentAppUser: async () => user },
    '@/lib/check-in-utils': require('../lib/check-in-utils'),
    '@/lib/asientos-check-in': utils,
    '@/lib/ticket-service': ticketService,
    'next/cache': { revalidatePath: (ruta) => revalidaciones.push(ruta) },
  })
  return { acciones, revalidaciones, eventos }
}

test('US18: confirma todos los pasajeros, completa check-in y habilita la ruta de tickets existente', async () => {
  const r = reserva('r1', 'u1')
  r.pasajeros.push({ id: 'p2', canceladoAt: null, checkInCompletado: false, asiento: null })
  const db = base([r])
  const resultado = await db.acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }, { pasajeroId: 'p2', asiento: '2B' }])
  assert.equal(resultado.ok, true)
  assert.match(resultado.mensaje, /Check-in completado/)
  assert.deepEqual(r.pasajeros.map((p) => [p.asiento, p.checkInCompletado]), [['2A', true], ['2B', true]])
  assert.ok(db.revalidaciones.includes('/pasajero/reservas'))
  assert.ok(db.revalidaciones.includes('/pasajero/check-in'))
  assert.ok(db.revalidaciones.includes('/pasajero/check-in/r1'))
})

test('US19: emite los tickets después del commit del check-in', async () => {
  const r = reserva('r1', 'u1')
  const eventos = []
  const db = base([r], false, eventos)
  const ticketService = {
    emitirTicketsDeReserva: async (reservaId) => {
      eventos.push(['emitir', reservaId])
      return { tickets: [] }
    },
  }

  const resultado = await db.acciones(undefined, ticketService).confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])

  assert.equal(resultado.ok, true)
  assert.deepEqual(eventos, ['commit', ['emitir', 'r1']])
})

test('US19: un error al emitir tickets conserva el check-in confirmado', async () => {
  const r = reserva('r1', 'u1')
  const eventos = []
  const db = base([r], false, eventos)
  const errores = []
  const originalError = console.error
  console.error = (...args) => errores.push(args)

  try {
    const ticketService = {
      emitirTicketsDeReserva: async (reservaId) => {
        eventos.push(['emitir', reservaId])
        throw new Error('SMTP unavailable')
      },
    }

    const resultado = await db.acciones(undefined, ticketService).confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])

    assert.equal(resultado.ok, true)
    assert.deepEqual(r.pasajeros.map((p) => [p.asiento, p.checkInCompletado]), [['2A', true]])
    assert.deepEqual(eventos, ['commit', ['emitir', 'r1']])
    assert.match(errores[0][0], /Error al emitir tickets después del check-in/)
    assert.match(errores[0][1].message, /SMTP unavailable/)
  } finally {
    console.error = originalError
  }
})

test('US18: dos confirmaciones simultáneas del mismo lugar dan un solo ganador', async () => {
  const r1 = reserva('r1', 'u1'), r2 = reserva('r2', 'u2')
  const db = base([r1, r2])
  const resultados = await Promise.all([
    db.acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }]),
    db.acciones({ id: 'u2', rol: 'PASAJERO' }).confirmarAsientos('r2', [{ pasajeroId: 'p-r2', asiento: '2A' }]),
  ])
  assert.equal(resultados.filter((r) => r.ok).length, 1)
  const perdedor = resultados.find((r) => !r.ok)
  assert.match(perdedor.mensaje, /ya no se encuentra disponible/)
  assert.deepEqual(perdedor.ocupados, ['2A'])
  assert.equal([r1, r2].flatMap((r) => r.pasajeros).filter((p) => p.asiento === '2A').length, 1)
  assert.equal(r2.pasajeros[0].checkInCompletado, false)
})

test('US18: selección vacía, ajena o de otra clase no escribe nada', async () => {
  const r = reserva('r1', 'u1')
  const db = base([r])
  for (const seleccion of [[], [null], [{ pasajeroId: 'otro', asiento: '2A' }], [{ pasajeroId: 'p-r1', asiento: '1A' }]]) {
    assert.equal((await db.acciones().confirmarAsientos('r1', seleccion)).ok, false)
    assert.equal(r.pasajeros[0].asiento, null)
  }
})

test('US18: autenticación y propiedad se validan también en la acción', async () => {
  const r = reserva('r1', 'u1'), db = base([r])
  for (const user of [null, { id: 'u1', rol: 'ADMINISTRADOR' }, { id: 'u2', rol: 'PASAJERO' }]) {
    assert.equal((await db.acciones(user).confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])).ok, false)
  }
  assert.equal(r.pasajeros[0].asiento, null)
})

test('US18: revalida vencimiento, apertura y cancelación al confirmar', async () => {
  for (const cambio of [
    { fecha: new Date().toISOString().slice(0, 10) },
    { fecha: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) },
    { estado: 'CANCELADA' }, { estado: 'PENDIENTE' },
    { vuelo: { ...vuelo, activo: false } },
    { vuelo: { ...vuelo, cancelaciones: [{ fecha: reserva('r1', 'u1').fecha }] } },
  ]) {
    const r = reserva('r1', 'u1', cambio), db = base([r])
    assert.equal((await db.acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])).ok, false)
    assert.equal(r.pasajeros[0].asiento, null)
  }
})

test('US18: una segunda confirmación no reasigna un check-in completado', async () => {
  const r = reserva('r1', 'u1'), accion = base([r]).acciones()
  assert.equal((await accion.confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])).ok, true)
  assert.equal((await accion.confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2B' }])).ok, false)
  assert.equal(r.pasajeros[0].asiento, '2A')
})

test('US18: el fallo de un integrante revierte la selección completa del grupo', async () => {
  const r = reserva('r1', 'u1')
  r.pasajeros.push({ id: 'p2', canceladoAt: null, checkInCompletado: false, asiento: null })
  const resultado = await base([r], true).acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }, { pasajeroId: 'p2', asiento: '2B' }])
  assert.equal(resultado.ok, false)
  assert.ok(r.pasajeros.every((p) => p.asiento === null && !p.checkInCompletado))
})

test('US18: completa los pendientes sin modificar asientos de pasajeros ya confirmados o cancelados', async () => {
  const r = reserva('r1', 'u1')
  r.pasajeros.push(
    { id: 'p2', canceladoAt: null, checkInCompletado: true, asiento: '2B' },
    { id: 'p3', canceladoAt: new Date(), checkInCompletado: false, asiento: null },
  )
  const resultado = await base([r]).acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])
  assert.equal(resultado.ok, true)
  assert.deepEqual(r.pasajeros.map((p) => [p.asiento, p.checkInCompletado]), [['2A', true], ['2B', true], [null, false]])
})

test('US18: no confirma una reserva cuyos pasajeros están todos cancelados', async () => {
  const r = reserva('r1', 'u1')
  r.pasajeros[0].canceladoAt = new Date()
  const resultado = await base([r]).acciones().confirmarAsientos('r1', [{ pasajeroId: 'p-r1', asiento: '2A' }])
  assert.equal(resultado.ok, false)
  assert.equal(r.pasajeros[0].asiento, null)
})
