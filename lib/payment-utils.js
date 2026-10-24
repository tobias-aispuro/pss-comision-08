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

const MINUTOS_EXPIRACION_RESERVA = 5

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

function validateMultiCardAmounts(cards, total) {
  if (!Array.isArray(cards) || cards.length < 2) {
    return {
      ok: false,
      error: 'Debés ingresar al menos dos tarjetas para el pago combinado.',
      sum: 0,
      remaining: total,
    }
  }

  const sum = cards.reduce((acc, c) => acc + (Number(c.monto) || 0), 0)
  const remaining = total - sum

  if (Math.round(sum * 100) !== Math.round(total * 100)) {
    return {
      ok: false,
      error: 'La suma de los medios de pago debe ser exactamente igual al monto total de la compra.',
      sum,
      remaining,
    }
  }

  for (let index = 0; index < cards.length; index++) {
    const card = cards[index]
    const montoNum = Number(card.monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return {
        ok: false,
        error: `El monto de la tarjeta ${index + 1} debe ser mayor a cero.`,
        sum,
        remaining,
      }
    }
  }

  return { ok: true, error: null, sum, remaining: 0 }
}

function formatCombinedPaymentSummary(cards) {
  const parts = cards.map((c, index) => {
    const digits = normalizarNumeroTarjeta(c.numero)
    const ultimos4 = digits.length >= 4 ? digits.slice(-4) : '****'
    const metodoLabel = c.metodo === 'DEBITO' ? 'Débito' : 'Crédito'
    const cuotasLabel = c.metodo === 'CREDITO' && Number(c.cuotas) > 1 ? ` (${c.cuotas} cuotas)` : ' (1 pago)'
    const montoLabel = formatearARS(Number(c.monto) || 0)
    return `Tarjeta ${index + 1}: ${metodoLabel} **** ${ultimos4} - ${montoLabel}${cuotasLabel}`
  })
  return `COMBINADO: ${parts.join(' · ')}`
}

function sanitizarMonto(value) {
  if (value === null || value === undefined) return ''
  let str = String(value).trim()

  // Si tiene formato de moneda con separador de miles y decimales
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.')
    const lastComma = str.lastIndexOf(',')
    if (lastDot < lastComma) {
      // Formato es-AR (12.500,50): punto es miles, coma es decimal
      str = str.replace(/\./g, '').replace(/,/g, '.')
    } else {
      // Formato en-US (12,500.50): coma es miles, punto es decimal
      str = str.replace(/,/g, '')
    }
  } else {
    // Si solo tiene comas, verificar si es múltiple (miles: 1,000,000) o única (decimal: 100,50)
    const commaCount = (str.match(/,/g) || []).length
    if (commaCount > 1) {
      str = str.replace(/,/g, '')
    } else if (commaCount === 1) {
      str = str.replace(/,/g, '.')
    }

    // Si tiene múltiples puntos sin comas, son separadores de miles (ej. 1.000.000 o 9.999.999.999.999.875.000)
    const dotCount = (str.match(/\./g) || []).length
    if (dotCount > 1) {
      if (/^\$?\s*\d{1,3}(\.\d{3})+$/.test(str) || (dotCount >= 2 && !str.includes(','))) {
        if (/^\$?\s*\d{1,3}(\.\d{3})+$/.test(str)) {
          str = str.replace(/\./g, '')
        }
      }
    }
  }

  // Eliminar cualquier caracter que no sea dígito o punto (descarta signos negativos, letras, etc.)
  str = str.replace(/[^\d.]/g, '')

  if (!str) return ''

  // Si comienza con punto decimal, anteponer 0: ej. ".5" -> "0.5"
  if (str.startsWith('.')) {
    str = '0' + str
  }

  const partes = str.split('.')
  let entero = partes[0]

  // Normalizar ceros a la izquierda múltiples: ej. "00" -> "0", "05" -> "5"
  if (entero.length > 1 && entero.startsWith('0')) {
    entero = entero.replace(/^0+/, '') || '0'
  }

  // Evitar que números gigantes desborden la precisión numérica
  if (entero.length > 12) {
    entero = entero.slice(0, 12)
  }

  if (partes.length > 1) {
    // Mantener hasta 2 decimales y descartar puntos extra
    const decimales = partes.slice(1).join('').slice(0, 2)
    return `${entero}.${decimales}`
  }

  return entero
}

function calcularMaximoTarjeta(index, tarjetas, total) {
  if (!Array.isArray(tarjetas) || !Number.isFinite(total)) return 0
  const sumaOtras = tarjetas.reduce((acc, t, i) => {
    if (i === index) return acc
    const val = Number(t?.monto)
    return acc + (Number.isFinite(val) && val > 0 ? val : 0)
  }, 0)
  const restante = total - sumaOtras
  return Math.max(0, Math.round(restante * 100) / 100)
}

function snapMontoTarjeta(index, montoRaw, tarjetas, total) {
  const sanitizado = sanitizarMonto(montoRaw)
  if (sanitizado === '') return ''

  const maxPermitido = calcularMaximoTarjeta(index, tarjetas, total)

  if (sanitizado.endsWith('.')) {
    const enteroNum = Number(sanitizado.slice(0, -1))
    if (Number.isFinite(enteroNum) && enteroNum > maxPermitido) {
      return Number.isInteger(maxPermitido)
        ? String(maxPermitido)
        : String(Math.round(maxPermitido * 100) / 100)
    }
    return sanitizado
  }

  const montoNum = Number(sanitizado)
  if (Number.isFinite(montoNum) && montoNum > maxPermitido) {
    return Number.isInteger(maxPermitido)
      ? String(maxPermitido)
      : String(Math.round(maxPermitido * 100) / 100)
  }

  return sanitizado
}

module.exports = {
  MINUTOS_EXPIRACION_RESERVA,
  calcularMaximoTarjeta,
  calcularSegundosRestantes,
  calculateInstallmentAmount,
  calculatePaymentTotal,
  esReservaExpirada,
  formatCombinedPaymentSummary,
  formatearARS,
  formatearSegundosMMSS,
  normalizarNumeroTarjeta,
  normalizarVencimiento,
  sanitizarMonto,
  snapMontoTarjeta,
  validateCardDetails,
  validateMultiCardAmounts,
  validarLuhn,
}