const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function escenario({ rol = 'ADMINISTRADOR', count = 1, falla = false } = {}) {
  const llamadas = []
  const mod = { exports: {} }
  const mocks = {
    '@prisma/client': { Prisma: {} },
    '@/lib/cancelacion-utils': require('../lib/cancelacion-utils'),
    '@/lib/role-access': { getCurrentAppUser: async () => rol ? { rol } : null },
    '@/lib/prisma': { prisma: { vuelo: { deleteMany: async (args) => {
      llamadas.push(args)
      if (falla) throw new Error('Database unavailable')
      return { count }
    } } } },
    'next/cache': { revalidatePath: (ruta) => llamadas.push(ruta) },
    'next/navigation': { redirect: (ruta) => { throw new Error(`REDIRECT:${ruta}`) } },
  }
  const source = fs.readFileSync(path.join(__dirname, '../app/admin/vuelos/actions.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(outputText, { exports: mod.exports, require: (name) => {
    assert.ok(mocks[name], `Unexpected dependency: ${name}`)
    return mocks[name]
  } })
  return { ejecutarModalidad: (datos) => mod.exports.cancelarVuelo({ error: '' }, new Map(Object.entries(datos))),
    ejecutar: (datos = { id: 'vuelo-1', confirmacion: 'ELIMINAR' }) =>
    mod.exports.cancelarFrecuencia({ error: '' }, new Map(Object.entries(datos))), llamadas }
}

test('cancelación rechaza usuarios sin sesión o sin rol administrador antes de borrar', async () => {
  for (const rol of [null, 'PASAJERO', 'EMPLEADO_MOSTRADOR']) {
    const caso = escenario({ rol })
    assert.match((await caso.ejecutar()).error, /permisos/)
    assert.equal(caso.llamadas.length, 0)
  }
})

test('cancelación requiere un ID válido y confirmación explícita', async () => {
  for (const datos of [{ id: ' ', confirmacion: 'ELIMINAR' }, { id: 'vuelo-1' }]) {
    const caso = escenario()
    assert.ok((await caso.ejecutar(datos)).error)
    assert.equal(caso.llamadas.length, 0)
  }
})

test('cancelación elimina únicamente el vuelo indicado y actualiza ambas vistas', async () => {
  const caso = escenario()
  await assert.rejects(caso.ejecutar(), /REDIRECT:\/admin\/vuelos\?success=cancelado/)
  assert.equal(JSON.stringify(caso.llamadas[0]), JSON.stringify({ where: { id: 'vuelo-1' } }))
  assert.deepEqual(caso.llamadas.slice(1), ['/admin/vuelos', '/pasajero/busquedaVuelo'])
})

test('vuelo inexistente o error de base de datos no muestra éxito ni redirige', async () => {
  for (const opciones of [{ count: 0 }, { falla: true }]) {
    const caso = escenario(opciones)
    assert.ok((await caso.ejecutar()).error)
    assert.equal(caso.llamadas.length, 1)
  }
})

test('modalidad definitiva permite eliminar sin fecha ni motivo', async () => {
  const caso = escenario()
  await assert.rejects(caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'DEFINITIVA', confirmacion: 'ELIMINAR' }), /REDIRECT:/)
  assert.equal(caso.llamadas.length, 3)
})

test('modalidad desconocida no modifica datos', async () => {
  const caso = escenario()
  assert.match((await caso.ejecutarModalidad({ id: 'vuelo-1', modalidad: 'OTRA' })).error, /modalidad/)
  assert.equal(caso.llamadas.length, 0)
})
