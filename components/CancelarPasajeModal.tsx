'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  cancelarMiPasaje,
  type CancelarPasajeState,
} from '@/app/pasajero/reservas/actions'

type Reserva = {
  id: string
  codigoVuelo: string
  ruta: string
  salida: string
  limite: string
  titular: string
  acompanantes: number
}

const initialState: CancelarPasajeState = { error: '' }

export default function CancelarPasajeModal({
  reserva,
  bloqueo,
}: {
  reserva: Reserva
  // Motivo por el que no se puede cancelar (p. ej. faltan menos de 48 hs); null si se puede.
  bloqueo: string | null
}) {
  const [abierto, setAbierto] = useState(false)

  if (bloqueo) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400"
        >
          Cancelar mi pasaje
        </button>
        <p className="max-w-xs text-right text-xs font-medium text-amber-700">{bloqueo}</p>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
      >
        Cancelar mi pasaje
      </button>

      {abierto && <CancelarPasajeDialog reserva={reserva} onClose={() => setAbierto(false)} />}
    </>
  )
}

function CancelarPasajeDialog({ reserva, onClose }: { reserva: Reserva; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(cancelarMiPasaje, initialState)
  const tituloId = `cancelar-pasaje-${reserva.id}`

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
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
      >
        <form action={formAction}>
          <input type="hidden" name="reservaId" value={reserva.id} />

          {/* Encabezado */}
          <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-lg text-red-600">
              ⚠
            </span>
            <div className="flex-1">
              <h3 id={tituloId} className="text-lg font-bold text-slate-900">
                Cancelar tu pasaje del vuelo <span className="text-sky-700">{reserva.codigoVuelo}</span>
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">
                {reserva.ruta} · {reserva.salida}
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
            {state.error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                {state.error}
              </div>
            )}

            <p className="text-sm font-semibold text-slate-800">¿Querés cancelar tu pasaje en esta reserva?</p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                Se anula únicamente el pasaje de <span className="font-semibold text-slate-800">{reserva.titular}</span>.
              </p>
              {reserva.acompanantes > 0 && (
                <p className="mt-1">
                  {reserva.acompanantes === 1
                    ? 'El otro pasajero de la reserva mantiene su pasaje.'
                    : `Los otros ${reserva.acompanantes} pasajeros de la reserva mantienen su pasaje.`}
                </p>
              )}
              <p className="mt-1">Esta acción no se puede deshacer.</p>
            </div>

            <p className="text-xs text-slate-500">Podés cancelar hasta el {reserva.limite}.</p>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={isPending}
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
