const { esFechaValida, diaDeSemana, mesDeFecha, fechaDeHoy } = require('./search-utils')

const MOTIVO_MAX = 200
const MS_DIA = 24 * 60 * 60 * 1000
const FORMATO_PERIODO = /^\d{4}-\d{2}$/

function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia) + dias * MS_DIA).toISOString().slice(0, 10)
}

function ultimoDiaDelPeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number)
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
}

// Fechas (YYYY-MM-DD) en las que el vuelo sale, desde `desde` hasta el fin de su período,
// sin las salidas ya canceladas.
function fechasOperativas(vuelo, desde = fechaDeHoy(), canceladas = []) {
  if (!vuelo.activo || !FORMATO_PERIODO.test(vuelo.periodoDesde) || !FORMATO_PERIODO.test(vuelo.periodoHasta)) {
    return []
  }

  const inicioPeriodo = `${vuelo.periodoDesde}-01`
  const finPeriodo = ultimoDiaDelPeriodo(vuelo.periodoHasta)
  const excluidas = new Set(canceladas)
  const fechas = []

  for (let fecha = desde > inicioPeriodo ? desde : inicioPeriodo; fecha <= finPeriodo; fecha = sumarDias(fecha, 1)) {
    if (vuelo.diasOperacion.includes(diaDeSemana(fecha)) && !excluidas.has(fecha)) {
      fechas.push(fecha)
    }
  }

  return fechas
}

/**
 * @returns {{ ok: true, valores: { fecha: string, motivo: string } } | { ok: false, errores: Record<string, string> }}
 */
function validarCancelacion(datos, vuelo, canceladas = [], hoy = fechaDeHoy()) {
  const errores = {}

  const fecha = typeof datos.fecha === 'string' ? datos.fecha.trim() : ''
  const motivo = typeof datos.motivo === 'string' ? datos.motivo.trim() : ''

  if (!vuelo.activo) {
    errores.fecha = 'El vuelo no está activo.'
  } else if (!fecha) {
    errores.fecha = 'Seleccioná la fecha de la salida a cancelar.'
  } else if (!esFechaValida(fecha)) {
    errores.fecha = 'La fecha no es válida.'
  } else if (fecha < hoy) {
    errores.fecha = 'No se puede cancelar una salida anterior a hoy.'
  } else if (mesDeFecha(fecha) < vuelo.periodoDesde || mesDeFecha(fecha) > vuelo.periodoHasta) {
    errores.fecha = 'La fecha está fuera del período de operación del vuelo.'
  } else if (!vuelo.diasOperacion.includes(diaDeSemana(fecha))) {
    errores.fecha = 'El vuelo no opera ese día de la semana.'
  } else if (canceladas.includes(fecha)) {
    errores.fecha = 'Esa salida ya fue cancelada.'
  }

  if (!motivo) {
    errores.motivo = 'Ingresá el motivo de la cancelación.'
  } else if (motivo.length > MOTIVO_MAX) {
    errores.motivo = `El motivo no puede superar los ${MOTIVO_MAX} caracteres.`
  }

  if (Object.keys(errores).length > 0) {
    return { ok: false, errores }
  }

  return { ok: true, valores: { fecha, motivo } }
}

module.exports = {
  MOTIVO_MAX,
  fechasOperativas,
  validarCancelacion,
}
