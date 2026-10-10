function getStringValue(source, key) {
  const value = source instanceof Map ? source.get(key) : source.get?.(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getListValue(source, key) {
  if (source instanceof Map) {
    const value = source.get(key)
    if (Array.isArray(value)) {
      return value.filter(Boolean).map(String)
    }
    return value ? [String(value)] : []
  }

  if (typeof source.getAll === 'function') {
    return source.getAll(key).filter(Boolean).map(String)
  }

  return []
}

function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function getTodayISODate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type) => parts.find((entry) => entry.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** @param {Record<string, any>} values @param {string} [today] @returns {Record<string, string>} */
function validateFlightValues(values, today = getTodayISODate()) {
  /** @type {Record<string, string>} */
  const errors = {}

  for (const field of ['codigoVuelo', 'origen', 'destino', 'tipoAvion']) {
    if (!String(values[field] ?? '').trim()) {
      errors[field] = 'Este campo es obligatorio.'
    }
  }

  if (values.origen && values.destino && values.origen.trim().toLocaleLowerCase() === values.destino.trim().toLocaleLowerCase()) {
    errors.destino = 'El origen y el destino deben ser distintos.'
  }

  if (!Array.isArray(values.diasOperacion) || values.diasOperacion.length === 0) {
    errors.diasOperacion = 'Selecciona al menos un día de operación.'
  }

  if (!isISODate(values.periodoDesde ?? '')) {
    errors.periodoDesde = 'Ingresa una fecha de inicio válida.'
  } else if (values.periodoDesde < today) {
    errors.periodoDesde = 'La fecha de inicio no puede estar en el pasado.'
  }

  if (!isISODate(values.periodoHasta ?? '')) {
    errors.periodoHasta = 'Ingresa una fecha de fin válida.'
  } else if (isISODate(values.periodoDesde ?? '') && values.periodoHasta < values.periodoDesde) {
    errors.periodoHasta = 'La fecha de fin debe ser igual o posterior al inicio.'
  }

  const validTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value ?? '')
  if (!validTime(values.horaSalida)) {
    errors.horaSalida = 'Ingresa una hora de salida válida.'
  }

  if (!validTime(values.horaLlegada)) {
    errors.horaLlegada = 'Ingresa una hora de llegada válida.'
  } else if (validTime(values.horaSalida) && values.horaLlegada <= values.horaSalida) {
    errors.horaLlegada = 'La llegada debe ser posterior a la salida.'
  }

  return errors
}

/** @param {FormData} formData */
function getFlightValues(formData) {
  return {
    codigoVuelo: getStringValue(formData, 'codigoVuelo').toUpperCase(),
    origen: getStringValue(formData, 'origen'),
    destino: getStringValue(formData, 'destino'),
    diasOperacion: getListValue(formData, 'diasOperacion'),
    horaSalida: getStringValue(formData, 'horaSalida'),
    horaLlegada: getStringValue(formData, 'horaLlegada'),
    periodoDesde: getStringValue(formData, 'periodoDesde'),
    periodoHasta: getStringValue(formData, 'periodoHasta'),
    tipoAvion: getStringValue(formData, 'tipoAvion'),
  }
}

function parseFlightFormData(formData, today) {
  const values = getFlightValues(formData)
  const errors = validateFlightValues(values, today)
  const firstError = Object.values(errors)[0]

  if (firstError) {
    throw new Error(firstError)
  }

  return values
}

module.exports = { getFlightValues, getTodayISODate, parseFlightFormData, validateFlightValues }
