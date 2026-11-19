/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas ejecutadas con node --test y mocks locales. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function cargar(ruta, mocks = {}) {
  const fuente = fs.readFileSync(path.join(__dirname, '..', ruta), 'utf8')
  const js = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mod = { exports: {} }
  new vm.Script(`(function(require, exports, module) { ${js}\n})`).runInThisContext()(
    (id) => mocks[id] ?? require(id),
    mod.exports,
    mod
  )
  return mod.exports
}

const utils = cargar('lib/ticket-validacion-utils.ts')
const {
  validarIdentificadorTicket,
  formatearFechaHoraValidacion,
  evaluarEstadoTicket,
} = utils

// Datos base para armar tickets válidos
function crearTicketValido(overrides = {}) {
  const base = {
    id: 'ticket-valido-1',
    validado: false,
    validadoAt: null,
    validadoPorId: null,
    pasajeroReserva: {
      id: 'pax-1',
      nombre: 'Carlos Gómez',
      dni: '30123456',
      telefono: '+5491144556677',
      asiento: '14B',
      grupoEmbarque: 'Grupo 2',
      canceladoAt: null,
      checkInCompletado: true,
      reserva: {
        id: 'reserva-1',
        clase: 'ECONOMY',
        fecha: '2026-12-01',
        estado: 'CONFIRMADA',
        user: {
          nombre: 'Carlos',
          apellido: 'Gómez',
          email: 'carlos@example.com',
          telefono: '+5491144556677',
          dni: '30123456',
        },
        vuelo: {
          id: 'vuelo-1',
          codigoVuelo: 'SL550',
          origen: 'Buenos Aires',
          destino: 'Bariloche',
          horaSalida: '09:00',
          horaLlegada: '11:15',
          tipoAvion: 'Boeing 737-800',
          activo: true,
          cancelaciones: [],
        },
      },
    },
  }

  // Merge recursivo superficial
  const merge = (dst, src) => {
    for (const k of Object.keys(src)) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && !(src[k] instanceof Date)) {
        dst[k] = dst[k] || {}
        merge(dst[k], src[k])
      } else {
        dst[k] = src[k]
      }
    }
    return dst
  }

  return merge(structuredClone(base), overrides)
}

function armarContextoAction({
  rol = 'EMPLEADO_MOSTRADOR',
  ticket = crearTicketValido(),
  onUpdateMany = null,
} = {}) {
  let dbTicket = ticket ? structuredClone(ticket) : null
  let dbConsultada = false
  let updatesEjecutados = []

  const mockPrisma = {
    ticket: {
      findUnique: async ({ where }) => {
        dbConsultada = true
        if (dbTicket && dbTicket.id === where.id) {
          return structuredClone(dbTicket)
        }
        return null
      },
      updateMany: async ({ where, data }) => {
        updatesEjecutados.push({ where, data })
        if (onUpdateMany) {
          return onUpdateMany({ where, data, dbTicket })
        }
        if (dbTicket && dbTicket.id === where.id && dbTicket.validado === where.validado) {
          dbTicket.validado = data.validado
          dbTicket.validadoAt = data.validadoAt
          dbTicket.validadoPorId = data.validadoPorId
          return { count: 1 }
        }
        return { count: 0 }
      },
    },
  }

  const mockRoleAccess = {
    requireRole: async (allowedRoles) => {
      if (!rol) {
        const error = new Error('No autenticado')
        error.digest = 'NEXT_REDIRECT;/sign-in;307'
        throw error
      }
      if (!allowedRoles.includes(rol)) {
        const error = new Error('Acceso denegado')
        error.digest = 'NEXT_REDIRECT;/acceso-denegado;307'
        throw error
      }
      return { id: 'empleado-emp-1', nombre: 'Agente', rol }
    },
  }

  const actions = cargar('app/empleado/validar-ticket/actions.ts', {
    '@/lib/prisma': { prisma: mockPrisma },
    '@/lib/role-access': mockRoleAccess,
    '@/lib/ticket-validacion-utils': utils,
  })

  return {
    actions,
    getDbTicket: () => dbTicket,
    fueDbConsultada: () => dbConsultada,
    getUpdates: () => updatesEjecutados,
  }
}

