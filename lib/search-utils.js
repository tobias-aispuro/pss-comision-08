const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MI\u00C9', 'JUE', 'VIE', 'S\u00C1B']

const TIPOS_TRAMO = ['IDA', 'IDA_VUELTA']
const ASIENTOS_MIN = 1
const ASIENTOS_MAX = 9
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false
  }

  const [anio, mes, dia] = fecha.split('-').map(Number)
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia))

  return (
    fechaUtc.getUTCFullYear() === anio &&
    fechaUtc.getUTCMonth() === mes - 1 &&
    fechaUtc.getUTCDate() === dia
  )
}

function diaDeSemana(fecha) {
  if (!esFechaValida(fecha)) {
    throw new Error('Fecha inv\u00E1lida.')
  }

  const [anio, mes, dia] = fecha.split('-').map(Number)
  return DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()]
}

function mesDeFecha(fecha) {
  if (!esFechaValida(fecha)) {
    throw new Error('Fecha inv\u00E1lida.')
  }

  return fecha.slice(0, 7)
}

function fechaDeHoy(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

function leerTexto(params, clave) {
  const valor = params[clave]
  return typeof valor === 'string' ? valor.trim() : ''
}

function validarBusqueda(params, hoy = fechaDeHoy()) {
  const errores = {}

  const origen = leerTexto(params, 'origen')
  const destino = leerTexto(params, 'destino')
  const tipoTramo = leerTexto(params, 'tipoTramo') || 'IDA_VUELTA'
  const fechaIda = leerTexto(params, 'fechaIda')
  const fechaRegreso = leerTexto(params, 'fechaRegreso')
  const asientosTexto = leerTexto(params, 'asientos') || '1'

  if (!origen) {
    errores.origen = 'Seleccion\u00E1 el origen.'
  }

  if (!destino) {
    errores.destino = 'Seleccion\u00E1 el destino.'
  }

  if (origen && destino && origen === destino) {
    errores.destino = 'El origen y el destino deben ser distintos.'
  }

  if (!TIPOS_TRAMO.includes(tipoTramo)) {
    errores.tipoTramo = 'El tipo de tramo debe ser solo ida o ida y vuelta.'
  }

  if (!fechaIda) {
    errores.fechaIda = 'Ingres\u00E1 la fecha de ida.'
  } else if (!esFechaValida(fechaIda)) {
    errores.fechaIda = 'La fecha de ida no es v\u00E1lida.'
  } else if (fechaIda < hoy) {
    errores.fechaIda = 'La fecha de ida no puede ser anterior a hoy.'
  }

  if (tipoTramo === 'IDA_VUELTA') {
    if (!fechaRegreso) {
      errores.fechaRegreso = 'Ingres\u00E1 la fecha de regreso.'
    } else if (!esFechaValida(fechaRegreso)) {
      errores.fechaRegreso = 'La fecha de regreso no es v\u00E1lida.'
    } else if (!errores.fechaIda && fechaRegreso < fechaIda) {
      errores.fechaRegreso = 'La fecha de regreso no puede ser anterior a la de ida.'
    }
  }

  const asientos = Number(asientosTexto)

  if (!/^\d+$/.test(asientosTexto) || asientos < ASIENTOS_MIN || asientos > ASIENTOS_MAX) {
    errores.asientos = `La cantidad de asientos debe ser un n\u00FAmero entre ${ASIENTOS_MIN} y ${ASIENTOS_MAX}.`
  }

  if (Object.keys(errores).length > 0) {
    return { ok: false, errores }
  }

  return {
    ok: true,
    valores: {
      origen,
      destino,
      tipoTramo,
      fechaIda,
      fechaRegreso: tipoTramo === 'IDA_VUELTA' ? fechaRegreso : null,
      asientos,
    },
  }
}

function construirFiltroTramo(origen, destino, fecha) {
  const mes = mesDeFecha(fecha)

  return {
    origen,
    destino,
    activo: true,
    diasOperacion: { has: diaDeSemana(fecha) },
    periodoDesde: { lte: mes },
    periodoHasta: { gte: mes },
  }
}

module.exports = {
  DIAS_SEMANA,
  TIPOS_TRAMO,
  ASIENTOS_MIN,
  ASIENTOS_MAX,
  esFechaValida,
  diaDeSemana,
  mesDeFecha,
  fechaDeHoy,
  validarBusqueda,
  construirFiltroTramo,
}
