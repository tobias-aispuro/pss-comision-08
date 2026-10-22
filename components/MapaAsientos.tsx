'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { confirmarAsientos, consultarAsientos } from '@/app/pasajero/check-in/actions'
import type { AsientoMapa } from '@/lib/asientos-check-in'

type Pasajero = { id: string; nombre: string; asiento: string | null; checkInCompletado: boolean }
type Props = { reservaId: string; clase: string; mapa: AsientoMapa[]; pasajeros: Pasajero[]; ocupadosIniciales: string[] }

export default function MapaAsientos({ reservaId, clase, mapa, pasajeros, ocupadosIniciales }: Props) {
  const pendientes = pasajeros.filter((p) => !p.checkInCompletado)
  const [activo, setActivo] = useState(pendientes[0]?.id ?? '')
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [ocupados, setOcupados] = useState(ocupadosIniciales)
  const [error, setError] = useState('')
  const [bloqueo, setBloqueo] = useState('')
  const [exito, setExito] = useState(false)
  const [enviando, iniciarTransicion] = useTransition()

  useEffect(() => {
    if (exito || pendientes.length === 0) return
    let vigente = true
    let consultando = false
    const actualizar = async () => {
      if (consultando || enviando) return
      consultando = true
      try {
        const resultado = await consultarAsientos(reservaId)
        if (!vigente) return
        if (resultado.ocupados) setOcupados(resultado.ocupados)
        if (!resultado.ok) setBloqueo(resultado.mensaje)
      } catch {
        // La confirmación siempre consulta la disponibilidad, aunque falle una actualización.
      } finally {
        consultando = false
      }
    }
    const timer = window.setInterval(actualizar, 10000)
    window.addEventListener('focus', actualizar)
    return () => { vigente = false; window.clearInterval(timer); window.removeEventListener('focus', actualizar) }
  }, [reservaId, exito, pendientes.length, enviando])

  const colision = Object.values(seleccion).some((asiento) => ocupados.includes(asiento))
  const completa = pendientes.length > 0 && pendientes.every((p) => seleccion[p.id])

  function elegir(asiento: string) {
    setError('')
    setSeleccion((anterior) => {
      const nueva = { ...anterior }
      if (nueva[activo] === asiento) delete nueva[activo]
      else nueva[activo] = asiento
      return nueva
    })
  }

  function confirmar() {
    if (!completa) { setError('Debe seleccionar un asiento para continuar'); return }
    setError('')
    iniciarTransicion(async () => {
      try {
        const resultado = await confirmarAsientos(reservaId, pendientes.map((p) => ({ pasajeroId: p.id, asiento: seleccion[p.id] })))
        if (resultado.ocupados) setOcupados(resultado.ocupados)
        if (resultado.ok) setExito(true)
        else {
          setError(resultado.mensaje)
          if (resultado.ocupados) setSeleccion((actual) => Object.fromEntries(Object.entries(actual).filter(([, asiento]) => !resultado.ocupados!.includes(asiento))))
        }
      } catch { setError('No se pudieron confirmar los asientos. Intentá nuevamente.') }
    })
  }

  if (exito || pendientes.length === 0) return (
    <div className="space-y-3">
      <p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">{exito ? 'Asiento seleccionado correctamente' : 'El check-in de esta reserva ya está completado.'}</p>
      <Link href="/pasajero/reservas" className="inline-block rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white">Continuar a mis reservas y tickets</Link>
    </div>
  )

  if (mapa.length === 0) return <p role="alert" className="text-amber-800">No está configurada la capacidad del avión. No se pueden seleccionar asientos.</p>

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-bold text-slate-900">Elegí tus asientos</h3>
      <p className="text-sm text-slate-600">Seleccioná un pasajero y luego un asiento de la clase comprada. Los lugares se asignan al confirmar.</p>
      <div className="flex flex-wrap gap-2" aria-label="Pasajeros">
        {pasajeros.map((p) => p.checkInCompletado ? (
          <span key={p.id} className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{p.nombre} · {p.asiento} · Check-in completado</span>
        ) : (
          <button key={p.id} type="button" disabled={enviando || !!bloqueo} aria-pressed={activo === p.id} onClick={() => setActivo(p.id)}
            className={`rounded-xl border p-3 text-sm ${activo === p.id ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-700'}`}>
            {p.nombre} · {seleccion[p.id] ?? 'Sin asiento'}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600">Libre: blanco · Seleccionado: azul · Ocupado: gris · Otra clase: deshabilitado</p>
      <div className="mx-auto max-w-md rounded-[3rem] border-2 border-slate-200 bg-slate-50 px-3 py-10 sm:px-6" aria-label="Mapa de asientos del avión">
        <p className="mb-5 text-center text-xs uppercase tracking-widest text-slate-500">Frente del avión</p>
        {(['PRIMERA', 'ECONOMY'] as const).map((seccion) => {
          const asientosClase = mapa.filter((a) => a.clase === seccion)
          const filas = [...new Set(asientosClase.map((a) => a.fila))]
          const letras = seccion === 'PRIMERA' ? ['A', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E', 'F']
          return (
            <section key={seccion} className="mb-6">
              <h4 className="mb-3 text-center text-sm font-bold text-slate-700">{seccion === 'PRIMERA' ? 'Primera Clase' : 'Economy'}</h4>
              {filas.length === 0 && <p className="text-center text-xs text-slate-500">Sin asientos configurados</p>}
              {filas.map((fila) => (
                <div key={fila} className="mb-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${letras.length / 2}, minmax(0, 1fr)) 1rem repeat(${letras.length / 2}, minmax(0, 1fr))` }}>
                  {letras.map((letra, indice) => {
                    const asiento = asientosClase.find((a) => a.fila === fila && a.letra === letra)
                    const columna = indice + 1 + (indice >= letras.length / 2 ? 1 : 0)
                    if (!asiento) return <span key={letra} style={{ gridColumn: columna }} />
                    const ocupado = ocupados.includes(asiento.codigo)
                    const elegido = Object.values(seleccion).includes(asiento.codigo)
                    const deOtro = Object.entries(seleccion).some(([id, codigo]) => id !== activo && codigo === asiento.codigo)
                    return (
                      <button key={letra} type="button" style={{ gridColumn: columna }}
                        aria-label={`Asiento ${asiento.codigo}, ${ocupado ? 'ocupado' : seccion !== clase ? 'otra clase' : elegido ? 'seleccionado' : 'disponible'}`}
                        aria-pressed={elegido} disabled={enviando || !!bloqueo || ocupado || seccion !== clase || deOtro}
                        onClick={() => elegir(asiento.codigo)}
                        className={`min-h-10 rounded-t-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed ${ocupado ? 'border-slate-300 bg-slate-300 text-slate-600' : elegido ? 'border-sky-700 bg-sky-700 text-white' : seccion !== clase ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-300 bg-white text-slate-800 hover:border-sky-500'}`}>
                        {asiento.codigo}
                      </button>
                    )
                  })}
                </div>
              ))}
            </section>
          )
        })}
      </div>
      {(error || colision || bloqueo) && <p role="alert" className="text-sm font-medium text-red-700">{bloqueo || error || 'El asiento ya no se encuentra disponible. Elegí una nueva ubicación libre.'}</p>}
      {!completa && <p className="text-sm text-slate-600">Debe seleccionar un asiento para continuar. Elegí uno para cada pasajero.</p>}
      <button type="button" disabled={!completa || colision || !!bloqueo || enviando} onClick={confirmar}
        className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
        {enviando ? 'Confirmando…' : 'Confirmar asientos'}
      </button>
    </div>
  )
}
