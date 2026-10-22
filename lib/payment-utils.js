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

function normalizarVencimiento(value) {
  const str = String(value ?? '').trim()
  // Formato MM/YY o MM/YYYY
  const matchMMYY = str.match(/^(\d{2})\/?(\d{2}|\d{4})$/)
  if (matchMMYY) {
    const month = Number(matchMMYY[1])
    let year = Number(matchMMYY[2])
    if (month < 1 || month > 12) return null
    if (matchMMYY[2].length === 2) {
      year = 2000 + year
    }
    return `${year}-${String(month).padStart(2, '0')}`
  }

  // Formato YYYY-MM
  const matchYYYYMM = str.match(/^(\d{4})-(\d{2})$/)
  if (matchYYYYMM) {
    const year = Number(matchYYYYMM[1])
    const month = Number(matchYYYYMM[2])
    if (month < 1 || month > 12) return null
    return `${year}-${String(month).padStart(2, '0')}`
  }

  return null
}

/** @returns {Record<string, string>} */
function validateCardDetails(card, currentMonth) {
  /** @type {Record<string, string>} */
  const errors = {}
  const holder = String(card.titular ?? '').trim().replace(/\s+/g, ' ')
  const expiration = String(card.vencimiento ?? '').trim()
  const document = String(card.documento ?? '').trim()

  if (!validarLuhn(card.numero)) errors.numero = PAYMENT_FIELDS.numero
  if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(holder)) errors.titular = PAYMENT_FIELDS.titular
  const normExp = normalizarVencimiento(expiration)
  const normCurrent = currentMonth || new Date().toISOString().slice(0, 7)
  if (!normExp || normExp < normCurrent) {
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

const MINUTOS_EXPIRACION_RESERVA = 3

function calcularSegundosRestantes(createdAt, limiteMinutos = MINUTOS_EXPIRACION_RESERVA) {
  if (!createdAt) return 0
  const creado = new Date(createdAt).getTime()
  if (Number.isNaN(creado)) return 0
  const limiteMs = limiteMinutos * 60 * 1000
  const restanteMs = creado + limiteMs - Date.now()
  return Math.max(0, Math.floor(restanteMs / 1000))
}

function esReservaExpirada(createdAt, limiteMinutos = MINUTOS_EXPIRACION_RESERVA) {
  return calcularSegundosRestantes(createdAt, limiteMinutos) <= 0
}

function formatearSegundosMMSS(segundos) {
  const s = Math.max(0, Math.floor(segundos || 0))
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

module.exports = {
  MINUTOS_EXPIRACION_RESERVA,
  calcularSegundosRestantes,
  calculateInstallmentAmount,
  calculatePaymentTotal,
  esReservaExpirada,
  formatearARS,
  formatearSegundosMMSS,
  normalizarNumeroTarjeta,
  normalizarVencimiento,
  validateCardDetails,
  validarLuhn,
}