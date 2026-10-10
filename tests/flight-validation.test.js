const test = require('node:test');
const assert = require('node:assert/strict');

const { parseFlightFormData, validateFlightValues } = require('../lib/flight-utils');
const { isWorldCityLabel, searchWorldCities } = require('../lib/world-cities');

const validFlight = {
  codigoVuelo: 'AR123',
  origen: 'Buenos Aires, Argentina',
  destino: 'Córdoba, Argentina',
  diasOperacion: ['Lunes', 'Miércoles', 'Viernes'],
  horaSalida: '08:30',
  horaLlegada: '09:45',
  periodoDesde: '2026-10-10',
  periodoHasta: '2027-03-31',
  tipoAvion: 'Airbus A320',
};

test('parseFlightFormData valida origen, destino, dias y horarios', () => {
  const formData = new Map([
    ['codigoVuelo', 'AR123'],
    ['origen', 'Buenos Aires'],
    ['destino', 'Córdoba'],
    ['diasOperacion', ['Lunes', 'Miércoles', 'Viernes']],
    ['horaSalida', '08:30'],
    ['horaLlegada', '09:45'],
    ['periodoDesde', '2026-10-10'],
    ['periodoHasta', '2027-03-31'],
    ['tipoAvion', 'Airbus A320'],
  ]);

  const result = parseFlightFormData(formData);

  assert.equal(result.codigoVuelo, 'AR123');
  assert.deepEqual(result.diasOperacion, ['Lunes', 'Miércoles', 'Viernes']);
  assert.equal(result.horaSalida, '08:30');
  assert.equal(result.horaLlegada, '09:45');
});

test('validateFlightValues rechaza el inicio del periodo en una fecha pasada', () => {
  const result = validateFlightValues({ ...validFlight, periodoDesde: '2026-10-08' }, '2026-10-09');

  assert.equal(result.periodoDesde, 'La fecha de inicio no puede estar en el pasado.');
});

test('validateFlightValues rechaza un fin anterior al inicio del periodo', () => {
  const result = validateFlightValues({ ...validFlight, periodoHasta: '2026-10-09' }, '2026-10-09');

  assert.equal(result.periodoHasta, 'La fecha de fin debe ser igual o posterior al inicio.');
});

test('validateFlightValues rechaza llegada igual o anterior a la salida', () => {
  const result = validateFlightValues({ ...validFlight, horaLlegada: '08:30' }, '2026-10-09');

  assert.equal(result.horaLlegada, 'La llegada debe ser posterior a la salida.');
});

test('searchWorldCities devuelve sugerencias con país para ciudades globales', () => {
  const results = searchWorldCities('Buenos Air');

  assert.ok(results.some((city) => city.label.includes('Buenos Aires') && city.country === 'Argentina'));
  assert.ok(results.length <= 8);
});

test('isWorldCityLabel solo acepta una ciudad del catálogo', () => {
  const [suggestion] = searchWorldCities('Buenos Air');

  assert.equal(isWorldCityLabel(suggestion.label), true);
  assert.equal(isWorldCityLabel('Ciudad inventada'), false);
});
