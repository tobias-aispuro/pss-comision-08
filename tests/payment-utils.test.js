const test = require('node:test')
const assert = require('node:assert/strict')

const {
  calcularMaximoTarjeta,
  calculatePaymentTotal,
  calcularSegundosRestantes,
  esReservaExpirada,
  formatCombinedPaymentSummary,
  formatearSegundosMMSS,
  MINUTOS_EXPIRACION_RESERVA,
  normalizarVencimiento,
  sanitizarMonto,
  snapMontoTarjeta,
  validateCardDetails,
  validateMultiCardAmounts,
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

test('calcularSegundosRestantes y esReservaExpirada detectan expiracion a los 5 minutos', () => {
  const ahora = Date.now()
  const hace1Min = new Date(ahora - 1 * 60 * 1000)
  const hace6Min = new Date(ahora - 6 * 60 * 1000)

  assert.equal(esReservaExpirada(hace1Min), false)
  assert.equal(calcularSegundosRestantes(hace1Min) > 200, true)

  assert.equal(esReservaExpirada(hace6Min), true)
  assert.equal(calcularSegundosRestantes(hace6Min), 0)
})

test('formatearSegundosMMSS formatea minutos y segundos correctamente', () => {
  assert.equal(formatearSegundosMMSS(600), '10:00')
  assert.equal(formatearSegundosMMSS(65), '01:05')
  assert.equal(formatearSegundosMMSS(0), '00:00')
  assert.equal(formatearSegundosMMSS(-5), '00:00')
})

test('validateMultiCardAmounts valida que la suma de tarjetas sea exactamente igual al total', () => {
  const total = 100000

  // Menor al total
  const menor = validateMultiCardAmounts([{ monto: 40000 }, { monto: 30000 }], total)
  assert.equal(menor.ok, false)
  assert.equal(menor.error, 'La suma de los medios de pago debe ser exactamente igual al monto total de la compra.')
  assert.equal(menor.remaining, 30000)

  // Mayor al total
  const mayor = validateMultiCardAmounts([{ monto: 60000 }, { monto: 50000 }], total)
  assert.equal(mayor.ok, false)
  assert.equal(mayor.error, 'La suma de los medios de pago debe ser exactamente igual al monto total de la compra.')

  // Menos de 2 tarjetas
  const una = validateMultiCardAmounts([{ monto: 100000 }], total)
  assert.equal(una.ok, false)
  assert.match(una.error, /al menos dos tarjetas/i)

  // Monto cero o invalido
  const cero = validateMultiCardAmounts([{ monto: 0 }, { monto: 100000 }], total)
  assert.equal(cero.ok, false)
  assert.match(cero.error, /mayor a cero/i)

  // Suma exacta
  const exacto = validateMultiCardAmounts([{ monto: 60000 }, { monto: 40000 }], total)
  assert.equal(exacto.ok, true)
  assert.equal(exacto.error, null)
  assert.equal(exacto.remaining, 0)
})

test('formatCombinedPaymentSummary formatea el resumen legible de tarjetas', () => {
  const resumen = formatCombinedPaymentSummary([
    { numero: '4242 4242 4242 4242', metodo: 'CREDITO', cuotas: 3, monto: 60000 },
    { numero: '4242 4242 4242 1234', metodo: 'DEBITO', cuotas: 1, monto: 40000 },
  ])

  assert.match(resumen, /^COMBINADO:/)
  assert.match(resumen, /Tarjeta 1: Crédito \*\*\*\* 4242/)
  assert.match(resumen, /3 cuotas/)
  assert.match(resumen, /Tarjeta 2: Débito \*\*\*\* 1234/)
})

test('sanitizarMonto rechaza negativos, letras y caracteres no numéricos, admitiendo solo números positivos y decimales', () => {
  // Valores nulos o vacíos
  assert.equal(sanitizarMonto(''), '')
  assert.equal(sanitizarMonto(null), '')
  assert.equal(sanitizarMonto(undefined), '')

  // Enteros positivos
  assert.equal(sanitizarMonto('50000'), '50000')
  assert.equal(sanitizarMonto('  12000  '), '12000')

  // Negativos: el signo menos debe ser eliminado/impedido
  assert.equal(sanitizarMonto('-50000'), '50000')
  assert.equal(sanitizarMonto('-'), '')
  assert.equal(sanitizarMonto('-0.5'), '0.5')

  // Letras y caracteres alfabéticos: deben ser eliminados
  assert.equal(sanitizarMonto('abc'), '')
  assert.equal(sanitizarMonto('50abc00'), '5000')
  assert.equal(sanitizarMonto('1e5'), '15')
  assert.equal(sanitizarMonto('$1500'), '1500')

  // Decimales y comas
  assert.equal(sanitizarMonto('100.5'), '100.5')
  assert.equal(sanitizarMonto('100.50'), '100.50')
  assert.equal(sanitizarMonto('100,50'), '100.50')
  assert.equal(sanitizarMonto('100.509'), '100.50') // Máximo 2 decimales
  assert.equal(sanitizarMonto('.5'), '0.5')
  assert.equal(sanitizarMonto('0.'), '0.')
  assert.equal(sanitizarMonto('100.50.25'), '100.50') // Solo un punto

  // Ceros iniciales
  assert.equal(sanitizarMonto('0'), '0')
  assert.equal(sanitizarMonto('00'), '0')
  assert.equal(sanitizarMonto('0500'), '500')

  // Monedas con separadores de miles y decimales
  assert.equal(sanitizarMonto('$ 12.500,50'), '12500.50')
  assert.equal(sanitizarMonto('$ 12,500.50'), '12500.50')
  assert.equal(sanitizarMonto('1,000,000'), '1000000')
  assert.equal(sanitizarMonto('1.000.000'), '1000000')
  assert.equal(sanitizarMonto('9.999.999.999.999.875.000'), '999999999999')
  assert.equal(sanitizarMonto('$ 9.999.999.999.999.875.000,00'), '999999999999.00')

  // Números gigantes: no permitir que desborden la precisión numérica (máx 12 dígitos)
  assert.equal(sanitizarMonto('9999999999999999999'), '999999999999')
  assert.equal(sanitizarMonto('100000000000000000000'), '100000000000')
})

test('calcularMaximoTarjeta calcula correctamente el monto restante para cubrir el 100% del pago', () => {
  const total = 100000

  // Tarjeta 1 con tarjeta 2 vacía
  assert.equal(calcularMaximoTarjeta(0, [{ monto: '' }, { monto: '' }], total), 100000)

  // Tarjeta 2 cuando Tarjeta 1 ya asignó 60.000
  assert.equal(calcularMaximoTarjeta(1, [{ monto: '60000' }, { monto: '' }], total), 40000)

  // Tarjeta 2 cuando Tarjeta 1 ya asignó el 100% (100.000)
  assert.equal(calcularMaximoTarjeta(1, [{ monto: '100000' }, { monto: '' }], total), 0)

  // Con 3 tarjetas: Tarjeta 3 cuando T1=30.000 y T2=45.000
  assert.equal(
    calcularMaximoTarjeta(2, [{ monto: '30000' }, { monto: '45000' }, { monto: '' }], total),
    25000
  )

  // Con decimales
  assert.equal(
    calcularMaximoTarjeta(1, [{ monto: '50.25' }, { monto: '' }], 100.5),
    50.25
  )
})

test('snapMontoTarjeta topará ("snap") automáticamente el monto al saldo necesario restante y protegerá contra desbordes', () => {
  const total = 100000
  const tarjetas = [{ monto: '60000' }, { monto: '' }] // Tarjeta 1 = 60.000, Tarjeta 2 por asignar (restante 40.000)

  // Entrada menor al restante: se conserva
  assert.equal(snapMontoTarjeta(1, '30000', tarjetas, total), '30000')
  assert.equal(snapMontoTarjeta(1, '40000', tarjetas, total), '40000')

  // Entrada que supera el restante: hace snap al restante exacto (40000)
  assert.equal(snapMontoTarjeta(1, '50000', tarjetas, total), '40000')
  assert.equal(snapMontoTarjeta(1, '100000', tarjetas, total), '40000')

  // Número gigante que antes desbordaba precisión numérica: hace snap a 40000 de forma segura
  assert.equal(snapMontoTarjeta(1, '9999999999999999999', tarjetas, total), '40000')
  assert.equal(snapMontoTarjeta(1, '100000000000000000000', tarjetas, total), '40000')
  assert.equal(snapMontoTarjeta(1, '9.999.999.999.999.875.000', tarjetas, total), '40000')
  assert.equal(snapMontoTarjeta(1, '$ 9.999.999.999.999.875.000,00', tarjetas, total), '40000')
  assert.equal(snapMontoTarjeta(1, '$ 1.000.000', tarjetas, total), '40000')

  // Entrada vacía (usuario borra para escribir): debe permitir string vacío
  assert.equal(snapMontoTarjeta(1, '', tarjetas, total), '')

  // Entrada con punto decimal en progreso de escritura
  assert.equal(snapMontoTarjeta(1, '35000.', tarjetas, total), '35000.')
  // Si la parte entera del decimal ya supera el restante, hace snap
  assert.equal(snapMontoTarjeta(1, '50000.', tarjetas, total), '40000')

  // Decimales: total = 100.50, Tarjeta 1 = 50.25, restante = 50.25
  const tarjetasDecimal = [{ monto: '50.25' }, { monto: '' }]
  assert.equal(snapMontoTarjeta(1, '50.25', tarjetasDecimal, 100.5), '50.25')
  assert.equal(snapMontoTarjeta(1, '50.30', tarjetasDecimal, 100.5), '50.25')
  assert.equal(snapMontoTarjeta(1, '999999999999', tarjetasDecimal, 100.5), '50.25')

  // Cuando el restante es cero (otra tarjeta cubre el 100%)
  const tarjetasLlenas = [{ monto: '100000' }, { monto: '' }]
  assert.equal(snapMontoTarjeta(1, '500', tarjetasLlenas, total), '0')
})