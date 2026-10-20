'use client'

import { useState } from 'react'
import { buscarReservasPorDni } from '@/app/empleado/buscar-reserva/actions'

export default function BuscadorReservas() {
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any[]>([])
  const [tiempoMs, setTiempoMs] = useState<number | null>(null)

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Escenario 5: Campo vacío
    if (dni.length === 0) {
      setError('Por favor, ingrese un DNI antes de buscar.')
      setResultados([])
      return
    }

    // Escenario 4: DNI inválido (menos de 7 u 8 dígitos)
    if (!/^\d{7,8}$/.test(dni)) {
      setError('Ingrese un número de DNI válido, compuesto únicamente por dígitos numéricos.')
      setResultados([])
      return
    }

    setLoading(true)
    setError(null)
    setResultados([])
    setTiempoMs(null)

    // Medición de tiempo para el Testing
    const startTime = performance.now()
    
    const res = await buscarReservasPorDni(dni)
    
    const endTime = performance.now()
    setTiempoMs(Math.round(endTime - startTime))

    if (res.error) {
      setError(res.error)
    } else {
      setResultados(res.reservas)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Formulario de Búsqueda */}
      <form onSubmit={handleBuscar} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Buscador de Reservas</h2>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">DNI del Pasajero</label>
            <input
              type="text"
              value={dni}
              onChange={(e) => {
                setDni(e.target.value.replace(/\D/g, '')) // Solo permite números
                setError(null)
              }}
              maxLength={8}
              placeholder="Ej: 12345678"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
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

      {/* Mensajes de Error (Escenarios 3, 4 y 5) */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium shadow-sm animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Tiempo de respuesta (Útil para el Testing de la facultad) */}
      {tiempoMs !== null && (
        <div className="flex justify-end">
          <p className="text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-full">
            ⏱️ Tiempo de respuesta: {tiempoMs} ms
          </p>
        </div>
      )}

      {/* Resultados (Escenarios 1 y 2) */}
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
    </div>
  )
}