const {
  ASIENTOS_MIN,
  ASIENTOS_MAX,
  esFechaValida,
  diaDeSemana,
  mesDeFecha,
  fechaDeHoy,
} = require('./search-utils')

const PASAJES_MIN = ASIENTOS_MIN
const PASAJES_MAX = ASIENTOS_MAX
const EDAD_MAX = 120
const NOMBRE_MAX = 80
const CAMPOS_PASAJERO = ['dni', 'nombre', 'edad', 'telefono']

const CLASES_PASAJE = {
  ECONOMY: { nombre: 'Economy', precio: 'precioEconomy', capacidad: 'capacidadEconomy' },
  PRIMERA: { nombre: 'Primera', precio: 'precioPrimera', capacidad: 'capacidadPrimera' },
}

function leerTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Valida la cantidad de pasajes de una misma transacción (entre 1 y 9, o menos si quedan menos asientos).
 * @param {string | number | undefined} valor
 * @param {number | null} [disponibles] null = sin límite de capacidad
 * @returns {{ ok: true, valor: number } | { ok: false, error: string }}
 */
function validarCantidad(valor, disponibles = null) {
  const texto = leerTexto(typeof valor === 'number' ? String(valor) : valor)
  const cantidad = Number(texto)

  if (!/^\d+$/.test(texto) || cantidad < PASAJES_MIN) {
    return { ok: false, error: `Seleccioná entre ${PASAJES_MIN} y ${PASAJES_MAX} pasajes.` }
  }

  if (cantidad > PASAJES_MAX) {
    return { ok: false, error: `No se pueden comprar más de ${PASAJES_MAX} pasajes en una misma transacción.` }
  }

  if (disponibles !== null && cantidad > disponibles) {
    return {
      ok: false,
      error:
        disponibles === 0
          ? 'No quedan asientos disponibles en esta clase.'
          : `Solo quedan ${disponibles} ${disponibles === 1 ? 'asiento disponible' : 'asientos disponibles'} en esta clase.`,
    }
  }

  return { ok: true, valor: cantidad }
}

/**
 * Valida los datos personales de un pasajero. Devuelve un error por campo.
 * @returns {{ ok: true, valores: { dni: string, nombre: string, edad: number, telefono: string } } | { ok: false, errores: Record<string, string> }}
 */
function validarPasajero(datos) {
  const errores = {}

  const dni = leerTexto(datos.dni)
  const nombre = leerTexto(datos.nombre).replace(/\s+/g, ' ')
  const edadTexto = leerTexto(typeof datos.edad === 'number' ? String(datos.edad) : datos.edad)
  const telefono = leerTexto(datos.telefono)
  const edad = Number(edadTexto)
  const digitosTelefono = telefono.replace(/\D/g, '')

  if (!dni) {
    errores.dni = 'Ingresá el DNI.'
  } else if (!/^\d{7,8}$/.test(dni)) {
    errores.dni = 'El DNI debe tener 7 u 8 números, sin puntos ni letras.'
  }

  if (!nombre) {
    errores.nombre = 'Ingresá el nombre.'
  } else if (nombre.length > NOMBRE_MAX) {
    errores.nombre = `El nombre no puede superar los ${NOMBRE_MAX} caracteres.`
  }

  if (!edadTexto) {
    errores.edad = 'Ingresá la edad.'
  } else if (!/^\d+$/.test(edadTexto) || edad > EDAD_MAX) {
    errores.edad = `La edad debe ser un número entre 0 y ${EDAD_MAX}.`
  }

  if (!telefono) {
    errores.telefono = 'Ingresá el teléfono.'
  } else if (!/^\+?[\d\s()-]+$/.test(telefono) || digitosTelefono.length < 8 || digitosTelefono.length > 15) {
    errores.telefono = 'El teléfono debe tener entre 8 y 15 números.'
  }

  if (Object.keys(errores).length > 0) {
    return { ok: false, errores }
  }

  return { ok: true, valores: { dni, nombre, edad, telefono } }
}

/**
 * Valida a todos los pasajeros de la transacción y que no se repita un DNI.
 * `errores` tiene una entrada por pasajero, en el mismo orden (vacía si está bien).
 * @returns {{ ok: true, valores: Array<{ dni: string, nombre: string, edad: number, telefono: string }> } | { ok: false, errores: Array<Record<string, string>> }}
 */
function validarPasajeros(pasajeros) {
  const errores = pasajeros.map(() => ({}))
  const valores = []
  const vistos = new Map()

  pasajeros.forEach((datos, i) => {
    const validacion = validarPasajero(datos)

    if (!validacion.ok) {
      errores[i] = validacion.errores
      return
    }

    const { dni } = validacion.valores
    if (vistos.has(dni)) {
      errores[i].dni = `Este DNI ya fue ingresado para el pasajero ${vistos.get(dni) + 1}.`
      return
    }

    vistos.set(dni, i)
    valores.push(validacion.valores)
  })

  if (errores.some((e) => Object.keys(e).length > 0)) {
    return { ok: false, errores }
  }

  return { ok: true, valores }
}

/**
 * Valida la salida elegida en la búsqueda (vuelo + fecha + clase). Devuelve un mensaje de error o null.
 */
function validarSalida(vuelo, fecha, clase, canceladas = [], hoy = fechaDeHoy()) {
  if (!vuelo) {
    return 'El vuelo seleccionado no existe.'
  }

  if (!CLASES_PASAJE[clase]) {
    return 'La clase seleccionada no es válida.'
  }

  if (!esFechaValida(fecha)) {
    return 'La fecha del vuelo no es válida.'
  }

  if (fecha < hoy) {
    return 'No se pueden comprar pasajes para una fecha anterior a hoy.'
  }

  if (
    !vuelo.activo ||
    mesDeFecha(fecha) < vuelo.periodoDesde ||
    mesDeFecha(fecha) > vuelo.periodoHasta ||
    !vuelo.diasOperacion.includes(diaDeSemana(fecha))
  ) {
    return 'El vuelo no opera en la fecha seleccionada.'
  }

  if (canceladas.includes(fecha)) {
    return 'La salida de este vuelo para esa fecha fue cancelada.'
  }

  return null
}

// Asientos libres de una clase. null = el vuelo no tiene capacidad cargada (sin límite).
function asientosDisponibles(vuelo, clase, reservados) {
  const capacidad = vuelo[CLASES_PASAJE[clase].capacidad]

  if (capacidad === null || capacidad === undefined) {
    return null
  }

  return Math.max(capacidad - reservados, 0)
}

function calcularEdad(fechaNacimiento, hoy = fechaDeHoy()) {
  const nacimiento = new Date(fechaNacimiento).toISOString().slice(0, 10)
  const [anioN, mesN, diaN] = nacimiento.split('-').map(Number)
  const [anio, mes, dia] = hoy.split('-').map(Number)
  const cumplioEsteAnio = mes > mesN || (mes === mesN && dia >= diaN)

  return anio - anioN - (cumplioEsteAnio ? 0 : 1)
}

module.exports = {
  PASAJES_MIN,
  PASAJES_MAX,
  EDAD_MAX,
  NOMBRE_MAX,
  CAMPOS_PASAJERO,
  CLASES_PASAJE,
  validarCantidad,
  validarPasajero,
  validarPasajeros,
  validarSalida,
  asientosDisponibles,
  calcularEdad,
}
