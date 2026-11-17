/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas de Route Handlers con node --test y mocks locales. */
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
  new vm.Script(`(function(require, exports, module) { ${js}\n})`).runInThisContext()((id) => mocks[id] ?? require(id), mod.exports, mod)
  return mod.exports
}

const pasajeroValido = {
  canceladoAt: null,
  checkInCompletado: true,
  asiento: '12A',
  grupoEmbarque: '2',
  nombre: 'Juan Pérez',
  dni: '12345678',
  reserva: {
    estado: 'CONFIRMADA',
    clase: 'ECONOMY',
    fecha: '2026-12-15',
    userId: 'u1',
    vuelo: {
      codigoVuelo: 'SL123',
      origen: 'Buenos Aires',
      destino: 'Madrid',
      horaSalida: '10:45',
      horaLlegada: '13:20',
    },
  },
}

function crearTicket(opciones = {}) {
  const pasajero = structuredClone(pasajeroValido)
  if (opciones.reserva) Object.assign(pasajero.reserva, opciones.reserva)
  if (opciones.pasajero) Object.assign(pasajero, opciones.pasajero)
  return {
    id: 'ticket-1',
    pasajeroReserva: pasajero,
  }
}

function cargarRoute({ user = { id: 'u1', rol: 'PASAJERO' }, ticket = crearTicket(), pdfError = null } = {}) {
  let consultaTicket = null
  const prisma = {
    ticket: {
      findFirst: async (consulta) => {
        consultaTicket = consulta
        return ticket
      },
    },
  }
  const route = cargar('app/api/pasajero/tickets/[ticketId]/route.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/role-access': { getCurrentAppUser: async () => user },
    '@/components/TicketPDF': { TicketPDF: (datos) => ({ datos }) },
    '@react-pdf/renderer': {
      renderToBuffer: async () => {
        if (pdfError) throw pdfError
        return Buffer.from('%PDF-1.7\ncontenido de prueba')
      },
    },
  })
  return { route, obtenerConsulta: () => consultaTicket }
}

async function llamar(route, ticketId = 'ticket-1') {
  return route.GET(new Request(`http://localhost/api/pasajero/tickets/${ticketId}`), {
    params: Promise.resolve({ ticketId }),
  })
}

test('US20: usuario no autenticado responde 401', async () => {
  const { route } = cargarRoute({ user: null })
  const response = await llamar(route)
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.match(body.error, /iniciar sesión/i)
})

test('US20: rol incorrecto responde 403', async () => {
  const { route } = cargarRoute({ user: { id: 'u1', rol: 'ADMINISTRADOR' } })
  const response = await llamar(route)
  assert.equal(response.status, 403)
  const body = await response.json()
  assert.match(body.error, /pasajeros/i)
})

test('US20: ticket inexistente responde 404', async () => {
  const { route } = cargarRoute({ ticket: null })
  const response = await llamar(route, 'ticket-inexistente')
  assert.equal(response.status, 404)
  const body = await response.json()
  assert.match(body.error, /no existe|no pertenece/i)
})

test('US20: ticket perteneciente a otro usuario responde 404', async () => {
  const { route, obtenerConsulta } = cargarRoute({ ticket: null, user: { id: 'u2', rol: 'PASAJERO' } })
  const response = await llamar(route, 'ticket-ajeno')
  assert.equal(response.status, 404)
  const consulta = obtenerConsulta()
  assert.equal(consulta.where.id, 'ticket-ajeno')
  assert.equal(consulta.where.pasajeroReserva.reserva.userId, 'u2')
})

test('US20: reserva no confirmada responde 409', async () => {
  const { route } = cargarRoute({ ticket: crearTicket({ reserva: { estado: 'PENDIENTE' } }) })
  const response = await llamar(route)
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.match(body.error, /reserva no está confirmada/i)
})

test('US20: pasajero cancelado responde 409', async () => {
  const { route } = cargarRoute({ ticket: crearTicket({ pasajero: { canceladoAt: new Date() } }) })
  const response = await llamar(route)
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.match(body.error, /pasajero fue cancelado/i)
})

test('US20: check-in no completado responde 409', async () => {
  const { route } = cargarRoute({ ticket: crearTicket({ pasajero: { checkInCompletado: false } }) })
  const response = await llamar(route)
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.match(body.error, /completar el check-in/i)
})

test('US20: sin asiento asignado responde 409', async () => {
  const { route } = cargarRoute({ ticket: crearTicket({ pasajero: { asiento: null } }) })
  const response = await llamar(route)
  assert.equal(response.status, 409)
  const body = await response.json()
  assert.match(body.error, /no tiene asiento asignado/i)
})

test('US20: ticket válido responde 200 con PDF válido', async () => {
  const { route } = cargarRoute({ ticket: crearTicket() })
  const response = await llamar(route)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.match(response.headers.get('content-disposition') ?? '', /attachment; filename="Ticket_SL123_Juan_Perez\.pdf"/)
  const pdf = Buffer.from(await response.arrayBuffer())
  assert.ok(pdf.length > 0)
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
})

test('US20: error al generar el PDF responde 500', async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    const { route } = cargarRoute({ ticket: crearTicket(), pdfError: new Error('PDF renderer failed') })
    const response = await llamar(route)
    assert.equal(response.status, 500)
    const body = await response.json()
    assert.match(body.error, /no se pudo descargar/i)
  } finally {
    console.error = originalError
  }
})
