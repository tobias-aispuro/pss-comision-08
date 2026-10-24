const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function compilar(relativo) {
  const ruta = path.join(__dirname, '..', relativo)
  const fuente = fs.readFileSync(ruta, 'utf8')
  return ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

function cargarModuloActions(prismaMock, userMock) {
  const mod = { exports: {} }
  const redirects = []
  const revalidations = []

  const mocks = {
    'next/navigation': {
      redirect: (url) => {
        redirects.push(url)
        const err = new Error('NEXT_REDIRECT')
        err.digest = `NEXT_REDIRECT;replace;${url};307;;`
        throw err
      },
    },
    'next/cache': {
      revalidatePath: (path) => revalidations.push(path),
    },
    '@/lib/prisma': { prisma: prismaMock },
    '@/lib/role-access': {
      getCurrentAppUser: async () => userMock,
    },
    '@/lib/payment-utils': require('../lib/payment-utils'),
  }

  const js = compilar('app/pasajero/compra/[reservaId]/pago/actions.ts')
  const funcion = new vm.Script(
    `(function (exports, require, module, __filename, __dirname) { ${js}\n})`
  )

  const requireMock = (id) => mocks[id] ?? require(id)
  funcion.runInThisContext()(mod.exports, requireMock, mod, __filename, __dirname)

  return { actions: mod.exports, redirects, revalidations }
}

const tarjetaValida1 = {
  monto: 60000,
  metodo: 'CREDITO',
  cuotas: 3,
  numero: '4242 4242 4242 4242',
  titular: 'Juan Perez',
  vencimiento: '10/28',
  cvv: '123',
  tipoDocumento: 'DNI',
  documento: '30123456',
}

const tarjetaValida2 = {
  monto: 40000,
  metodo: 'DEBITO',
  cuotas: 1,
  numero: '4242 4242 4242 4242',
  titular: 'Juan Perez',
  vencimiento: '11/29',
  cvv: '456',
  tipoDocumento: 'DNI',
  documento: '30123456',
}

const tarjetaInvalida = {
  monto: 40000,
  metodo: 'CREDITO',
  cuotas: 1,
  numero: '4242 4242 4242 4241', // Falla Luhn
  titular: 'Juan Perez',
  vencimiento: '11/29',
  cvv: '456',
  tipoDocumento: 'DNI',
  documento: '30123456',
}

test('US-13 Escenario 1: Camino exitoso con pago combinado divide la transaccion y confirma la reserva', async () => {
  const updatesReserva = []
  const reserva = {
    id: 'res-comb-1',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' }, // Total = 100.000
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          update: async (args) => updatesReserva.push(args),
        },
      }
      return cb(tx)
    },
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects, revalidations } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.confirmarPagoCombinado({
      reservaId: 'res-comb-1',
      tarjetas: [tarjetaValida1, tarjetaValida2], // 60.000 + 40.000 = 100.000
    })
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CONFIRMADA')
  assert.equal(updatesReserva[0].data.importePagado, 100000)
  assert.match(updatesReserva[0].data.metodoPago, /^COMBINADO:/)
  assert.match(updatesReserva[0].data.metodoPago, /Tarjeta 1/)
  assert.match(updatesReserva[0].data.metodoPago, /Tarjeta 2/)
  assert.ok(updatesReserva[0].data.pagadoAt instanceof Date)
  assert.match(redirects[0], /compra\/res-comb-1\?pagado=1/)
  assert.ok(revalidations.includes('/pasajero/reservas'))
})

test('US-13 Escenario 2: Rechazo por credenciales invalidas no cancela reserva ni redirige y devuelve error específico', async () => {
  const updatesReserva = []
  const updatesPasajeros = []
  const reserva = {
    id: 'res-comb-2',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' }, // Total = 100.000
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          updateMany: async (args) => updatesReserva.push(args),
        },
        pasajeroReserva: {
          updateMany: async (args) => updatesPasajeros.push(args),
        },
      }
      return cb(tx)
    },
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  const resultado = await actions.confirmarPagoCombinado({
    reservaId: 'res-comb-2',
    tarjetas: [tarjetaValida1, tarjetaInvalida], // suma = 100.000 pero tarjeta 2 tiene credenciales invalidas
  })

  // No debe cancelar la reserva ni a los pasajeros
  assert.equal(updatesReserva.length, 0)
  assert.equal(updatesPasajeros.length, 0)
  // No debe redirigir
  assert.equal(redirects.length, 0)
  // Debe devolver el error descriptivo y el desglose de tarjetaErrors
  assert.ok(resultado?.error)
  assert.ok(resultado?.tarjetaErrors)
  assert.ok(resultado.tarjetaErrors[1])
  assert.equal(resultado.tarjetaErrors[1].numero, 'Ingresá un número de tarjeta válido.')
  assert.equal(resultado.tarjetaErrors[0], undefined) // La tarjeta 1 es válida
})

