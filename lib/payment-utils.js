const PAYMENT_FIELDS = {
  numero: 'Ingresá un número de tarjeta válido.',
  titular: 'Ingresá el nombre del titular como figura en la tarjeta.',
  vencimiento: 'La tarjeta debe estar vigente.',
  cvv: 'Ingresá un código de seguridad de 3 o 4 dígitos.',
  documento: 'Ingresá un documento válido del titular.',
}

function normalizarNumeroTarjeta(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function validarLuhn(value) {
  const digits = normalizarNumeroTarjeta(value)
  if (!/^\d{13,19}$/.test(digits)) return false

  let sum = 0
  let doubleDigit = false
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

/** @returns {Record<string, string>} */
function validateCardDetails(card, currentMonth) {
  /** @type {Record<string, string>} */
  const errors = {}
  const holder = String(card.titular ?? '').trim().replace(/\s+/g, ' ')
  const expiration = String(card.vencimiento ?? '')
  const document = String(card.documento ?? '').trim()

  if (!validarLuhn(card.numero)) errors.numero = PAYMENT_FIELDS.numero
  if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(holder)) errors.titular = PAYMENT_FIELDS.titular
  if (!/^\d{4}-\d{2}$/.test(expiration) || expiration < currentMonth) {
    errors.vencimiento = PAYMENT_FIELDS.vencimiento
  }
  if (!/^\d{3,4}$/.test(String(card.cvv ?? ''))) errors.cvv = PAYMENT_FIELDS.cvv
  if (!['DNI', 'PASAPORTE', 'NIF'].includes(card.tipoDocumento)) {
    errors.tipoDocumento = 'Seleccioná el tipo de documento.'
  }
  if (!/^[\p{L}\d.-]{5,20}$/u.test(document)) errors.documento = PAYMENT_FIELDS.documento
  if (!['CREDITO', 'DEBITO'].includes(card.metodo)) errors.metodo = 'Seleccioná un medio de pago.'
  if (![1, 3, 6].includes(Number(card.cuotas)) || (card.metodo === 'DEBITO' && Number(card.cuotas) !== 1)) {
    errors.cuotas = 'Seleccioná un plan de cuotas válido.'
  }

  return errors
}

function calculatePaymentTotal(reservations) {
  return reservations.reduce((total, reservation) => {
    const priceField = reservation.clase === 'PRIMERA' ? 'precioPrimera' : 'precioEconomy'
    const unitPrice = reservation.vuelo?.[priceField]

    if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
      throw new Error(`El vuelo ${reservation.vuelo?.codigoVuelo ?? ''} no tiene precio configurado para la clase ${reservation.clase}.`)
    }

    if (!Number.isSafeInteger(reservation.asientos) || reservation.asientos < 1) {
      throw new Error('La reserva tiene una cantidad de pasajes inválida.')
    }

    return total + unitPrice * reservation.asientos
  }, 0)
}

function calculateInstallmentAmount(total, installments) {
  return total / installments
}

function formatearARS(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(amount)
}

module.exports = {
  calculateInstallmentAmount,
  calculatePaymentTotal,
  formatearARS,
  normalizarNumeroTarjeta,
  validateCardDetails,
  validarLuhn,
}