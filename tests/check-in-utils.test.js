/* eslint-disable @typescript-eslint/no-require-imports -- Tests ejecutados directamente con node --test. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluarCheckIn } = require('../lib/check-in-utils')

const HORA = 60 * 60 * 1000
const DESPEGUE = Date.parse('2026-11-20T13:00:00Z')
const APERTURA = DESPEGUE - 14 * 24 * HORA
const CIERRE = DESPEGUE - 48 * HORA
const datos = {
  reserva: { fecha: '2026-11-20', estado: 'CONFIRMADA' },
  vuelo: { horaSalida: '10:00', zonaOrigen: 'America/Argentina/Buenos_Aires', activo: true },
}

test('US18: habilita una reserva confirmada dentro de la ventana', () => {
  const resultado = evaluarCheckIn(datos, DESPEGUE - 7 * 24 * HORA)
  assert.equal(resultado.ok, true)
  assert.equal(resultado.apertura, APERTURA)
  assert.equal(resultado.cierre, CIERRE)
})

test('US18: bloquea antes de 14 días e informa la apertura exacta', () => {
  const resultado = evaluarCheckIn(datos, APERTURA - 1)
  assert.equal(resultado.ok, false)
  assert.equal(resultado.estado, 'ANTICIPADO')
  assert.equal(resultado.apertura, APERTURA)
})

test('US18: bloquea a menos de 48 horas y después del despegue', () => {
  for (const ahora of [CIERRE + 1, DESPEGUE, DESPEGUE + HORA]) {
    const resultado = evaluarCheckIn(datos, ahora)
    assert.equal(resultado.ok, false)
    assert.equal(resultado.mensaje, 'El período de check-in online ha finalizado.')
  }
})

test('US18: incluye los límites exactos de 14 días y 48 horas', () => {
  assert.equal(evaluarCheckIn(datos, APERTURA).ok, true)
  assert.equal(evaluarCheckIn(datos, CIERRE).ok, true)
})

test('US18: usa el huso de origen, incluido el cambio de horario estacional', () => {
  const resultado = evaluarCheckIn({
    ...datos,
    reserva: { ...datos.reserva, fecha: '2026-11-02' },
    vuelo: { ...datos.vuelo, zonaOrigen: 'America/New_York' },
  }, Date.parse('2026-10-25T12:00:00Z'))
  assert.equal(resultado.cierre, Date.parse('2026-10-31T15:00:00Z'))
  assert.equal(resultado.apertura, Date.parse('2026-10-19T15:00:00Z'))
  assert.equal(resultado.ok, true)
})

test('US18: usa Argentina cuando no se cargó zona de origen', () => {
  const resultado = evaluarCheckIn({ ...datos, vuelo: { ...datos.vuelo, zonaOrigen: null } }, APERTURA)
  assert.equal(resultado.apertura, APERTURA)
})

test('US18: exige reserva confirmada y vuelo no cancelado', () => {
  for (const estado of ['PENDIENTE', 'CANCELADA']) {
    assert.equal(evaluarCheckIn({ ...datos, reserva: { ...datos.reserva, estado } }, APERTURA).ok, false)
  }
  assert.equal(evaluarCheckIn({ ...datos, vuelo: { ...datos.vuelo, activo: false } }, APERTURA).ok, false)
  assert.equal(evaluarCheckIn({ ...datos, cancelado: true }, APERTURA).ok, false)
})

test('US18: ante horarios inválidos bloquea el acceso', () => {
  for (const fecha of ['inválida', '2026-02-30']) {
    assert.equal(evaluarCheckIn({ ...datos, reserva: { ...datos.reserva, fecha } }, APERTURA).ok, false)
  }
  for (const vuelo of [{ ...datos.vuelo, horaSalida: '25:00' }, { ...datos.vuelo, zonaOrigen: 'inválida' }]) {
    assert.equal(evaluarCheckIn({ ...datos, vuelo }, APERTURA).ok, false)
  }
})
