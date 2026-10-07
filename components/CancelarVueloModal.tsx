'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  cancelarVuelo,
  type CancelarVueloState,
} from '@/app/admin/vuelos/actions'
import { MOTIVO_MAX, fechasOperativas } from '@/lib/cancelacion-utils'

type Vuelo = {
  id: string
  codigoVuelo: string
  origen: string
  destino: string
  diasOperacion: string[]
  horaSalida: string
  periodoDesde: string
  periodoHasta: string
  activo: boolean
  fechasCanceladas: string[]
}

const initialState: CancelarVueloState = { error: '' }

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const formatoMes = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function aFechaUtc(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia))
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function agruparPorMes(fechas: string[]) {
  const grupos = new Map<string, string[]>()
  for (const fecha of fechas) {
    const mes = fecha.slice(0, 7)
    grupos.set(mes, [...(grupos.get(mes) ?? []), fecha])
  }
  return [...grupos.entries()]
}

export default function CancelarVueloModal({ vuelo }: { vuelo: Vuelo }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        Cancelar
      </button>

      {abierto && <CancelarVueloDialog vuelo={vuelo} onClose={() => setAbierto(false)} />}
    </>
  )
}

function CancelarVueloDialog({ vuelo, onClose }: { vuelo: Vuelo; onClose: () => void }) {
  const [modalidad, setModalidad] = useState('FECHA_PUNTUAL')
  const [state, formAction, isPending] = useActionState(cancelarVuelo, initialState)
  const fechas: string[] = fechasOperativas(vuelo, undefined, vuelo.fechasCanceladas)
  const tituloId = `cancelar-vuelo-${vuelo.id}`

  useEffect(() => {
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [isPending, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 text-left backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
      >
        <form action={formAction}>
          <input type="hidden" name="id" value={vuelo.id} />
          {modalidad === 'DEFINITIVA' && <input type="hidden" name="confirmacion" value="ELIMINAR" />}

          {/* Encabezado */}
          <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-lg text-red-600">
              ⚠
            </span>
            <div className="flex-1">
              <h3 id={tituloId} className="text-lg font-bold text-slate-900">
                Cancelar vuelo <span className="text-sky-700">{vuelo.codigoVuelo}</span>
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {vuelo.origen} → {vuelo.destino} · Frecuencia: {vuelo.diasOperacion.join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              aria-label="Cerrar"
              className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <p className="text-sm font-semibold text-slate-800">
              ¿Qué alcance de cancelación querés aplicar a este vuelo?
            </p>

            {state.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                {state.error}
              </div>
            )}

            {/* Opción A: fecha puntual */}
            <div className={`rounded-2xl border-2 p-4 ${modalidad === 'FECHA_PUNTUAL' ? 'border-sky-500 bg-sky-50/40' : 'border-slate-200'}`}>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <input type="radio" name="modalidad" value="FECHA_PUNTUAL" checked={modalidad === 'FECHA_PUNTUAL'} onChange={() => setModalidad('FECHA_PUNTUAL')} disabled={isPending} className="accent-sky-600" />
                Opción A: Cancelar en fecha puntual
              </label>
              <p className="mt-1 pl-6 text-sm text-slate-600">
                Cancela únicamente la salida de la fecha elegida. El resto de las salidas programadas no se modifica.
              </p>

              {modalidad === 'FECHA_PUNTUAL' && (fechas.length === 0 ? (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Este vuelo no tiene salidas programadas a futuro para cancelar.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 pl-6">
                  <div>
                    <label
                      htmlFor={`${tituloId}-fecha`}
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                    >
                      Fecha de la salida
                    </label>
                    <select
                      id={`${tituloId}-fecha`}
                      name="fecha"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    >
                      {agruparPorMes(fechas).map(([mes, fechasDelMes]) => (
                        <optgroup key={mes} label={capitalizar(formatoMes.format(aFechaUtc(`${mes}-01`)))}>
                          {fechasDelMes.map((fecha) => (
                            <option key={fecha} value={fecha}>
                              {capitalizar(formatoFecha.format(aFechaUtc(fecha)))} · Salida {vuelo.horaSalida}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`${tituloId}-motivo`}
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                    >
                      Motivo de la cancelación
                    </label>
                    <textarea
                      id={`${tituloId}-motivo`}
                      name="motivo"
                      required
                      maxLength={MOTIVO_MAX}
                      rows={3}
                      placeholder="Ej.: condiciones climáticas adversas, mantenimiento no programado…"
                      className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Opción B: eliminación de toda la frecuencia (US-04) */}
            <div className={`rounded-2xl border-2 p-4 ${modalidad === 'DEFINITIVA' ? 'border-red-500 bg-red-50/40' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="radio" name="modalidad" value="DEFINITIVA" checked={modalidad === 'DEFINITIVA'} onChange={() => setModalidad('DEFINITIVA')} disabled={isPending} className="accent-red-600" />
                  Opción B: Eliminar vuelo de manera definitiva
                </label>
              </div>
              <p className="mt-1 pl-6 text-sm text-slate-500">
                Elimina permanentemente toda la programación del vuelo. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cerrar / Descartar
            </button>
            <button
              type="submit"
              disabled={isPending || (modalidad === 'FECHA_PUNTUAL' && fechas.length === 0)}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Cancelando…' : 'Confirmar cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
