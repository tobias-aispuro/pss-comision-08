const test = require('node:test')
const assert = require('node:assert/strict')

const { calculatePaymentTotal, validateCardDetails } = require('../lib/payment-utils')

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