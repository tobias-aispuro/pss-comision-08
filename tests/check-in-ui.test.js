/* eslint-disable @typescript-eslint/no-require-imports -- Componentes reales renderizados con node --test, sin base de datos. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Transpila TSX con el mismo patrón usado por los tests de acciones de este proyecto.
function cargar(ruta, mocks = {}) {
  const archivo = path.join(__dirname, '..', ruta)
  const fuente = fs.readFileSync(archivo, 'utf8')
  const js = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  const localRequire = createRequire(archivo)
  const importar = (id) => {
    if (id in mocks) return mocks[id]
    if (id.startsWith('@/')) {
      const base = id.slice(2)
      const rutaLocal = ['.tsx', '.ts', '.js'].map((extension) => base + extension).find((nombre) => fs.existsSync(path.join(__dirname, '..', nombre)))
      if (rutaLocal) return cargar(rutaLocal, mocks)
    }
    return localRequire(id)
  }
  new vm.Script(`(function(require, exports, module) { ${js}\n})`).runInThisContext()(importar, mod.exports, mod)
  return mod.exports
}

const mocks = {
  'next/link': { __esModule: true, default: ({ children, ...props }) => {
    const atributos = { ...props }
    delete atributos.prefetch
    return React.createElement('a', atributos, children)
  } },
  '@/app/pasajero/check-in/actions': {
    confirmarAsientos: async () => { throw new Error('El render inicial no debe confirmar asientos') },
    consultarAsientos: async () => { throw new Error('El render inicial no debe consultar asientos') },
  },
}
const EstadoCheckIn = cargar('components/EstadoCheckIn.tsx', mocks).default
const MapaAsientos = cargar('components/MapaAsientos.tsx', mocks).default
const { construirMapa } = cargar('lib/asientos-check-in.ts')
const DESPEGUE = Date.parse('2026-11-20T13:00:00Z')
const DIA = 86400000
const pasajero = { id: 'p1', nombre: 'Ana Demo', asiento: null, checkInCompletado: false }
const vuelo = { horaSalida: '10:00', zonaOrigen: 'America/Argentina/Buenos_Aires', activo: true }
const propsEstado = {
  reservaId: 'r1', fecha: '2026-11-20', estado: 'CONFIRMADA', vuelo,
  cancelado: false, ahora: DESPEGUE - 7 * DIA, pasajeros: [pasajero],
}
const render = (Componente, props) => renderToStaticMarkup(React.createElement(Componente, props))

test('US18: el listado ofrece acceso únicamente dentro de la ventana de check-in', () => {
  const habilitado = render(EstadoCheckIn, propsEstado)
  assert.match(habilitado, /href="\/pasajero\/check-in\/r1"/)
  const anticipado = render(EstadoCheckIn, { ...propsEstado, ahora: DESPEGUE - 20 * DIA })
  assert.match(anticipado, /<button[^>]*disabled/)
  assert.match(anticipado, /Se habilitará el viernes, 6 de noviembre de 2026, 10:00/)
  assert.doesNotMatch(anticipado, /href="\/pasajero\/check-in/)
  const vencido = render(EstadoCheckIn, { ...propsEstado, ahora: DESPEGUE - DIA })
  assert.match(vencido, /<button[^>]*disabled/)
  assert.match(vencido, /mostrador del aeropuerto/)
  assert.match(vencido, /role="alert"/)
})

test('US18: al volver al listado el check-in completado muestra el asiento y no ofrece repetirlo', () => {
  const html = render(EstadoCheckIn, {
    ...propsEstado, ahora: DESPEGUE - DIA,
    pasajeros: [{ ...pasajero, asiento: '2A', checkInCompletado: true }],
  })
  assert.match(html, /Check-in completado/)
  assert.match(html, /Ana Demo · Asiento 2A/)
  assert.match(html, /href="\/pasajero\/reservas"/)
  assert.doesNotMatch(html, /Realizar Check-in|mostrador|<button/)
})

test('US18: una zona de origen inválida muestra el bloqueo sin romper la pantalla', () => {
  const html = render(EstadoCheckIn, { ...propsEstado, vuelo: { ...vuelo, zonaOrigen: 'inválida' } })
  assert.match(html, /No se pudo verificar el horario/)
  assert.match(html, /<button[^>]*disabled/)
})

const mapa = construirMapa({ capacidadPrimera: 4, capacidadEconomy: 6 })
const propsMapa = { reservaId: 'r1', clase: 'ECONOMY', mapa, pasajeros: [pasajero], ocupadosIniciales: ['2A'] }

test('US18: el mapa impide elegir asientos ocupados y de otra clase y deja libres los correctos', () => {
  const html = render(MapaAsientos, propsMapa)
  assert.match(html, /<button[^>]*aria-label="Asiento 2A, ocupado"[^>]*disabled/)
  assert.match(html, /<button[^>]*aria-label="Asiento 1A, otra clase"[^>]*disabled/)
  const libre = html.match(/<button[^>]*aria-label="Asiento 2B, disponible"[^>]*>/)?.[0]
  assert.ok(libre)
  assert.doesNotMatch(libre, /\sdisabled(?:=|\s|>)/)
  assert.match(html, /<button[^>]*disabled[^>]*>Confirmar Asiento<\/button>/)
})

test('US18: reabrir el mapa completado muestra pasajeros y asientos sin permitir reasignarlos', () => {
  const html = render(MapaAsientos, { ...propsMapa, pasajeros: [{ ...pasajero, asiento: '2B', checkInCompletado: true }] })
  assert.match(html, /Check-in completado/)
  assert.match(html, /Ana Demo · Asiento 2B/)
  assert.doesNotMatch(html, /<button|Confirmar Asiento/)
})

test('US18: la página de check-in carga los pasajeros activos y refleja el estado persistido', async () => {
  const pagina = cargar('app/pasajero/check-in/page.tsx', {
    ...mocks,
    '@/lib/role-access': { requireRole: async (roles) => { assert.deepEqual(roles, ['PASAJERO']); return { id: 'u1' } } },
    '@/lib/prisma': { prisma: { reserva: { findMany: async ({ where, include }) => {
      assert.equal(where.userId, 'u1')
      assert.equal(include.pasajeros.where.canceladoAt, null)
      return [{ id: 'r1', fecha: '2026-11-20', estado: 'CONFIRMADA', vuelo: { ...vuelo, codigoVuelo: 'DEMO18', origen: 'Buenos Aires', destino: 'Córdoba', cancelaciones: [] }, pasajeros: [{ ...pasajero, asiento: '2A', checkInCompletado: true }] }]
    } } } },
  }).default
  const html = renderToStaticMarkup(await pagina())
  assert.match(html, /Check-in completado/)
  assert.match(html, /Ana Demo · Asiento 2A/)
  assert.doesNotMatch(html, /Realizar Check-in/)
})

test('US18: el acceso directo a un check-in completado conserva el resumen sin consultar ocupación', async () => {
  const pagina = cargar('app/pasajero/check-in/[reservaId]/page.tsx', {
    ...mocks,
    'next/navigation': { notFound: () => { throw new Error('404') } },
    '@/lib/role-access': { requireRole: async () => ({ id: 'u1' }) },
    '@/lib/prisma': { prisma: {
      reserva: { findFirst: async ({ where }) => {
        assert.deepEqual([where.id, where.userId], ['r1', 'u1'])
        return { id: 'r1', fecha: '2026-11-20', estado: 'CONFIRMADA', vuelo: { ...vuelo, codigoVuelo: 'DEMO18', cancelaciones: [] }, pasajeros: [{ ...pasajero, asiento: '2A', checkInCompletado: true }] }
      } },
      pasajeroReserva: { findMany: async () => { throw new Error('No debe consultar asientos para un check-in completado') } },
    } },
  }).default
  const html = renderToStaticMarkup(await pagina({ params: Promise.resolve({ reservaId: 'r1' }) }))
  assert.match(html, /Check-in completado/)
  assert.doesNotMatch(html, /Realizar Check-in|Confirmar Asiento/)
})

test('US20: el componente muestra check-in pendiente sin botón de descarga', () => {
  const BotonDescargaTicket = cargar('components/BotonDescargaTicket.tsx').default
  const html = render(BotonDescargaTicket, { ticketId: 'ticket-1', checkInCompletado: false })
  assert.match(html, /Completá el check-in antes de descargar el ticket electrónico/)
  assert.doesNotMatch(html, /Descargar Ticket Electrónico|<button/)
})

test('US20: el componente no ofrece descarga si todavía no existe el ticket', () => {
  const BotonDescargaTicket = cargar('components/BotonDescargaTicket.tsx').default
  const html = render(BotonDescargaTicket, { ticketId: null, checkInCompletado: true })
  assert.match(html, /El ticket electrónico todavía no está disponible/)
  assert.doesNotMatch(html, /Descargar Ticket Electrónico|<button/)
})

test('US20: el componente ofrece descarga cuando existe el ticket emitido', () => {
  const BotonDescargaTicket = cargar('components/BotonDescargaTicket.tsx').default
  const html = render(BotonDescargaTicket, { ticketId: 'ticket-1', checkInCompletado: true })
  assert.match(html, /Descargar Ticket Electrónico/)
  assert.match(html, /<button[^>]*>Descargar Ticket Electrónico<\/button>/)
})

test('US18: Mis reservas muestra el estado completado y los asientos aunque haya pasajes cancelados', async () => {
  const pagina = cargar('app/pasajero/reservas/page.tsx', {
    ...mocks,
    '@/components/CancelarReservaModal': { __esModule: true, default: () => null },
    '@/components/BotonDescargaTicket': { __esModule: true, default: () => null },
    '@/lib/role-access': { requireRole: async () => ({ id: 'u1', dni: '12345678' }) },
    '@/lib/prisma': { prisma: { reserva: { findMany: async () => [{
      id: 'r1', fecha: new Date(Date.now() + 7 * DIA).toISOString().slice(0, 10), estado: 'CONFIRMADA', clase: 'ECONOMY', asientos: 2,
      vuelo: { ...vuelo, codigoVuelo: 'DEMO18', origen: 'Buenos Aires', destino: 'Córdoba' },
      pasajeros: [
        { ...pasajero, dni: '12345678', asiento: '2A', checkInCompletado: true, canceladoAt: null, ticket: { id: 'ticket-1' } },
        { ...pasajero, id: 'p2', nombre: 'Pasajero cancelado', dni: '23456789', canceladoAt: new Date() },
      ],
    }] } } },
  }).default
  const html = renderToStaticMarkup(await pagina({}))
  assert.match(html, /<span[^>]*>Check-in completado<\/span>/)
  assert.match(html, /Check-in completado · Asiento 2A/)
  assert.doesNotMatch(html, /Check-in completado · Asiento sin asignar/)
})
