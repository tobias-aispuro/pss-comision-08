'use client'

import { useState } from 'react'
import { buscarReservasPorDni, buscarReservasPorVuelo } from '@/app/empleado/buscar-reserva/actions'

type Filtro = 'dni' | 'vuelo'
type ResultadoVuelo = Extract<Awaited<ReturnType<typeof buscarReservasPorVuelo>>, { error: null }>

export default function BuscadorReservas() {
  const [filtro, setFiltro] = useState<Filtro>('dni')
  const [dni, setDni] = useState('')
  const [codigoVuelo, setCodigoVuelo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any[]>([])
  const [pasajero, setPasajero] = useState<any | null>(null) // NUEVO ESTADO
  const [vuelo, setVuelo] = useState<ResultadoVuelo['vuelo'] | null>(null)
  const [pasajerosVuelo, setPasajerosVuelo] = useState<ResultadoVuelo['pasajeros']>([])
  const [tiempoMs, setTiempoMs] = useState<number | null>(null)

  const limpiarResultados = () => {
    setError(null)
    setResultados([])
    setPasajero(null)
    setVuelo(null)
    setPasajerosVuelo([])
    setTiempoMs(null)
  }

  const cambiarFiltro = (nuevo: Filtro) => {
    setFiltro(nuevo)
    limpiarResultados()
  }

  const buscarPorVuelo = async () => {
    // Validación (Escenario 2 se resuelve en el backend)
    if (codigoVuelo.trim().length === 0) {
      limpiarResultados()
      setError('Por favor, ingrese un número de vuelo antes de buscar.')
      return
    }

    setLoading(true)
    limpiarResultados()

    const startTime = performance.now()
    const res = await buscarReservasPorVuelo(codigoVuelo)
    const endTime = performance.now()
    setTiempoMs(Math.round(endTime - startTime))

    if (res.error !== null) {
      setError(res.error)
    } else {
      setPasajerosVuelo(res.pasajeros)
      setVuelo(res.vuelo)
    }
    setLoading(false)
  }

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (filtro === 'vuelo') {
      await buscarPorVuelo()
      return
    }

    // Validaciones (Escenarios 4 y 5)
    if (dni.length === 0) {
      setError('Por favor, ingrese un DNI antes de buscar.')
      setResultados([])
      setPasajero(null)
      return
    }
    if (!/^\d{7,8}$/.test(dni)) {
      setError('Ingrese un número de DNI válido, compuesto únicamente por dígitos numéricos.')
      setResultados([])
      setPasajero(null)
      return
    }

    setLoading(true)
    setError(null)
    setResultados([])
    setPasajero(null)
    setTiempoMs(null)

    const startTime = performance.now()
    const res = await buscarReservasPorDni(dni)
    const endTime = performance.now()
    setTiempoMs(Math.round(endTime - startTime))

    if (res.error) {
      setError(res.error)
    } else {
      setResultados(res.reservas)
      setPasajero(res.pasajero) // Guardamos los datos del pasajero
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Formulario de Búsqueda */}
      <form onSubmit={handleBuscar} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Buscador de Reservas</h2>

        {/* Opción de filtrado */}
        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filtrar reservas por">
          {([
            { valor: 'dni', texto: 'DNI del pasajero' },
            { valor: 'vuelo', texto: 'Número de vuelo' },
          ] as const).map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              role="tab"
              aria-selected={filtro === opcion.valor}
              onClick={() => cambiarFiltro(opcion.valor)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                filtro === opcion.valor ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            {filtro === 'dni' ? (
              <>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">DNI del Pasajero</label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => {
                    setDni(e.target.value.replace(/\D/g, ''))
                    setError(null)
                  }}
                  maxLength={8}
                  placeholder="Ej: 12345678"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </>
            ) : (
              <>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Número de Vuelo</label>
                <input
                  type="text"
                  value={codigoVuelo}
                  onChange={(e) => {
                    setCodigoVuelo(e.target.value.toUpperCase())
                    setError(null)
                  }}
                  placeholder="Ej: SK1234"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto rounded-xl bg-sky-600 px-6 py-2.5 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </form>

      {/* Mensajes de Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium shadow-sm">
          {error}
        </div>
      )}

      {/* Tiempo de respuesta */}
      {tiempoMs !== null && (
        <div className="flex justify-end">
          <p className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-full">
            ⏱️ Tiempo de respuesta: {tiempoMs} ms
          </p>
        </div>
      )}

      {/* --- NUEVO: DATOS DEL PASAJERO --- */}
      {pasajero && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 border-b border-sky-100 pb-3">
            <span className="text-2xl">👤</span>
            <h3 className="text-lg font-bold text-sky-900">Datos del Pasajero</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-medium">Nombre completo</p>
              <p className="font-bold text-slate-800">{pasajero.nombre} {pasajero.apellido}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">DNI</p>
              <p className="font-bold text-slate-800">{pasajero.dni}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Email</p>
              <p className="font-bold text-slate-800">{pasajero.email}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Teléfono</p>
              <p className="font-bold text-slate-800">{pasajero.telefono}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados (Reservas) */}
      {resultados.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700">Reservas encontradas ({resultados.length})</h3>
          {resultados.map((reserva) => (
            <div key={reserva.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-200 transition">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    PNR: {reserva.codigoReserva || reserva.id.slice(0, 6)}
                  </p>
                  <p className="text-lg font-bold text-slate-800 mt-1">
                    {reserva.vuelo.origen} → {reserva.vuelo.destino}
                  </p>
                  <div className="mt-2 text-sm text-slate-500 space-y-1">
                    <p>✈️ Vuelo: <strong>{reserva.vuelo.codigoVuelo}</strong></p>
                    <p>📅 Fecha: {reserva.vuelo.periodoDesde || 'A confirmar'} | 🕒 Horario: {reserva.vuelo.horaSalida}</p>
                    <p>🪑 Asiento: {reserva.asiento || 'No asignado'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                    reserva.estado === 'CONFIRMADA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {reserva.estado || 'CONFIRMADA'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Datos del vuelo (búsqueda por número de vuelo) */}
      {vuelo && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 border-b border-sky-100 pb-3">
            <span className="text-2xl">✈️</span>
            <h3 className="text-lg font-bold text-sky-900">Vuelo {vuelo.codigoVuelo}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-medium">Ruta</p>
              <p className="font-bold text-slate-800">{vuelo.origen} → {vuelo.destino}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Horario</p>
              <p className="font-bold text-slate-800">{vuelo.horaSalida} - {vuelo.horaLlegada}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Avión</p>
              <p className="font-bold text-slate-800">{vuelo.tipoAvion}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Pasajeros</p>
              <p className="font-bold text-slate-800">{pasajerosVuelo.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Grilla de pasajeros del vuelo */}
      {pasajerosVuelo.length > 0 && vuelo && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-700">Reservas encontradas ({pasajerosVuelo.length})</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pasajero</th>
                  <th className="px-4 py-3">DNI</th>
                  <th className="px-4 py-3">PNR</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Horario</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pasajerosVuelo.map((p) => (
                  <tr key={p.id} className="transition hover:bg-sky-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.nombre}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{p.dni}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold uppercase text-sky-600">{p.pnr}</td>
                    <td className="px-4 py-3 text-slate-700">{vuelo.origen}</td>
                    <td className="px-4 py-3 text-slate-700">{vuelo.destino}</td>
                    <td className="px-4 py-3 text-slate-700">{p.fecha || 'A confirmar'}</td>
                    <td className="px-4 py-3 text-slate-700">{vuelo.horaSalida}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        p.estado === 'CONFIRMADA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {p.estado || 'CONFIRMADA'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}