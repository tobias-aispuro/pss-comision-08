/* eslint-disable @typescript-eslint/no-require-imports -- Pruebas del servicio TS con node --test y mocks locales. */
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

function baseServicio(opciones = {}) {
  const eventos = []
  let ticketRecord = opciones.ticket ?? null
  let createCalls = 0
  let upsertCalls = 0
  let pdfCalls = 0
  let mailCalls = []
  let passengerCalls = 0

  const pasajeroValido = {
    id: 'p1',
    nombre: 'Ana Pérez',
    dni: '12345678',
    asiento: '12A',
    grupoEmbarque: '2',
  }

  const reservaValida = {
    id: 'r1',
    userId: 'u1',
    estado: 'CONFIRMADA',
    clase: 'ECONOMY',
    fecha: '2026-12-15',
    user: { email: 'ana@example.com' },
    vuelo: {
      codigoVuelo: 'SL123',
      origen: 'Buenos Aires',
      destino: 'Madrid',
      horaSalida: '10:45',
      horaLlegada: '13:20',
    },
  }

  const user = opciones.user === undefined
    ? { id: 'u1', rol: 'PASAJERO' }
    : opciones.user

  const prisma = {
    reserva: {
      findFirst: async () => {
        if (opciones.reservaValida === false) return null
        return {
          pasajeros: [{ id: 'p1' }],
        }
      },
    },
    pasajeroReserva: {
      findFirst: async ({ where }) => {
        passengerCalls++
        if (opciones.pasajeroValido === false) return null
        if (where.reserva?.userId && where.reserva.userId !== 'u1') return null
        if (opciones.pasajeroCancelado) return null
        if (opciones.checkInCompletado === false) return null
        if (opciones.sinAsiento) return null
        return {
          ...pasajeroValido,
          canceladoAt: opciones.pasajeroCancelado ? new Date() : null,
          checkInCompletado: opciones.checkInCompletado !== false,
          asiento: opciones.sinAsiento ? null : '12A',
          reserva: reservaValida,
        }
      },
    },
    ticket: {
      upsert: async ({ where, create }) => {
        upsertCalls++
        if (!ticketRecord) {
          createCalls++
          ticketRecord = {
            id: 'ticket-1',
            pasajeroReservaId: where.pasajeroReservaId,
            emailEstado: 'PENDIENTE',
            emailIntentos: 0,
            emailUltimoIntentoAt: null,
            emailEnviadoAt: null,
            emailError: null,
            emailLockUntil: null,
          }
        }
        eventos.push('upsert')
        return ticketRecord
      },
      updateMany: async ({ where, data }) => {
        if (!ticketRecord) return { count: 0 }

        if (data.emailEstado === 'ENVIANDO') {
          const permitido =
            ticketRecord.emailEstado === 'PENDIENTE' ||
            ticketRecord.emailEstado === 'ERROR' ||
            (ticketRecord.emailEstado === 'ENVIANDO' &&
              (!ticketRecord.emailLockUntil || ticketRecord.emailLockUntil < (where.OR?.at(-1)?.emailLockUntil?.lt ?? new Date())))

          if (!permitido) return { count: 0 }

          ticketRecord = {
            ...ticketRecord,
            emailEstado: 'ENVIANDO',
            emailIntentos: ticketRecord.emailIntentos + 1,
            emailUltimoIntentoAt: data.emailUltimoIntentoAt,
            emailLockUntil: data.emailLockUntil,
            emailError: null,
          }
          eventos.push('lock')
          return { count: 1 }
        }

        if (
          ticketRecord.emailEstado === 'ENVIANDO' &&
          ticketRecord.emailLockUntil &&
          ticketRecord.emailLockUntil.getTime() === where.emailLockUntil.getTime()
        ) {
          ticketRecord = {
            ...ticketRecord,
            emailEstado: data.emailEstado,
            emailEnviadoAt: data.emailEnviadoAt ?? ticketRecord.emailEnviadoAt,
            emailLockUntil: data.emailLockUntil,
            emailError: data.emailError ?? ticketRecord.emailError,
          }
          eventos.push(data.emailEstado)
          return { count: 1 }
        }

        return { count: 0 }
      },
      findUnique: async () => ticketRecord,
    },
  }

  const mockTicketPDF = (datos) => {
    eventos.push(['render', datos])
    return { datos }
  }

  const service = cargar('lib/ticket-service.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/role-access': { getCurrentAppUser: async () => user },
    '@/lib/mailer': {
      enviarEmail: async (email) => {
        mailCalls.push(email)
        eventos.push(['email', email.to])
        if (opciones.mailError) throw opciones.mailError
      },
    },
    '@/components/TicketPDF': { TicketPDF: mockTicketPDF },
    '@react-pdf/renderer': {
      renderToBuffer: async () => {
        pdfCalls++
        eventos.push('pdf')
        return Buffer.from('%PDF-1.7\nmock ticket')
      },
    },
  })

  return {
    service,
    eventos,
    obtenerTicket: () => ticketRecord,
    obtenerMailCalls: () => mailCalls,
    obtenerPdfCalls: () => pdfCalls,
    obtenerPassengerCalls: () => passengerCalls,
    obtenerCreateCalls: () => createCalls,
    obtenerUpsertCalls: () => upsertCalls,
  }
}

