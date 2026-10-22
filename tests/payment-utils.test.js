const test = require('node:test')
const assert = require('node:assert/strict')

const {
  calculatePaymentTotal,
  calcularSegundosRestantes,
  esReservaExpirada,
  formatearSegundosMMSS,
  normalizarVencimiento,
  validateCardDetails,
} = require('../lib/payment-utils')

test('validateCardDetails accepts valid simulated card details with MM/YY expiry (e.g. 08/28)', () => {
  const errors = validateCardDetails({
    numero: '4242 4242 4242 4242',
    titular: 'Ana Perez',
    vencimiento: '08/28',
    cvv: '123',
    metodo: 'CREDITO',
    cuotas: 1,
    tipoDocumento: 'DNI',
    documento: '12345678',
  }, '2026-10')

  assert.deepEqual(errors, {})
})

test('normalizarVencimiento handles MM/YY, MM/YYYY and YYYY-MM correctly', () => {
  assert.equal(normalizarVencimiento('08/28'), '2028-08')
  assert.equal(normalizarVencimiento('08/2028'), '2028-08')
  assert.equal(normalizarVencimiento('2027-05'), '2027-05')
  assert.equal(normalizarVencimiento('13/28'), null)
  assert.equal(normalizarVencimiento('00/28'), null)
  assert.equal(normalizarVencimiento('invalid'), null)
})

test('validateCardDetails accepts valid simulated card details', () => {
  const errors = validateCardDetails({
    numero: '4242 4242 4242 4242',
    titular: 'Ana Perez',
    vencimiento: '2027-05',
    cvv: '123',
    metodo: 'CREDITO',
    cuotas: 1,
    tipoDocumento: 'DNI',
    documento: '12345678',
  }, '2026-10')

  assert.deepEqual(errors, {})
})

test('validateCardDetails rejects invalid card, expiry, security code, and document', () => {
  const errors = validateCardDetails({
    numero: '4242 4242 4242 4241',
    titular: '',
    vencimiento: '2026-09',
    cvv: '1',
    tipoDocumento: 'DNI',
    documento: 'x',
  }, '2026-10')

  assert.ok(errors.numero)
  assert.ok(errors.titular)
  assert.ok(errors.vencimiento)
  assert.ok(errors.cvv)
  assert.ok(errors.documento)
})

test('calculatePaymentTotal sums Economy and Primera fares for all reservations', () => {
  const total = calculatePaymentTotal([
    { clase: 'ECONOMY', asientos: 2, vuelo: { precioEconomy: 85000 } },
    { clase: 'PRIMERA', asientos: 1, vuelo: { precioPrimera: 210000 } },
  ])

  assert.equal(total, 380000)
})

test('calculatePaymentTotal rejects a reservation without a configured fare', () => {
  assert.throws(
    () => calculatePaymentTotal([{ clase: 'ECONOMY', asientos: 1, vuelo: { precioEconomy: null } }]),
    /no tiene precio configurado/i,
  )
})

test('calcularSegundosRestantes y esReservaExpirada detectan expiracion a los 3 minutos', () => {
  const ahora = Date.now()
  const hace1Min = new Date(ahora - 1 * 60 * 1000)
  const hace4Min = new Date(ahora - 4 * 60 * 1000)

  assert.equal(esReservaExpirada(hace1Min), false)
  assert.equal(calcularSegundosRestantes(hace1Min) > 100, true)

  assert.equal(esReservaExpirada(hace4Min), true)
  assert.equal(calcularSegundosRestantes(hace4Min), 0)
})

test('formatearSegundosMMSS formatea minutos y segundos correctamente', () => {
  assert.equal(formatearSegundosMMSS(600), '10:00')
  assert.equal(formatearSegundosMMSS(65), '01:05')
  assert.equal(formatearSegundosMMSS(0), '00:00')
  assert.equal(formatearSegundosMMSS(-5), '00:00')
})