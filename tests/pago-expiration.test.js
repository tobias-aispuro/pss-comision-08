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

test('confirmarPagoSimulado con tiempoExpirado=true cancela la reserva, libera asientos y redirige a busquedaVuelo', async () => {
  const updatesReserva = []
  const updatesPasajeros = []

  const reserva = {
    id: 'res-1',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL100' },
  }

  const prismaMock = {
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          findMany: async () => [reserva],
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
  const { actions, redirects, revalidations } = cargarModuloActions(prismaMock, userMock)

  let errorLanzado = null
  try {
    await actions.confirmarPagoSimulado({
      reservaId: 'res-1',
      metodo: 'CREDITO',
      cuotas: 1,
      tiempoExpirado: true,
    })
  } catch (err) {
    errorLanzado = err
  }

  assert.equal(errorLanzado?.message, 'NEXT_REDIRECT')
  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CANCELADA')
  assert.equal(updatesPasajeros.length, 1)
  assert.ok(updatesPasajeros[0].data.canceladoAt instanceof Date)
  assert.equal(redirects.length, 1)
  assert.match(redirects[0], /busquedaVuelo\?error=/)
  assert.ok(revalidations.includes('/pasajero/busquedaVuelo'))
})

test('confirmarPagoSimulado detecta si createdAt supera los 5 minutos aunque tiempoExpirado no se envíe', async () => {
  const updatesReserva = []
  const updatesPasajeros = []

  const reservaAntigua = {
    id: 'res-antigua',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 1,
    estado: 'PENDIENTE',
    createdAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutos atrás (límite 5 minutos)
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL100' },
  }

  const prismaMock = {
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          findMany: async () => [reservaAntigua],
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
    await actions.confirmarPagoSimulado({
      reservaId: 'res-antigua',
      metodo: 'DEBITO',
      cuotas: 1,
    })
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CANCELADA')
  assert.equal(updatesPasajeros.length, 1)
  assert.match(redirects[0], /busquedaVuelo\?error=/)
})

test('confirmarPagoSimulado exitoso actualiza estado a CONFIRMADA y redirige con pagado=1', async () => {
  const updatesReserva = []

  const reservaValida = {
    id: 'res-valida',
    userId: 'user-1',
    clase: 'ECONOMY',
    asientos: 2,
    estado: 'PENDIENTE',
    createdAt: new Date(),
    vuelo: { id: 'vuelo-1', precioEconomy: 50000, codigoVuelo: 'SL100' },
  }

  const prismaMock = {
    $transaction: async (cb) => {
      const tx = {
        reserva: {
          findMany: async () => [reservaValida],
          update: async (args) => updatesReserva.push(args),
        },
      }
      return cb(tx)
    },
  }

  const userMock = { id: 'user-1', rol: 'PASAJERO' }
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.confirmarPagoSimulado({
      reservaId: 'res-valida',
      metodo: 'CREDITO',
      cuotas: 3,
    })
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CONFIRMADA')
  assert.equal(updatesReserva[0].data.metodoPago, 'CREDITO')
  assert.equal(updatesReserva[0].data.cuotasPago, 3)
  assert.equal(updatesReserva[0].data.importePagado, 100000)
  assert.ok(updatesReserva[0].data.pagadoAt instanceof Date)
  assert.match(redirects[0], /compra\/res-valida\?pagado=1/)
})

test('cancelarPorExpiracion cancela reservas, libera asientos y redirige con mensaje', async () => {
  const updatesReserva = []
  const updatesPasajeros = []

  const prismaMock = {
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
  const { actions, redirects, revalidations } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.cancelarPorExpiracion('res-exp')
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.equal(updatesReserva[0].data.estado, 'CANCELADA')
  assert.equal(updatesPasajeros.length, 1)
  assert.ok(updatesPasajeros[0].data.canceladoAt instanceof Date)
  assert.equal(redirects.length, 1)
  assert.match(redirects[0], /busquedaVuelo\?error=/)
  assert.ok(revalidations.includes('/pasajero/busquedaVuelo'))
})

test('cancelarPorExpiracion con ida y vuelta cancela ambas reservas, libera asientos y redirige con mensaje exacto', async () => {
  const updatesReserva = []
  const updatesPasajeros = []

  const prismaMock = {
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
  const { actions, redirects, revalidations } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.cancelarPorExpiracion('res-vuelta', 'res-ida')
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  assert.equal(updatesReserva.length, 1)
  assert.deepEqual(updatesReserva[0].where.id.in.sort(), ['res-ida', 'res-vuelta'].sort())
  assert.equal(updatesReserva[0].data.estado, 'CANCELADA')

  assert.equal(updatesPasajeros.length, 1)
  assert.deepEqual(updatesPasajeros[0].where.reservaId.in.sort(), ['res-ida', 'res-vuelta'].sort())
  assert.ok(updatesPasajeros[0].data.canceladoAt instanceof Date)

  const mensajeEsperado =
    '/pasajero/busquedaVuelo?error=El%20tiempo%20para%20completar%20la%20compra%20ha%20expirado.%20La%20reserva%20ha%20sido%20cancelada%20y%20los%20asientos%20liberados'
  assert.equal(redirects[0], mensajeEsperado)
  assert.ok(revalidations.includes('/pasajero/reservas'))
  assert.ok(revalidations.includes('/pasajero/busquedaVuelo'))
})

test('PagoSimuladoForm ejecuta automaticamente cancelarPorExpiracion al expirar y protege submit', () => {
  const rutaForm = path.join(__dirname, '..', 'app/pasajero/compra/[reservaId]/pago/PagoSimuladoForm.tsx')
  const contenido = fs.readFileSync(rutaForm, 'utf8')

  // Verifica que cancelarPorExpiracion este importado
  assert.match(contenido, /import\s*\{[^}]*cancelarPorExpiracion[^}]*\}\s*from\s*['"]\.\/actions['"]/)

  // Verifica que el useEffect ejecute cancelarPorExpiracion al llegar segundos <= 0
  assert.match(contenido, /useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(\s*segundos\s*<=\s*0\s*\)\s*\{[\s\S]*?cancelarPorExpiracion\(reservaId,\s*idaId\)/)

  // Verifica proteccion contra reentradas/bucles con un flag ref
  assert.match(contenido, /haExpiradoRef/)

  // Verifica que submitPayment tambien compruebe segundos <= 0
  assert.match(contenido, /function\s+submitPayment[\s\S]*?if\s*\(\s*segundos\s*<=\s*0\s*\)\s*\{[\s\S]*?cancelarPorExpiracion/)

  // Verifica que el boton de submit se deshabilite y cambie texto al expirar
  assert.match(contenido, /disabled=\{isPending\s*\|\|\s*segundos\s*<=\s*0\}/)
  assert.match(contenido, /segundos\s*<=\s*0\s*\?\s*['"]Tiempo expirado['"]/)
})

test('cancelarPorExpiracion redirige aun si la sesion del usuario no es PASAJERO sin fallar', async () => {
  const prismaMock = {
    $transaction: async () => {},
  }
  const userMock = null
  const { actions, redirects } = cargarModuloActions(prismaMock, userMock)

  try {
    await actions.cancelarPorExpiracion('res-sin-auth')
  } catch (err) {
    assert.equal(err.message, 'NEXT_REDIRECT')
  }

  const mensajeEsperado =
    '/pasajero/busquedaVuelo?error=El%20tiempo%20para%20completar%20la%20compra%20ha%20expirado.%20La%20reserva%20ha%20sido%20cancelada%20y%20los%20asientos%20liberados'
  assert.equal(redirects[0], mensajeEsperado)
})

