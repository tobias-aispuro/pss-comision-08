const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HORAS_LIMITE_CANCELACION,
  instanteDespegue,
  limiteCancelacion,
  evaluarCancelacion,
} = require('../lib/reserva-cancelacion-utils');

const MS_HORA = 60 * 60 * 1000;
const DNI_TITULAR = '40123456';

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
    pasajeros: [
      { id: 'p1', dni: DNI_TITULAR, canceladoAt: null },
      { id: 'p2', dni: '30111222', canceladoAt: null },
    ],
    dniTitular: DNI_TITULAR,
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

test('permite cancelar con mas de 48 horas de anticipacion y devuelve el pasaje del titular', () => {
  const resultado = evaluarCancelacion(caso(), DESPEGUE - 72 * MS_HORA);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.pasajero.id, 'p1');
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

test('no permite cancelar si el titular no viaja en la reserva', () => {
  const resultado = evaluarCancelacion(caso({ dniTitular: '99999999' }), 0);
  assert.match(resultado.motivo, /no figura/);
});

test('no permite cancelar dos veces el mismo pasaje', () => {
  const pasajeros = [{ id: 'p1', dni: DNI_TITULAR, canceladoAt: new Date() }];
  const resultado = evaluarCancelacion(caso({ pasajeros }), 0);
  assert.match(resultado.motivo, /ya fue cancelado/);
});

test('informa un error si el horario del vuelo es invalido', () => {
  const resultado = evaluarCancelacion(caso({ vuelo: vueloBase({ horaSalida: 'xx' }) }), 0);
  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo, /horario/);
});
