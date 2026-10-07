const test = require('node:test');
const assert = require('node:assert/strict');

const { construirFiltroTramo } = require('../lib/search-utils');
const {
  calcularDuracionMinutos,
  formatearDuracion,
  prepararVuelo,
  buscarVuelosDirectos,
  obtenerOpcionesBusqueda,
} = require('../lib/vuelos-search');

function vueloBase(extra = {}) {
  return {
    codigoVuelo: 'SL1402',
    origen: 'Madrid',
    destino: 'Nueva York',
    horaSalida: '10:45',
    horaLlegada: '13:20',
    zonaOrigen: 'Europe/Madrid',
    zonaDestino: 'America/New_York',
    precioEconomy: 295,
    precioPrimera: 890,
    capacidadEconomy: 100,
    capacidadPrimera: 10,
    ...extra,
  };
}

function prismaFalso(respuestas) {
  const llamadas = [];
  return {
    llamadas,
    vuelo: {
      findMany: async (args) => {
        llamadas.push(args);
        return respuestas.shift() ?? [];
      },
    },
  };
}

test('calcularDuracionMinutos usa los husos de cada aeropuerto', () => {
  assert.equal(calcularDuracionMinutos(vueloBase(), '2026-11-20'), 515);
});

test('calcularDuracionMinutos suma un dia cuando la llegada es al dia siguiente', () => {
  const vuelo = vueloBase({
    origen: 'Buenos Aires',
    destino: 'Madrid',
    horaSalida: '22:00',
    horaLlegada: '14:00',
    zonaOrigen: 'America/Argentina/Buenos_Aires',
    zonaDestino: 'Europe/Madrid',
  });

  assert.equal(calcularDuracionMinutos(vuelo, '2026-11-20'), 12 * 60);
});

test('calcularDuracionMinutos devuelve null sin husos o con horas invalidas', () => {
  assert.equal(calcularDuracionMinutos(vueloBase({ zonaOrigen: null }), '2026-11-20'), null);
  assert.equal(calcularDuracionMinutos(vueloBase({ horaSalida: '10h45' }), '2026-11-20'), null);
  assert.equal(calcularDuracionMinutos(vueloBase({ zonaDestino: 'No/Existe' }), '2026-11-20'), null);
});

test('formatearDuracion devuelve el formato del wireframe', () => {
  assert.equal(formatearDuracion(515), '08h 35m');
  assert.equal(formatearDuracion(null), null);
});

test('prepararVuelo calcula el precio desde y la duracion', () => {
  const vuelo = prepararVuelo(vueloBase(), '2026-11-20');

  assert.equal(vuelo.precioDesde, 295);
  assert.equal(vuelo.duracion, '08h 35m');
  assert.deepEqual(vuelo.clasesDisponibles, ['ECONOMY', 'PRIMERA']);
});

test('prepararVuelo descarta clases sin cupo y vuelos sin ninguna clase disponible', () => {
  const sinPrimera = prepararVuelo(vueloBase({ capacidadPrimera: 1 }), '2026-11-20', { asientos: 2 });
  assert.deepEqual(sinPrimera.clasesDisponibles, ['ECONOMY']);

  const sinCupo = prepararVuelo(vueloBase({ capacidadEconomy: 1, capacidadPrimera: 1 }), '2026-11-20', { asientos: 2 });
  assert.equal(sinCupo, null);
});

test('prepararVuelo conserva los vuelos sin precio ni capacidad cargados', () => {
  const vuelo = prepararVuelo(
    vueloBase({ precioEconomy: null, precioPrimera: null, capacidadEconomy: null, capacidadPrimera: null, zonaOrigen: null }),
    '2026-11-20',
    { asientos: 9 }
  );

  assert.equal(vuelo.precioDesde, null);
  assert.equal(vuelo.duracion, null);
});

test('prepararVuelo respeta el precio maximo y el filtro de clase', () => {
  assert.equal(prepararVuelo(vueloBase(), '2026-11-20', { precioMax: 200 }), null);
  assert.equal(prepararVuelo(vueloBase(), '2026-11-20', { precioMax: 300 }).precioDesde, 295);
  assert.equal(prepararVuelo(vueloBase(), '2026-11-20', { clases: ['PRIMERA'] }).precioDesde, 890);
});

test('buscarVuelosDirectos de ida y vuelta consulta el tramo de regreso invertido', async () => {
  const prisma = prismaFalso([[vueloBase()], [vueloBase({ origen: 'Nueva York', destino: 'Madrid' })]]);
  const valores = {
    origen: 'Madrid',
    destino: 'Nueva York',
    tipoTramo: 'IDA_VUELTA',
    fechaIda: '2026-11-20',
    fechaRegreso: '2026-11-27',
    asientos: 1,
  };

  const resultado = await buscarVuelosDirectos(prisma, valores);

  assert.equal(prisma.llamadas.length, 2);
  assert.deepEqual(prisma.llamadas[0].where, construirFiltroTramo('Madrid', 'Nueva York', '2026-11-20'));
  assert.deepEqual(prisma.llamadas[1].where, construirFiltroTramo('Nueva York', 'Madrid', '2026-11-27'));
  assert.equal(resultado.ida.length, 1);
  assert.equal(resultado.vuelta.length, 1);
});

test('buscarVuelosDirectos de solo ida no consulta el regreso', async () => {
  const prisma = prismaFalso([[]]);
  const valores = {
    origen: 'Madrid',
    destino: 'Nueva York',
    tipoTramo: 'IDA',
    fechaIda: '2026-11-20',
    fechaRegreso: null,
    asientos: 1,
  };

  const resultado = await buscarVuelosDirectos(prisma, valores);

  assert.equal(prisma.llamadas.length, 1);
  assert.deepEqual(resultado, { ida: [], vuelta: [] });
});

test('buscarVuelosDirectos ordena por precio con los vuelos sin precio al final', async () => {
  const prisma = prismaFalso([[
    vueloBase({ codigoVuelo: 'A', precioEconomy: null, precioPrimera: null }),
    vueloBase({ codigoVuelo: 'B', precioEconomy: 320, horaSalida: '15:30' }),
    vueloBase({ codigoVuelo: 'C', precioEconomy: 295, horaSalida: '19:20' }),
  ]]);
  const valores = {
    origen: 'Madrid',
    destino: 'Nueva York',
    tipoTramo: 'IDA',
    fechaIda: '2026-11-20',
    fechaRegreso: null,
    asientos: 1,
  };

  const resultado = await buscarVuelosDirectos(prisma, valores);

  assert.deepEqual(resultado.ida.map((vuelo) => vuelo.codigoVuelo), ['C', 'B', 'A']);
});

test('obtenerOpcionesBusqueda devuelve origenes y destinos sin repetir y ordenados', async () => {
  const prisma = prismaFalso([[
    { origen: 'Córdoba', destino: 'Madrid' },
    { origen: 'Buenos Aires', destino: 'Madrid' },
    { origen: 'Buenos Aires', destino: 'Nueva York' },
  ]]);

  const opciones = await obtenerOpcionesBusqueda(prisma);

  assert.deepEqual(prisma.llamadas[0].where, { activo: true });
  assert.deepEqual(opciones.origenes, ['Buenos Aires', 'Córdoba']);
  assert.deepEqual(opciones.destinos, ['Madrid', 'Nueva York']);
});