test('US-13 Escenario 3: Suma inferior al total no permite avanzar y notifica error exacto', async () => {
  const updatesReserva = []
  const reserva = {
    id: 'res-comb-3',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' }, // Total = 100.000
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async () => {},
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  const resultado = await actions.confirmarPagoCombinado({
    reservaId: 'res-comb-3',
    tarjetas: [
      { ...tarjetaValida1, monto: 40000 },
      { ...tarjetaValida2, monto: 30000 }, // Suma = 70.000 < 100.000
    ],
  })

  assert.equal(resultado.error, 'La suma de los medios de pago debe ser exactamente igual al monto total de la compra.')
  assert.equal(updatesReserva.length, 0)
  assert.equal(redirects.length, 0)
})

test('US-13 Escenario 4: Reserva expirada en pago combinado bloquea transaccion, cancela reserva y redirige a busquedaVuelo', async () => {
  const updatesReserva = []
  const updatesPasajeros = []
  const reservaExpirada = {
    id: 'res-comb-4',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min atrás
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' },
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reservaExpirada],
    },
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          updateMany: async (args) => updatesReserva.push(args),
        },
        pasajeroReserva: {
          updateMany: async (args) => updatesPasajeros.push(args),
        },
      }
      return cb(tx)
    },
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.confirmarPagoCombinado({
      reservaId: 'res-comb-4',
      tarjetas: [tarjetaValida1, tarjetaValida2],
      tiempoExpirado: true,
    })
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CANCELADA')
  assert.equal(updatesPasajeros.length, 1)
  assert.ok(updatesPasajeros[0].data.canceladoAt instanceof Date)
  assert.match(redirects[0], /busquedaVuelo\?error=El%20tiempo%20para%20completar%20la%20compra%20ha%20expirado/)
})

test('US-13: Múltiples errores en distintas tarjetas son detectados individualmente sin cancelar la reserva', async () => {
  const updatesReserva = []
  const reserva = {
    id: 'res-comb-5',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' },
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async () => {},
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  const resultado = await actions.confirmarPagoCombinado({
    reservaId: 'res-comb-5',
    tarjetas: [
      { ...tarjetaValida1, cvv: '12' }, // CVV inválido en tarjeta 1
      { ...tarjetaInvalida, vencimiento: '01/20' }, // Luhn inválido y vencimiento expirado en tarjeta 2
    ],
  })

  assert.equal(updatesReserva.length, 0)
  assert.equal(redirects.length, 0)
  assert.ok(resultado.error)
  assert.ok(resultado.tarjetaErrors[0]?.cvv)
  assert.ok(resultado.tarjetaErrors[1]?.numero)
  assert.ok(resultado.tarjetaErrors[1]?.vencimiento)
})

test('US-13: Pago combinado con titular unificado para todas las tarjetas se confirma exitosamente', async () => {
  const updatesReserva = []
  const reserva = {
    id: 'res-comb-6',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' },
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          update: async (args) => updatesReserva.push(args),
        },
      }
      return cb(tx)
    },
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  // Tarjeta 2 hereda titular, tipoDocumento y documento de tarjeta 1
  const titularComun = 'Maria Gonzalez'
  const tipoDocComun = 'DNI'
  const docComun = '40987654'

  const t1 = {
    ...tarjetaValida1,
    titular: titularComun,
    tipoDocumento: tipoDocComun,
    documento: docComun,
  }
  const t2 = {
    ...tarjetaValida2,
    titular: titularComun,
    tipoDocumento: tipoDocComun,
    documento: docComun,
  }

  try {
    await actions.confirmarPagoCombinado({
      reservaId: 'res-comb-6',
      tarjetas: [t1, t2],
      usarMismosDatos: true,
    })
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CONFIRMADA')
  assert.match(redirects[0], /compra\/res-comb-6\?pagado=1/)
})

test('US-13: Con usarMismosDatos activado, error en titular de Tarjeta 1 no marca error en Tarjeta 2', async () => {
  const reserva = {
    id: 'res-comb-7',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' },
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async () => {},
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  // Tarjeta 1 tiene titular vacío, Tarjeta 2 es completamente válida
  const t1 = { ...tarjetaValida1, titular: '' }
  const t2 = { ...tarjetaValida2 }

  const resultado = await actions.confirmarPagoCombinado({
    reservaId: 'res-comb-7',
    tarjetas: [t1, t2],
    usarMismosDatos: true,
  })

  assert.equal(redirects.length, 0)
  assert.ok(resultado.error)
  assert.ok(resultado.tarjetaErrors)
  // El error de titular se reporta únicamente en la Tarjeta 1
  assert.ok(resultado.tarjetaErrors[0]?.titular)
  // La Tarjeta 2 no debe reportar errores
  assert.equal(resultado.tarjetaErrors[1], undefined)
})

test('US-13: Con usarMismosDatos activado, errores propios de Tarjeta 2 se detectan sin contaminar Tarjeta 1', async () => {
  const reserva = {
    id: 'res-comb-8',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL200' },
  }

  const prismaMock = {
    reserva: {
      findMany: async () => [reserva],
    },
    $transaction: async () => {},
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  // Tarjeta 1 titular vacío, Tarjeta 2 CVV inválido
  const t1 = { ...tarjetaValida1, titular: '' }
  const t2 = { ...tarjetaValida2, cvv: '12' }

  const resultado = await actions.confirmarPagoCombinado({
    reservaId: 'res-comb-8',
    tarjetas: [t1, t2],
    usarMismosDatos: true,
  })

  assert.equal(redirects.length, 0)
  assert.ok(resultado.error)
  assert.ok(resultado.tarjetaErrors)
  // Tarjeta 1 solo tiene error de titular
  assert.ok(resultado.tarjetaErrors[0]?.titular)
  assert.equal(resultado.tarjetaErrors[0]?.cvv, undefined)
  // Tarjeta 2 solo tiene error de CVV (no de titular)
  assert.ok(resultado.tarjetaErrors[1]?.cvv)
  assert.equal(resultado.tarjetaErrors[1]?.titular, undefined)
})

