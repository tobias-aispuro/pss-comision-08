/* eslint-disable @typescript-eslint/no-require-imports -- Tests ejecutados directamente con node --test. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pasajerosActivos,
  evaluarReubicable,
  validarAlternativa,
  ESTADO_TRAS_REUBICACION,
} = require('../lib/reubicacion-utils');

const MS_HORA = 60 * 60 * 1000;
// 2026-11-20 (viernes) 12:00 en Buenos Aires (UTC-3)
const AHORA = Date.UTC(2026, 10, 20, 15, 0);

const RESERVA_AFECTADA = {
  estado: 'CANCELADA',
  canceladaPorVuelo: true,
  pagadoAt: new Date(AHORA - 48 * MS_HORA),
};

const PASAJEROS = [
  { id: 'p1', canceladoAt: null },
  { id: 'p2', canceladoAt: null },
];

function vuelo(extra = {}) {
  return {
    id: 'v2',
    origen: 'Buenos Aires',
    destino: 'Cordoba',
    horaSalida: '07:00',
    zonaOrigen: 'America/Argentina/Buenos_Aires',
    activo: true,
    periodoDesde: '2026-01',
    periodoHasta: '2027-12',
    diasOperacion: ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'],
    capacidadEconomy: 10,
    capacidadPrimera: 2,
    ...extra,
  };
}

function caso(extra = {}) {
  return {
    reserva: { vueloId: 'v1', fecha: '2026-11-23', clase: 'ECONOMY' },
    vueloOriginal: { origen: 'Buenos Aires', destino: 'Cordoba' },
    alternativa: vuelo(),
    // lunes 23/11
    fecha: '2026-11-23',
    canceladas: [],
    reservados: 0,
    cantidad: 2,
    ...extra,
  };
}

test('pasajerosActivos deja afuera los pasajes cancelados', () => {
  const pasajeros = [...PASAJEROS, { id: 'p3', canceladoAt: new Date() }];
  assert.deepEqual(pasajerosActivos(pasajeros).map((p) => p.id), ['p1', 'p2']);
});

test('una reserva cancelada por el vuelo, paga y con pasajeros es reubicable', () => {
  assert.equal(evaluarReubicable(RESERVA_AFECTADA, PASAJEROS).ok, true);
});

test('no se reubica una reserva cancelada por el propio pasajero', () => {
  const resultado = evaluarReubicable({ ...RESERVA_AFECTADA, canceladaPorVuelo: false }, PASAJEROS);
  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo, /cancelación de un vuelo/);
});

test('no se reubica una reserva activa', () => {
  assert.equal(evaluarReubicable({ ...RESERVA_AFECTADA, estado: 'CONFIRMADA' }, PASAJEROS).ok, false);
});

test('no se reubica una reserva que no estaba paga', () => {
  const resultado = evaluarReubicable({ ...RESERVA_AFECTADA, pagadoAt: null }, PASAJEROS);
  assert.match(resultado.motivo, /no estaba paga/);
});

test('no se reubica una reserva sin pasajeros activos', () => {
  const resultado = evaluarReubicable(RESERVA_AFECTADA, [{ id: 'p1', canceladoAt: new Date() }]);
  assert.match(resultado.motivo, /pasajeros activos/);
});

test('acepta una alternativa de la misma ruta con lugar', () => {
  const resultado = validarAlternativa(caso(), AHORA);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.disponibles, 10);
});

test('acepta otra fecha del mismo vuelo', () => {
  const resultado = validarAlternativa(caso({ alternativa: vuelo({ id: 'v1' }), fecha: '2026-11-24' }), AHORA);
  assert.equal(resultado.ok, true);
});

test('rechaza la misma salida que fue cancelada', () => {
  const resultado = validarAlternativa(caso({ alternativa: vuelo({ id: 'v1' }) }), AHORA);
  assert.match(resultado.motivo, /fue cancelada/);
});

test('rechaza un vuelo de otra ruta', () => {
  const resultado = validarAlternativa(caso({ alternativa: vuelo({ destino: 'Mendoza' }) }), AHORA);
  assert.match(resultado.motivo, /misma ruta/);
});

test('rechaza una fecha en la que la alternativa fue cancelada', () => {
  const resultado = validarAlternativa(caso({ canceladas: ['2026-11-23'] }), AHORA);
  assert.match(resultado.motivo, /cancelada/);
});

test('rechaza un dia en el que el vuelo no opera', () => {
  // 22/11 es domingo
  const resultado = validarAlternativa(caso({ fecha: '2026-11-22' }), AHORA);
  assert.match(resultado.motivo, /no opera/);
});

test('rechaza una fecha anterior a hoy', () => {
  const resultado = validarAlternativa(caso({ fecha: '2026-11-19' }), AHORA);
  assert.match(resultado.motivo, /a partir de hoy/);
});

test('rechaza un vuelo de hoy que ya despego', () => {
  // Hoy (viernes 20/11) a las 07:00 ya pasó: son las 12:00
  const resultado = validarAlternativa(caso({ fecha: '2026-11-20' }), AHORA);
  assert.match(resultado.motivo, /ya despegó/);
});

test('rechaza un vuelo sin disponibilidad para todos los pasajeros', () => {
  const resultado = validarAlternativa(caso({ reservados: 9 }), AHORA);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.sinLugar, true);
  assert.match(resultado.motivo, /No es posible completar la reubicación/);
  assert.match(resultado.motivo, /2 pasajeros/);
});

test('acepta cuando los lugares alcanzan justo', () => {
  assert.equal(validarAlternativa(caso({ reservados: 8 }), AHORA).ok, true);
});

test('controla la disponibilidad en la clase de la reserva', () => {
  const primera = caso({ reserva: { vueloId: 'v1', fecha: '2026-11-23', clase: 'PRIMERA' }, cantidad: 3 });
  assert.equal(validarAlternativa(primera, AHORA).sinLugar, true);
});

test('un vuelo sin capacidad cargada no tiene limite de lugares', () => {
  const resultado = validarAlternativa(caso({ alternativa: vuelo({ capacidadEconomy: null }), reservados: 500 }), AHORA);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.disponibles, null);
});

test('una alternativa inexistente se rechaza', () => {
  assert.match(validarAlternativa(caso({ alternativa: null }), AHORA).motivo, /no existe/);
});

test('la reserva reubicada queda confirmada', () => {
  assert.equal(ESTADO_TRAS_REUBICACION, 'CONFIRMADA');
});