test('US19: emisión válida crea un ticket y adjunta el PDF al email del titular', async () => {
  const db = baseServicio()

  const resultado = await db.service.emitirTicketsDeReserva('r1')

  assert.equal(resultado.tickets.length, 1)
  assert.equal(resultado.tickets[0].ticketId, 'ticket-1')
  assert.equal(resultado.tickets[0].emailEstado, 'ENVIADO')
  assert.equal(db.obtenerCreateCalls(), 1)
  assert.equal(db.obtenerPdfCalls(), 1)
  assert.equal(db.obtenerMailCalls().length, 1)

  const mail = db.obtenerMailCalls()[0]
  assert.equal(mail.to, 'ana@example.com')
  assert.match(mail.subject, /SL123/)
  assert.equal(mail.attachments.length, 1)
  assert.equal(mail.attachments[0].contentType, 'application/pdf')
  assert.equal(mail.attachments[0].filename, 'Ticket_SL123_Ana_Pérez.pdf')
  assert.equal(db.obtenerTicket().emailEstado, 'ENVIADO')
})

test('US19: usuario no autorizado no puede emitir tickets', async () => {
  for (const user of [null, { id: 'u1', rol: 'ADMINISTRADOR' }]) {
    const db = baseServicio({ user })
    await assert.rejects(() => db.service.emitirTicketsDeReserva('r1'), /pasajero/i)
    assert.equal(db.obtenerUpsertCalls(), 0)
    assert.equal(db.obtenerMailCalls().length, 0)
  }
})

test('US19: reserva ajena o no confirmada no puede emitir tickets', async () => {
  const db = baseServicio({ reservaValida: false })
  await assert.rejects(() => db.service.emitirTicketsDeReserva('r1'), /no existe|no pertenece/i)
  assert.equal(db.obtenerUpsertCalls(), 0)
  assert.equal(db.obtenerMailCalls().length, 0)
})

test('US19: no emite si el pasajero está cancelado', async () => {
  const db = baseServicio({ pasajeroCancelado: true })
  await assert.rejects(() => db.service.emitirTicketsDeReserva('r1'), /check-in completado/i)
  assert.equal(db.obtenerUpsertCalls(), 0)
  assert.equal(db.obtenerMailCalls().length, 0)
})

test('US19: no emite si el check-in no está completo', async () => {
  const db = baseServicio({ checkInCompletado: false })
  await assert.rejects(() => db.service.emitirTicketsDeReserva('r1'), /check-in completado/i)
  assert.equal(db.obtenerUpsertCalls(), 0)
  assert.equal(db.obtenerMailCalls().length, 0)
})

test('US19: no emite si el pasajero no tiene asiento', async () => {
  const db = baseServicio({ sinAsiento: true })
  await assert.rejects(() => db.service.emitirTicketsDeReserva('r1'), /check-in completado/i)
  assert.equal(db.obtenerUpsertCalls(), 0)
  assert.equal(db.obtenerMailCalls().length, 0)
})

test('US19: ticket existente ya enviado reutiliza el ticket y no reenvía ni genera PDF', async () => {
  const db = baseServicio({
    ticket: {
      id: 'ticket-1',
      pasajeroReservaId: 'p1',
      emailEstado: 'ENVIADO',
      emailIntentos: 1,
      emailUltimoIntentoAt: new Date(),
      emailEnviadoAt: new Date(),
      emailError: null,
      emailLockUntil: null,
    },
  })

  const resultado = await db.service.emitirTicketsDeReserva('r1')

  assert.equal(resultado.tickets[0].ticketId, 'ticket-1')
  assert.equal(resultado.tickets[0].emailEstado, 'ENVIADO')
  assert.equal(db.obtenerCreateCalls(), 0)
  assert.equal(db.obtenerPdfCalls(), 0)
  assert.equal(db.obtenerMailCalls().length, 0)
})

test('US19: un fallo SMTP conserva el ticket y lo marca como ERROR sin eliminarlo', async () => {
  const db = baseServicio({ mailError: new Error('SMTP unavailable') })

  const resultado = await db.service.emitirTicketsDeReserva('r1')

  assert.equal(resultado.tickets[0].emailEstado, 'ERROR')
  assert.match(resultado.tickets[0].emailError, /SMTP unavailable/)
  assert.ok(db.obtenerTicket())
  assert.equal(db.obtenerTicket().emailEstado, 'ERROR')
  assert.equal(db.obtenerTicket().emailError, 'SMTP unavailable')
  assert.equal(db.obtenerTicket().emailLockUntil, null)
  assert.equal(db.obtenerPdfCalls(), 1)
  assert.equal(db.obtenerMailCalls().length, 1)
})

test('US19: el bloqueo impide dos envíos simultáneos del mismo ticket', async () => {
  const db = baseServicio()

  const [primero, segundo] = await Promise.all([
    db.service.emitirTicketsDeReserva('r1'),
    db.service.emitirTicketsDeReserva('r1'),
  ])

  assert.equal(db.obtenerCreateCalls(), 1)
  assert.equal(db.obtenerMailCalls().length, 1)
  assert.equal(db.obtenerPdfCalls(), 1)
  assert.ok(
    ['ENVIADO', 'ENVIANDO'].includes(primero.tickets[0].emailEstado),
  )
  assert.ok(
    ['ENVIADO', 'ENVIANDO'].includes(segundo.tickets[0].emailEstado),
  )
  assert.equal(db.obtenerTicket().emailEstado, 'ENVIADO')
})
