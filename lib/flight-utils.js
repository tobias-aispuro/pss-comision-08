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

function parseFlightFormData(formData) {
  const codigoVuelo = getStringValue(formData, 'codigoVuelo')
  const origen = getStringValue(formData, 'origen')
  const destino = getStringValue(formData, 'destino')
  const horaSalida = getStringValue(formData, 'horaSalida')
  const horaLlegada = getStringValue(formData, 'horaLlegada')
  const periodoDesde = getStringValue(formData, 'periodoDesde')
  const periodoHasta = getStringValue(formData, 'periodoHasta')
  const tipoAvion = getStringValue(formData, 'tipoAvion')
  const diasOperacion = getListValue(formData, 'diasOperacion')

  if (!codigoVuelo || !origen || !destino || !horaSalida || !horaLlegada || !periodoDesde || !periodoHasta || !tipoAvion) {
    throw new Error('Todos los campos del formulario son obligatorios.')
  }

  if (origen === destino) {
    throw new Error('El origen y el destino deben ser distintos.')
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(horaSalida) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(horaLlegada)) {
    throw new Error('Los horarios de salida y llegada deben tener formato HH:MM.')
  }

  const salidaMinutos = Number(horaSalida.split(':')[0]) * 60 + Number(horaSalida.split(':')[1])
  const llegadaMinutos = Number(horaLlegada.split(':')[0]) * 60 + Number(horaLlegada.split(':')[1])

  if (llegadaMinutos <= salidaMinutos) {
    throw new Error('La hora de llegada debe ser posterior a la hora de salida.')
  }

  if (diasOperacion.length === 0) {
    throw new Error('Debes seleccionar al menos un día de operación.')
  }

  const desdeMes = Number(periodoDesde.slice(5, 7))
  const hastaMes = Number(periodoHasta.slice(5, 7))

  if (
    Number(periodoDesde.slice(0, 4)) > Number(periodoHasta.slice(0, 4)) ||
    (Number(periodoDesde.slice(0, 4)) === Number(periodoHasta.slice(0, 4)) && desdeMes > hastaMes)
  ) {
    throw new Error('Periodo anual inválido. La fecha final debe ser posterior o igual a la inicial.')
  }

  return {
    codigoVuelo,
    origen,
    destino,
    diasOperacion,
    horaSalida,
    horaLlegada,
    periodoDesde,
    periodoHasta,
    tipoAvion,
  }
}

module.exports = { parseFlightFormData }
