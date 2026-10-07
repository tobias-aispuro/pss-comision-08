const test = require('node:test');
const assert = require('node:assert/strict');

const {
  esFechaValida,
  diaDeSemana,
  mesDeFecha,
  validarBusqueda,
  construirFiltroTramo,
} = require('../lib/search-utils');

const HOY = '2026-10-07';

function busquedaBase(extra = {}) {
  return {
    origen: 'Buenos Aires',
    destino: 'C\u00F3rdoba',
    tipoTramo: 'IDA_VUELTA',
    fechaIda: '2026-11-20',
    fechaRegreso: '2026-11-27',
    asientos: '2',
    ...extra,
  };
}

test('diaDeSemana devuelve el formato que guarda el formulario de US-01', () => {
  assert.equal(diaDeSemana('2026-10-05'), 'LUN');
  assert.equal(diaDeSemana('2026-10-07'), 'MI\u00C9');
  assert.equal(diaDeSemana('2026-10-10'), 'S\u00C1B');
  assert.equal(diaDeSemana('2026-10-11'), 'DOM');
  assert.equal(diaDeSemana('2026-11-20'), 'VIE');
});

test('esFechaValida rechaza formatos y fechas inexistentes', () => {
  assert.equal(esFechaValida('2026-02-28'), true);
  assert.equal(esFechaValida('2026-02-30'), false);
  assert.equal(esFechaValida('20-11-2026'), false);
  assert.equal(esFechaValida(''), false);
  assert.equal(esFechaValida(undefined), false);
});

test('mesDeFecha devuelve AAAA-MM', () => {
  assert.equal(mesDeFecha('2026-11-20'), '2026-11');
});

test('validarBusqueda acepta una b\u00FAsqueda de ida y vuelta completa', () => {
  const resultado = validarBusqueda(busquedaBase(), HOY);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.valores.asientos, 2);
  assert.equal(resultado.valores.fechaRegreso, '2026-11-27');
});

test('validarBusqueda de solo ida no exige ni conserva el regreso', () => {
  const resultado = validarBusqueda(busquedaBase({ tipoTramo: 'IDA', fechaRegreso: '' }), HOY);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.valores.fechaRegreso, null);
});

test('validarBusqueda informa cada campo obligatorio faltante', () => {
  const resultado = validarBusqueda({}, HOY);

  assert.equal(resultado.ok, false);
  assert.ok(resultado.errores.origen);
  assert.ok(resultado.errores.destino);
  assert.ok(resultado.errores.fechaIda);
  assert.ok(resultado.errores.fechaRegreso);
  assert.equal(resultado.errores.asientos, undefined);
});

test('validarBusqueda rechaza origen igual a destino', () => {
  const resultado = validarBusqueda(busquedaBase({ destino: 'Buenos Aires' }), HOY);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errores.destino, /distintos/);
});

test('validarBusqueda rechaza fechas pasadas y acepta la de hoy', () => {
  assert.match(validarBusqueda(busquedaBase({ fechaIda: '2026-10-06' }), HOY).errores.fechaIda, /anterior a hoy/);
  assert.equal(validarBusqueda(busquedaBase({ fechaIda: HOY, fechaRegreso: HOY }), HOY).ok, true);
});

test('validarBusqueda rechaza un regreso anterior a la ida', () => {
  const resultado = validarBusqueda(busquedaBase({ fechaRegreso: '2026-11-19' }), HOY);

  assert.equal(resultado.ok, false);
  assert.match(resultado.errores.fechaRegreso, /anterior a la de ida/);
});

test('validarBusqueda limita los asientos de 1 a 9', () => {
  for (const asientos of ['0', '10', '-1', '1.5', 'abc']) {
    assert.ok(validarBusqueda(busquedaBase({ asientos }), HOY).errores.asientos, `asientos=${asientos}`);
  }

  assert.equal(validarBusqueda(busquedaBase({ asientos: '9' }), HOY).ok, true);
  assert.equal(validarBusqueda(busquedaBase({ asientos: '' }), HOY).valores.asientos, 1);
});

test('validarBusqueda rechaza un tipo de tramo desconocido', () => {
  assert.ok(validarBusqueda(busquedaBase({ tipoTramo: 'MULTI' }), HOY).errores.tipoTramo);
});

test('construirFiltroTramo arma el filtro con ruta, d\u00EDa, per\u00EDodo, vuelo activo y sin salida cancelada', () => {
  assert.deepEqual(construirFiltroTramo('Buenos Aires', 'C\u00F3rdoba', '2026-11-20'), {
    origen: 'Buenos Aires',
    destino: 'C\u00F3rdoba',
    activo: true,
    diasOperacion: { has: 'VIE' },
    periodoDesde: { lte: '2026-11' },
    periodoHasta: { gte: '2026-11' },
    cancelaciones: { none: { fecha: '2026-11-20' } },
  });
});
