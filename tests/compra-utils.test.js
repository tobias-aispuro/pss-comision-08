const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PASAJES_MAX,
  validarCantidad,
  validarPasajero,
  validarPasajeros,
  validarSalida,
  asientosDisponibles,
  calcularEdad,
} = require('../lib/compra-utils');

const HOY = '2026-10-07';

function pasajeroBase(extra = {}) {
  return {
    dni: '40123456',
    nombre: 'Ana Pérez',
    edad: '34',
    telefono: '+54 11 5555-1234',
    ...extra,
  };
}

function vueloBase(extra = {}) {
  return {
    activo: true,
    diasOperacion: ['LUN', 'MIÉ', 'VIE'],
    periodoDesde: '2026-10',
    periodoHasta: '2026-12',
    capacidadEconomy: 100,
    capacidadPrimera: null,
    ...extra,
  };
}

test('validarCantidad acepta entre 1 y 9 pasajes', () => {
  assert.deepEqual(validarCantidad('1'), { ok: true, valor: 1 });
  assert.deepEqual(validarCantidad('9'), { ok: true, valor: 9 });
  assert.deepEqual(validarCantidad(3), { ok: true, valor: 3 });
});

test('validarCantidad rechaza mas de 9 pasajes en una misma transaccion', () => {
  const resultado = validarCantidad('10');

  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /más de 9 pasajes/);
  assert.equal(PASAJES_MAX, 9);
});

test('validarCantidad rechaza cero, negativos, decimales y texto', () => {
  for (const valor of ['0', '-1', '2.5', 'dos', '', undefined]) {
    assert.equal(validarCantidad(valor).ok, false, `debería rechazar ${valor}`);
  }
});

test('validarCantidad no permite superar los asientos disponibles', () => {
  assert.match(validarCantidad('3', 2).error, /Solo quedan 2 asientos/);
  assert.match(validarCantidad('1', 0).error, /No quedan asientos/);
  assert.deepEqual(validarCantidad('2', 2), { ok: true, valor: 2 });
});

test('validarPasajero devuelve los datos normalizados', () => {
  const resultado = validarPasajero(pasajeroBase({ nombre: '  Ana   Pérez ', dni: ' 40123456 ' }));

  assert.deepEqual(resultado, {
    ok: true,
    valores: { dni: '40123456', nombre: 'Ana Pérez', edad: 34, telefono: '+54 11 5555-1234' },
  });
});

test('validarPasajero marca cada campo obligatorio vacio', () => {
  const resultado = validarPasajero({ dni: '', nombre: ' ', edad: '', telefono: '' });

  assert.equal(resultado.ok, false);
  assert.deepEqual(Object.keys(resultado.errores).sort(), ['dni', 'edad', 'nombre', 'telefono']);
});

test('validarPasajero valida el formato del DNI', () => {
  for (const dni of ['123456', '123456789', '40.123.456', 'AB123456']) {
    assert.ok(validarPasajero(pasajeroBase({ dni })).errores?.dni, `debería rechazar ${dni}`);
  }
  assert.equal(validarPasajero(pasajeroBase({ dni: '1234567' })).ok, true);
});

test('validarPasajero valida la edad', () => {
  assert.equal(validarPasajero(pasajeroBase({ edad: '0' })).ok, true);
  assert.equal(validarPasajero(pasajeroBase({ edad: '120' })).ok, true);
  for (const edad of ['121', '-3', '4.5', 'diez']) {
    assert.ok(validarPasajero(pasajeroBase({ edad })).errores?.edad, `debería rechazar ${edad}`);
  }
});

test('validarPasajero valida el telefono', () => {
  assert.equal(validarPasajero(pasajeroBase({ telefono: '1155551234' })).ok, true);
  for (const telefono of ['1234567', '1234567890123456', 'llamame']) {
    assert.ok(validarPasajero(pasajeroBase({ telefono })).errores?.telefono, `debería rechazar ${telefono}`);
  }
});

test('validarPasajeros devuelve los errores en la posicion de cada pasajero', () => {
  const resultado = validarPasajeros([pasajeroBase(), pasajeroBase({ dni: '30111222', telefono: '' })]);

  assert.equal(resultado.ok, false);
  assert.deepEqual(resultado.errores[0], {});
  assert.deepEqual(Object.keys(resultado.errores[1]), ['telefono']);
});

test('validarPasajeros no permite repetir un DNI en la misma compra', () => {
  const resultado = validarPasajeros([pasajeroBase(), pasajeroBase({ nombre: 'Juan Pérez' })]);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errores[1].dni, /pasajero 1/);
});

test('validarPasajeros acepta a todos los pasajeros validos', () => {
  const resultado = validarPasajeros([pasajeroBase(), pasajeroBase({ dni: '30111222', edad: '8' })]);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.valores.length, 2);
  assert.equal(resultado.valores[1].edad, 8);
});

test('validarSalida acepta una salida programada', () => {
  // 2026-10-09 es viernes
  assert.equal(validarSalida(vueloBase(), '2026-10-09', 'ECONOMY', [], HOY), null);
});

test('validarSalida rechaza vuelo inexistente, clase invalida y fechas pasadas', () => {
  assert.match(validarSalida(null, '2026-10-09', 'ECONOMY', [], HOY), /no existe/);
  assert.match(validarSalida(vueloBase(), '2026-10-09', 'BUSINESS', [], HOY), /clase/);
  assert.match(validarSalida(vueloBase(), '2026-10-02', 'ECONOMY', [], HOY), /anterior a hoy/);
  assert.match(validarSalida(vueloBase(), '2026-02-30', 'ECONOMY', [], HOY), /no es válida/);
});

test('validarSalida rechaza dias sin operacion, fuera de periodo, inactivos y cancelados', () => {
  assert.match(validarSalida(vueloBase(), '2026-10-08', 'ECONOMY', [], HOY), /no opera/);
  assert.match(validarSalida(vueloBase(), '2027-01-01', 'ECONOMY', [], HOY), /no opera/);
  assert.match(validarSalida(vueloBase({ activo: false }), '2026-10-09', 'ECONOMY', [], HOY), /no opera/);
  assert.match(validarSalida(vueloBase(), '2026-10-09', 'ECONOMY', ['2026-10-09'], HOY), /cancelada/);
});

test('asientosDisponibles descuenta lo reservado y no baja de cero', () => {
  assert.equal(asientosDisponibles(vueloBase(), 'ECONOMY', 95), 5);
  assert.equal(asientosDisponibles(vueloBase(), 'ECONOMY', 120), 0);
});

test('asientosDisponibles devuelve null si la clase no tiene capacidad cargada', () => {
  assert.equal(asientosDisponibles(vueloBase(), 'PRIMERA', 3), null);
});

test('calcularEdad tiene en cuenta si ya cumplio años', () => {
  assert.equal(calcularEdad(new Date('1990-10-07T00:00:00Z'), HOY), 36);
  assert.equal(calcularEdad(new Date('1990-10-08T00:00:00Z'), HOY), 35);
});
