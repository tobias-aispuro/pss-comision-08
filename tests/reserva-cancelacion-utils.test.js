const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HORAS_LIMITE_CANCELACION,
  instanteDespegue,
  limiteCancelacion,
  evaluarCancelacion,
  HORAS_VISIBLE_CANCELADA,
  visibleEnMisReservas,
} = require('../lib/reserva-cancelacion-utils');

const MS_HORA = 60 * 60 * 1000;

function vueloBase(extra = {}) {
  return {
    horaSalida: '10:00',
    zonaOrigen: 'America/Argentina/Buenos_Aires',
    ...extra,
  };
}

function caso(extra = {}) {
  return {
    reserva: { fecha: '2026-11-20', estado: 'PENDIENTE' },
    vuelo: vueloBase(),
    ...extra,
  };
}

// 2026-11-20 10:00 en Buenos Aires (UTC-3) = 13:00 UTC
const DESPEGUE = Date.UTC(2026, 10, 20, 13, 0);

test('instanteDespegue usa el huso del aeropuerto de origen', () => {
  assert.equal(instanteDespegue(vueloBase(), '2026-11-20'), DESPEGUE);
  // Madrid en noviembre es UTC+1: 10:00 local = 09:00 UTC
  assert.equal(
    instanteDespegue(vueloBase({ zonaOrigen: 'Europe/Madrid' }), '2026-11-20'),
    Date.UTC(2026, 10, 20, 9, 0)
  );
});

test('instanteDespegue usa Buenos Aires si el vuelo no tiene huso cargado', () => {
  assert.equal(instanteDespegue(vueloBase({ zonaOrigen: null }), '2026-11-20'), DESPEGUE);
});

test('el limite de cancelacion es 48 horas antes del despegue', () => {
  assert.equal(HORAS_LIMITE_CANCELACION, 48);
  assert.equal(limiteCancelacion(vueloBase(), '2026-11-20'), DESPEGUE - 48 * MS_HORA);
});

test('permite cancelar con mas de 48 horas de anticipacion y devuelve el limite', () => {
  const resultado = evaluarCancelacion(caso(), DESPEGUE - 72 * MS_HORA);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.limite, DESPEGUE - 48 * MS_HORA);
});

test('permite cancelar justo a 48 horas del despegue', () => {
  assert.equal(evaluarCancelacion(caso(), DESPEGUE - 48 * MS_HORA).ok, true);
});

test('no permite cancelar con menos de 48 horas', () => {
  const resultado = evaluarCancelacion(caso(), DESPEGUE - 48 * MS_HORA + 60 * 1000);

  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo, /expiró el plazo/);
  assert.match(resultado.motivo, /48 horas/);
});

test('no permite cancelar un vuelo que ya despego', () => {
  assert.equal(evaluarCancelacion(caso(), DESPEGUE + MS_HORA).ok, false);
});

test('el plazo respeta el huso del origen', () => {
  // Madrid 10:00 = 09:00 UTC; a las 10:00 UTC de dos días antes faltan 47 hs
  const madrid = caso({ vuelo: vueloBase({ zonaOrigen: 'Europe/Madrid' }) });
  assert.equal(evaluarCancelacion(madrid, Date.UTC(2026, 10, 18, 10, 0)).ok, false);
  assert.equal(evaluarCancelacion(madrid, Date.UTC(2026, 10, 18, 9, 0)).ok, true);
});

test('no permite cancelar si la reserva ya esta cancelada', () => {
  const resultado = evaluarCancelacion(caso({ reserva: { fecha: '2026-11-20', estado: 'CANCELADA' } }), 0);
  assert.match(resultado.motivo, /está cancelada/);
});

test('informa un error si el horario del vuelo es invalido', () => {
  const resultado = evaluarCancelacion(caso({ vuelo: vueloBase({ horaSalida: 'xx' }) }), 0);
  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo, /horario/);
});

test('una reserva activa se muestra hasta el despegue del vuelo', () => {
  const datos = { reserva: { fecha: '2026-11-20', estado: 'PENDIENTE', updatedAt: new Date(0) }, vuelo: vueloBase() };

  // Dentro de las 48 hs ya no se puede cancelar, pero se sigue mostrando
  assert.equal(visibleEnMisReservas(datos, DESPEGUE - MS_HORA), true);
  assert.equal(visibleEnMisReservas(datos, DESPEGUE), false);
  assert.equal(visibleEnMisReservas(datos, DESPEGUE + MS_HORA), false);
});

test('una reserva cancelada se muestra hasta 1 hora despues de la cancelacion', () => {
  assert.equal(HORAS_VISIBLE_CANCELADA, 1);
  const cancelada = Date.UTC(2026, 10, 1, 12, 0);
  const datos = {
    reserva: { fecha: '2026-11-20', estado: 'CANCELADA', updatedAt: new Date(cancelada + 5 * 1000) },
    vuelo: vueloBase(),
    pasajeros: [{ canceladoAt: new Date(cancelada) }, { canceladoAt: new Date(cancelada) }],
  };

  assert.equal(visibleEnMisReservas(datos, cancelada + 59 * 60 * 1000), true);
  assert.equal(visibleEnMisReservas(datos, cancelada + MS_HORA), false);
});

test('si se cancelo sin marcar pasajeros (vuelo cancelado por el admin) se usa la ultima actualizacion', () => {
  const cancelada = Date.UTC(2026, 10, 1, 12, 0);
  const datos = {
    reserva: { fecha: '2026-11-20', estado: 'CANCELADA', updatedAt: new Date(cancelada) },
    vuelo: vueloBase(),
    pasajeros: [{ canceladoAt: null }],
  };

  assert.equal(visibleEnMisReservas(datos, cancelada + 30 * 60 * 1000), true);
  assert.equal(visibleEnMisReservas(datos, cancelada + 2 * MS_HORA), false);
});

test('una reserva activa con horario invalido se sigue mostrando', () => {
  const datos = { reserva: { fecha: '2026-11-20', estado: 'PENDIENTE', updatedAt: new Date(0) }, vuelo: vueloBase({ horaSalida: 'xx' }) };
  assert.equal(visibleEnMisReservas(datos, DESPEGUE + MS_HORA), true);
});
