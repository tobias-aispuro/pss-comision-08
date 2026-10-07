const test = require('node:test');
const assert = require('node:assert/strict');

const { MOTIVO_MAX, fechasOperativas, validarCancelacion } = require('../lib/cancelacion-utils');

const HOY = '2026-10-07';

function vueloBase(extra = {}) {
  return {
    codigoVuelo: 'AR123',
    diasOperacion: ['MIÉ'],
    periodoDesde: '2026-10',
    periodoHasta: '2026-11',
    activo: true,
    ...extra,
  };
}

test('fechasOperativas lista solo los días de operación desde hoy hasta el fin del período', () => {
  assert.deepEqual(fechasOperativas(vueloBase(), HOY), [
    '2026-10-07',
    '2026-10-14',
    '2026-10-21',
    '2026-10-28',
    '2026-11-04',
    '2026-11-11',
    '2026-11-18',
    '2026-11-25',
  ]);
});

test('fechasOperativas arranca en el inicio del período si todavía no empezó', () => {
  const fechas = fechasOperativas(vueloBase({ periodoDesde: '2026-11' }), HOY);

  assert.equal(fechas[0], '2026-11-04');
  assert.equal(fechas.length, 4);
});

test('fechasOperativas excluye las salidas ya canceladas', () => {
  const fechas = fechasOperativas(vueloBase(), HOY, ['2026-10-14', '2026-11-25']);

  assert.ok(!fechas.includes('2026-10-14'));
  assert.ok(!fechas.includes('2026-11-25'));
  assert.equal(fechas.length, 6);
});

test('fechasOperativas devuelve vacío para vuelos inactivos o con período terminado', () => {
  assert.deepEqual(fechasOperativas(vueloBase({ activo: false }), HOY), []);
  assert.deepEqual(fechasOperativas(vueloBase({ periodoDesde: '2026-01', periodoHasta: '2026-09' }), HOY), []);
});

test('validarCancelacion acepta una salida futura válida y recorta el motivo', () => {
  const resultado = validarCancelacion({ fecha: '2026-11-04', motivo: '  Tormenta  ' }, vueloBase(), [], HOY);

  assert.deepEqual(resultado, { ok: true, valores: { fecha: '2026-11-04', motivo: 'Tormenta' } });
});

test('validarCancelacion permite cancelar la salida de hoy', () => {
  const resultado = validarCancelacion({ fecha: HOY, motivo: 'Mantenimiento' }, vueloBase(), [], HOY);

  assert.equal(resultado.ok, true);
});

test('validarCancelacion rechaza fechas faltantes, inválidas o pasadas', () => {
  const casos = [
    ['', 'Seleccioná la fecha de la salida a cancelar.'],
    ['2026-02-30', 'La fecha no es válida.'],
    ['2026-09-30', 'No se puede cancelar una salida anterior a hoy.'],
  ];

  for (const [fecha, mensaje] of casos) {
    const resultado = validarCancelacion({ fecha, motivo: 'Clima' }, vueloBase(), [], HOY);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.errores.fecha, mensaje);
  }
});

test('validarCancelacion rechaza fechas en las que el vuelo no opera', () => {
  const fueraDePeriodo = validarCancelacion({ fecha: '2026-12-02', motivo: 'Clima' }, vueloBase(), [], HOY);
  const otroDia = validarCancelacion({ fecha: '2026-11-05', motivo: 'Clima' }, vueloBase(), [], HOY);

  assert.equal(fueraDePeriodo.errores.fecha, 'La fecha está fuera del período de operación del vuelo.');
  assert.equal(otroDia.errores.fecha, 'El vuelo no opera ese día de la semana.');
});

test('validarCancelacion rechaza una salida ya cancelada y vuelos inactivos', () => {
  const repetida = validarCancelacion({ fecha: '2026-11-04', motivo: 'Clima' }, vueloBase(), ['2026-11-04'], HOY);
  const inactivo = validarCancelacion({ fecha: '2026-11-04', motivo: 'Clima' }, vueloBase({ activo: false }), [], HOY);

  assert.equal(repetida.errores.fecha, 'Esa salida ya fue cancelada.');
  assert.equal(inactivo.errores.fecha, 'El vuelo no está activo.');
});

test('validarCancelacion exige un motivo de hasta MOTIVO_MAX caracteres', () => {
  const vacio = validarCancelacion({ fecha: '2026-11-04', motivo: '   ' }, vueloBase(), [], HOY);
  const largo = validarCancelacion({ fecha: '2026-11-04', motivo: 'x'.repeat(MOTIVO_MAX + 1) }, vueloBase(), [], HOY);
  const limite = validarCancelacion({ fecha: '2026-11-04', motivo: 'x'.repeat(MOTIVO_MAX) }, vueloBase(), [], HOY);

  assert.equal(vacio.errores.motivo, 'Ingresá el motivo de la cancelación.');
  assert.equal(largo.errores.motivo, `El motivo no puede superar los ${MOTIVO_MAX} caracteres.`);
  assert.equal(limite.ok, true);
});
