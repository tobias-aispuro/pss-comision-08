const test = require('node:test');
const assert = require('node:assert/strict');

const { parseFlightFormData } = require('../lib/flight-utils');

test('parseFlightFormData valida origen, destino, dias y horarios', () => {
  const formData = new Map([
    ['codigoVuelo', 'AR123'],
    ['origen', 'Buenos Aires'],
    ['destino', 'Córdoba'],
    ['diasOperacion', ['Lunes', 'Miércoles', 'Viernes']],
    ['horaSalida', '08:30'],
    ['horaLlegada', '09:45'],
    ['periodoDesde', '2026-06'],
    ['periodoHasta', '2026-09'],
    ['tipoAvion', 'Airbus A320'],
  ]);

  const result = parseFlightFormData(formData);

  assert.equal(result.codigoVuelo, 'AR123');
  assert.deepEqual(result.diasOperacion, ['Lunes', 'Miércoles', 'Viernes']);
  assert.equal(result.horaSalida, '08:30');
  assert.equal(result.horaLlegada, '09:45');
});

test('parseFlightFormData rechaza rango anual inválido', () => {
  const formData = new Map([
    ['codigoVuelo', 'AR124'],
    ['origen', 'Buenos Aires'],
    ['destino', 'Córdoba'],
    ['diasOperacion', ['Lunes']],
    ['horaSalida', '08:30'],
    ['horaLlegada', '09:45'],
    ['periodoDesde', '2026-09'],
    ['periodoHasta', '2026-06'],
    ['tipoAvion', 'Boeing 737'],
  ]);

  assert.throws(() => parseFlightFormData(formData), /Periodo anual inválido/);
});