// =============================================================================
// PRUEBAS DE LÓGICA PURA: validarIdentificadorTicket
// =============================================================================
test('US-23 Escenario 4: validarIdentificadorTicket rechaza vacíos, espacios y tipos no válidos', () => {
  const casosVacios = ['', '   ', '\t\n', null, undefined, 123, {}, []]

  for (const entrada of casosVacios) {
    const res = validarIdentificadorTicket(entrada)
    assert.equal(res.ok, false)
    assert.match(res.error, /ingrese o escanee un identificador/i)
  }
})

test('US-23 Escenario 4: validarIdentificadorTicket acepta identificadores y recorta espacios', () => {
  const res = validarIdentificadorTicket('   ticket-abc-123   ')
  assert.equal(res.ok, true)
  assert.equal(res.id, 'ticket-abc-123')
})

test('US-23: validarIdentificadorTicket extrae ID de formatos con prefijo o URL', () => {
  const resPrefijo = validarIdentificadorTicket('ticket:f47ac10b-58cc-4372-a567-0e02b2c3d479')
  assert.equal(resPrefijo.ok, true)
  assert.equal(resPrefijo.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479')

  const resUrl = validarIdentificadorTicket('https://skylink.com/api/pasajero/tickets/f47ac10b-58cc-4372-a567-0e02b2c3d479')
  assert.equal(resUrl.ok, true)
  assert.equal(resUrl.id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
})

// =============================================================================
// PRUEBAS DE LÓGICA PURA: formatearFechaHoraValidacion
// =============================================================================
test('US-23: formatearFechaHoraValidacion formatea fechas y maneja nulos/inválidos', () => {
  assert.equal(formatearFechaHoraValidacion(null), '')
  assert.equal(formatearFechaHoraValidacion(undefined), '')
  assert.equal(formatearFechaHoraValidacion('fecha-invalida'), '')

  const fechaFija = new Date('2026-11-18T18:30:00Z')
  const formateada = formatearFechaHoraValidacion(fechaFija)
  // En UTC-3 (America/Argentina/Buenos_Aires) las 18:30Z son las 15:30
  assert.match(formateada, /18\/11\/2026/)
  assert.match(formateada, /15:30:00/)
})

// =============================================================================
// PRUEBAS DE LÓGICA PURA: evaluarEstadoTicket
// =============================================================================
test('US-23 Escenario 2: evaluarEstadoTicket informa ticket inexistente', () => {
  const res = evaluarEstadoTicket(null)
  assert.equal(res.ok, false)
  assert.equal(res.estado, 'INEXISTENTE')
  assert.match(res.mensaje, /no válido/i)
})

test('US-23 Escenario 3: evaluarEstadoTicket identifica ticket ya validado previamente', () => {
  const ticketYaValidado = crearTicketValido({
    validado: true,
    validadoAt: new Date('2026-11-18T14:30:00Z'),
  })
  const res = evaluarEstadoTicket(ticketYaValidado)
  assert.equal(res.ok, false)
  assert.equal(res.estado, 'YA_VALIDADO')
  assert.match(res.mensaje, /ya validado previamente/i)
  assert.match(res.mensaje, /no puede utilizarse nuevamente/i)
})

test('US-23 Escenario 2: evaluarEstadoTicket rechaza si el pasaje fue cancelado', () => {
  const ticketCancelado = crearTicketValido({
    pasajeroReserva: { canceladoAt: new Date() },
  })
  const res = evaluarEstadoTicket(ticketCancelado)
  assert.equal(res.ok, false)
  assert.equal(res.estado, 'INVALIDO')
  assert.match(res.mensaje, /cancelado/i)
  assert.match(res.mensaje, /denegado/i)
})

test('US-23 Escenario 2: evaluarEstadoTicket rechaza si la reserva está cancelada o pendiente', () => {
  const ticketReservaCancelada = crearTicketValido({
    pasajeroReserva: { reserva: { estado: 'CANCELADA' } },
  })
  const resCancelada = evaluarEstadoTicket(ticketReservaCancelada)
  assert.equal(resCancelada.ok, false)
  assert.equal(resCancelada.estado, 'INVALIDO')
  assert.match(resCancelada.mensaje, /cancelada/i)

  const ticketReservaPendiente = crearTicketValido({
    pasajeroReserva: { reserva: { estado: 'PENDIENTE' } },
  })
  const resPendiente = evaluarEstadoTicket(ticketReservaPendiente)
  assert.equal(resPendiente.ok, false)
  assert.equal(resPendiente.estado, 'INVALIDO')
  assert.match(resPendiente.mensaje, /no está confirmada/i)
})

test('US-23 Escenario 2: evaluarEstadoTicket rechaza si el vuelo está inactivo o cancelado', () => {
  const ticketVueloInactivo = crearTicketValido({
    pasajeroReserva: { reserva: { vuelo: { activo: false } } },
  })
  const resInactivo = evaluarEstadoTicket(ticketVueloInactivo)
  assert.equal(resInactivo.ok, false)
  assert.equal(resInactivo.estado, 'INVALIDO')
  assert.match(resInactivo.mensaje, /inactivo/i)

  const ticketSalidaCancelada = crearTicketValido({
    pasajeroReserva: {
      reserva: {
        fecha: '2026-12-01',
        vuelo: { cancelaciones: [{ fecha: '2026-12-01' }] },
      },
    },
  })
  const resCancelado = evaluarEstadoTicket(ticketSalidaCancelada)
  assert.equal(resCancelado.ok, false)
  assert.equal(resCancelado.estado, 'INVALIDO')
  assert.match(resCancelado.mensaje, /cancelado/i)
})

test('US-23 Escenario 2: evaluarEstadoTicket rechaza si check-in incompleto o sin asiento', () => {
  const ticketSinCheckIn = crearTicketValido({
    pasajeroReserva: { checkInCompletado: false },
  })
  const resCheckIn = evaluarEstadoTicket(ticketSinCheckIn)
  assert.equal(resCheckIn.ok, false)
  assert.equal(resCheckIn.estado, 'INVALIDO')
  assert.match(resCheckIn.mensaje, /check-in/i)

  const ticketSinAsiento = crearTicketValido({
    pasajeroReserva: { asiento: null },
  })
  const resAsiento = evaluarEstadoTicket(ticketSinAsiento)
  assert.equal(resAsiento.ok, false)
  assert.equal(resAsiento.estado, 'INVALIDO')
  assert.match(resAsiento.mensaje, /asiento/i)

  const ticketAsientoEspacios = crearTicketValido({
    pasajeroReserva: { asiento: '   ' },
  })
  const resEspacios = evaluarEstadoTicket(ticketAsientoEspacios)
  assert.equal(resEspacios.ok, false)
  assert.equal(resEspacios.estado, 'INVALIDO')
  assert.match(resEspacios.mensaje, /asiento/i)
})

test('US-23 Escenario 1: evaluarEstadoTicket autoriza ticket válido con información completa', () => {
  const ticketValido = crearTicketValido()
  const res = evaluarEstadoTicket(ticketValido)

  assert.equal(res.ok, true)
  assert.equal(res.estado, 'VALIDO')
  assert.match(res.mensaje, /Ticket electrónico válido/i)
  assert.match(res.mensaje, /embarque/i)

  assert.ok(res.datos)
  assert.equal(res.datos.ticketId, 'ticket-valido-1')
  assert.equal(res.datos.pasajero.nombre, 'Carlos Gómez')
  assert.equal(res.datos.pasajero.dni, '30123456')
  assert.equal(res.datos.pasajero.asiento, '14B')
  assert.equal(res.datos.pasajero.grupoEmbarque, 'Grupo 2')

  assert.equal(res.datos.vuelo.codigoVuelo, 'SL550')
  assert.equal(res.datos.vuelo.origen, 'Buenos Aires')
  assert.equal(res.datos.vuelo.destino, 'Bariloche')
  assert.equal(res.datos.vuelo.fecha, '2026-12-01')
  assert.equal(res.datos.vuelo.horaSalida, '09:00')
  assert.equal(res.datos.vuelo.horaLlegada, '11:15')
  assert.equal(res.datos.vuelo.tipoAvion, 'Boeing 737-800')
  assert.equal(res.datos.vuelo.clase, 'ECONOMY')
  assert.equal(res.datos.vuelo.pnr, 'reserva-1')
})

// =============================================================================
// PRUEBAS DE INTEGRACIÓN DEL SERVER ACTION: validarTicketAction
// =============================================================================
test('US-23 Escenario 1: Camino exitoso. Validación de un ticket electrónico válido', async () => {
  const ctx = armarContextoAction({ rol: 'EMPLEADO_MOSTRADOR' })
  const res = await ctx.actions.validarTicketAction('ticket-valido-1')

  assert.equal(res.ok, true)
  assert.equal(res.estado, 'VALIDO')
  assert.match(res.mensaje, /Ticket electrónico válido/i)

  // Verifica datos del pasajero
  assert.equal(res.datos.pasajero.nombre, 'Carlos Gómez')
  assert.equal(res.datos.pasajero.dni, '30123456')
  assert.equal(res.datos.pasajero.asiento, '14B')
  assert.equal(res.datos.pasajero.grupoEmbarque, 'Grupo 2')

  // Verifica datos del vuelo
  assert.equal(res.datos.vuelo.codigoVuelo, 'SL550')
  assert.equal(res.datos.vuelo.origen, 'Buenos Aires')
  assert.equal(res.datos.vuelo.destino, 'Bariloche')
  assert.equal(res.datos.vuelo.clase, 'ECONOMY')

  // Verifica persistencia en la base de datos
  const dbTicket = ctx.getDbTicket()
  assert.equal(dbTicket.validado, true)
  assert.ok(dbTicket.validadoAt instanceof Date)
  assert.equal(dbTicket.validadoPorId, 'empleado-emp-1')
})

test('US-23 Escenario 2: Camino de excepciones. Ticket inexistente o inválido', async () => {
  const ctx = armarContextoAction({ rol: 'EMPLEADO_MOSTRADOR', ticket: null })
  const res = await ctx.actions.validarTicketAction('uuid-inexistente-999')

  assert.equal(res.ok, false)
  assert.equal(res.estado, 'INEXISTENTE')
  assert.match(res.mensaje, /Ticket no válido/i)
  assert.equal(ctx.getUpdates().length, 0)
})

test('US-23 Escenario 3: Camino de excepciones. Ticket ya utilizado o validado', async () => {
  const fechaPrevia = new Date('2026-11-18T15:00:00Z')
  const ticketPrevio = crearTicketValido({
    validado: true,
    validadoAt: fechaPrevia,
    validadoPorId: 'otro-empleado',
  })
  const ctx = armarContextoAction({ rol: 'EMPLEADO_MOSTRADOR', ticket: ticketPrevio })
  const res = await ctx.actions.validarTicketAction('ticket-valido-1')

  assert.equal(res.ok, false)
  assert.equal(res.estado, 'YA_VALIDADO')
  assert.match(res.mensaje, /ya validado previamente/i)
  assert.match(res.mensaje, /no puede utilizarse nuevamente/i)

  // Verifica que no se sobreescribió en la DB
  assert.equal(ctx.getUpdates().length, 0)
  assert.equal(ctx.getDbTicket().validadoPorId, 'otro-empleado')
})

test('US-23 Escenario 4: Camino de excepciones. Identificador de ticket vacío', async () => {
  const ctx = armarContextoAction({ rol: 'EMPLEADO_MOSTRADOR' })
  const res = await ctx.actions.validarTicketAction('   ')

  assert.equal(res.ok, false)
  assert.equal(res.estado, 'INVALIDO')
  assert.match(res.mensaje, /ingrese o escanee un identificador de ticket/i)

  // No debe tocar la base de datos
  assert.equal(ctx.fueDbConsultada(), false)
  assert.equal(ctx.getUpdates().length, 0)
})

test('US-23 Escenario 5: Camino de excepciones. Usuario sin permisos de validación', async () => {
  const ctxPasajero = armarContextoAction({ rol: 'PASAJERO' })

  await assert.rejects(
    async () => {
      await ctxPasajero.actions.validarTicketAction('ticket-valido-1')
    },
    (err) => {
      assert.match(err.message, /Acceso denegado/i)
      assert.match(err.digest, /acceso-denegado/i)
      return true
    }
  )

  const ctxAnonimo = armarContextoAction({ rol: null })

  await assert.rejects(
    async () => {
      await ctxAnonimo.actions.validarTicketAction('ticket-valido-1')
    },
    (err) => {
      assert.match(err.message, /No autenticado/i)
      assert.match(err.digest, /sign-in/i)
      return true
    }
  )
})

test('US-23 Escenario 1: tolera identificadores ingresados en mayúsculas (lectores de código con CapsLock)', async () => {
  const ctx = armarContextoAction({ rol: 'EMPLEADO_MOSTRADOR' })
  const res = await ctx.actions.validarTicketAction('TICKET-VALIDO-1')

  assert.equal(res.ok, true)
  assert.equal(res.estado, 'VALIDO')
  assert.equal(res.datos.ticketId, 'ticket-valido-1')

  const dbTicket = ctx.getDbTicket()
  assert.equal(dbTicket.validado, true)
})

test('US-23 Concurrencia: dos validaciones simultáneas dan un solo ganador', async () => {
  const ticketBase = crearTicketValido()
  let ticketDb = structuredClone(ticketBase)
  let updateCalls = 0

  const mockPrisma = {
    ticket: {
      findUnique: async () => structuredClone(ticketDb),
      updateMany: async ({ where, data }) => {
        updateCalls++
        // Si el ticket ya no tiene validado == false en la "DB", falla con count: 0
        if (ticketDb.id === where.id && ticketDb.validado === where.validado) {
          ticketDb.validado = data.validado
          ticketDb.validadoAt = data.validadoAt
          ticketDb.validadoPorId = data.validadoPorId
          return { count: 1 }
        }
        return { count: 0 }
      },
    },
  }

  const actions = cargar('app/empleado/validar-ticket/actions.ts', {
    '@/lib/prisma': { prisma: mockPrisma },
    '@/lib/role-access': {
      requireRole: async () => ({ id: 'emp-1', nombre: 'Agente', rol: 'EMPLEADO_MOSTRADOR' }),
    },
    '@/lib/ticket-validacion-utils': utils,
  })

  // Ejecución simultánea
  const [res1, res2] = await Promise.all([
    actions.validarTicketAction('ticket-valido-1'),
    actions.validarTicketAction('ticket-valido-1'),
  ])

  const exitosos = [res1, res2].filter((r) => r.ok && r.estado === 'VALIDO')
  const rechazados = [res1, res2].filter((r) => !r.ok && r.estado === 'YA_VALIDADO')

  assert.equal(exitosos.length, 1, 'Exactamente una validación debe ser exitosa')
  assert.equal(rechazados.length, 1, 'Exactamente una validación debe ser rechazada por colisión concurrente')
  assert.match(rechazados[0].mensaje, /ya validado previamente/i)
  assert.equal(updateCalls, 2, 'Ambas llamadas deben haber intentado actualizar')
})
