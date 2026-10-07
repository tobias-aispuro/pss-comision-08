const test = require('node:test')
const assert = require('node:assert/strict')

const {
  agruparPorPasajero,
  armarEmailCancelacion,
  notificarCancelacion,
} = require('../lib/cancelacion-email')

const VUELO = { codigoVuelo: 'SL1402', origen: 'Buenos Aires', destino: 'Córdoba', horaSalida: '08:30' }

function reserva(email, fecha, nombre = 'Ana') {
  return { fecha, user: { email, nombre, apellido: 'Pérez' } }
}

test('agruparPorPasajero devuelve un destinatario por pasajero con sus fechas ordenadas y sin repetir', () => {
  const pasajeros = agruparPorPasajero([
    reserva('ana@mail.com', '2026-11-27'),
    reserva('luis@mail.com', '2026-11-20', 'Luis'),
    reserva('ana@mail.com', '2026-11-20'),
    reserva('ana@mail.com', '2026-11-20'),
  ])

  assert.deepEqual(pasajeros, [
    { email: 'ana@mail.com', nombre: 'Ana', apellido: 'Pérez', fechas: ['2026-11-20', '2026-11-27'] },
    { email: 'luis@mail.com', nombre: 'Luis', apellido: 'Pérez', fechas: ['2026-11-20'] },
  ])
})

test('armarEmailCancelacion incluye vuelo, ruta, horario, fecha y motivo', () => {
  const email = armarEmailCancelacion({
    vuelo: VUELO,
    pasajero: { email: 'ana@mail.com', nombre: 'Ana', apellido: 'Pérez', fechas: ['2026-11-20'] },
    motivo: 'Tormenta',
  })

  assert.equal(email.to, 'ana@mail.com')
  assert.match(email.subject, /SL1402/)
  assert.match(email.subject, /20 de noviembre de 2026/)
  for (const cuerpo of [email.text, email.html]) {
    assert.match(cuerpo, /Hola Ana Pérez/)
    assert.match(cuerpo, /Buenos Aires → Córdoba/)
    assert.match(cuerpo, /08:30/)
    assert.match(cuerpo, /viernes, 20 de noviembre de 2026/)
    assert.match(cuerpo, /Motivo: Tormenta/)
  }
})

test('armarEmailCancelacion de una eliminación definitiva lista todas las fechas y no muestra motivo', () => {
  const email = armarEmailCancelacion({
    vuelo: VUELO,
    pasajero: { email: 'ana@mail.com', nombre: 'Ana', apellido: 'Pérez', fechas: ['2026-11-20', '2026-11-27'] },
    definitiva: true,
  })

  assert.match(email.text, /20 de noviembre de 2026/)
  assert.match(email.text, /27 de noviembre de 2026/)
  assert.match(email.text, /de manera definitiva/)
  assert.doesNotMatch(email.text, /Motivo:/)
})

test('armarEmailCancelacion escapa el HTML del motivo', () => {
  const email = armarEmailCancelacion({
    vuelo: VUELO,
    pasajero: { email: 'ana@mail.com', nombre: 'Ana', apellido: 'Pérez', fechas: ['2026-11-20'] },
    motivo: '<script>alert(1)</script>',
  })

  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /&lt;script&gt;/)
})

test('notificarCancelacion sigue enviando aunque un email falle e informa los fallidos', async () => {
  const enviados = []
  const original = console.error
  console.error = () => {}

  try {
    const resultado = await notificarCancelacion(
      {
        vuelo: VUELO,
        reservas: [reserva('ana@mail.com', '2026-11-20'), reserva('luis@mail.com', '2026-11-20', 'Luis')],
        motivo: 'Tormenta',
      },
      async (email) => {
        if (email.to === 'ana@mail.com') throw new Error('SMTP unavailable')
        enviados.push(email.to)
      }
    )

    assert.deepEqual(resultado, { notificados: 1, fallidos: ['ana@mail.com'] })
    assert.deepEqual(enviados, ['luis@mail.com'])
  } finally {
    console.error = original
  }
})

test('notificarCancelacion sin reservas no envía nada', async () => {
  const resultado = await notificarCancelacion({ vuelo: VUELO, reservas: [] }, async () => {
    throw new Error('No debería enviarse ningún email')
  })

  assert.deepEqual(resultado, { notificados: 0, fallidos: [] })
})
