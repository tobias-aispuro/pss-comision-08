'use client'

import { useActionState, useEffect, useState } from 'react'
import { reubicarReserva, type ReubicarState } from '@/app/empleado/reubicacion/actions'

export type DatosReubicacion = {
  reservaId: string
  vueloId: string
  fecha: string
  // Textos ya formateados para mostrar en la confirmación
  vueloActual: string
  vueloNuevo: string
  pasajeros: string[]
}

const initialState: ReubicarState = { error: '' }

// Botón "Seleccionar" de un vuelo alternativo. Abre la confirmación; si el empleado vuelve atrás
// no se envía nada y la reserva queda como estaba (US-24, escenario 3).
export default function ConfirmarReubicacionModal({ datos }: { datos: DatosReubicacion }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
      >
        Seleccionar
      </button>

      {abierto && <ConfirmarReubicacionDialog datos={datos} onClose={() => setAbierto(false)} />}
    </>
  )
}

function ConfirmarReubicacionDialog({ datos, onClose }: { datos: DatosReubicacion; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(reubicarReserva, initialState)
  const tituloId = `reubicar-${datos.reservaId}-${datos.vueloId}`

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
          <input type="hidden" name="reservaId" value={datos.reservaId} />
          <input type="hidden" name="vueloId" value={datos.vueloId} />
          <input type="hidden" name="fecha" value={datos.fecha} />

          {/* Encabezado */}
          <div className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-lg text-sky-700">
              ⇄
            </span>
            <div className="flex-1">
              <h3 id={tituloId} className="text-lg font-bold text-slate-900">
                Confirmar reubicación
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">Revisá los datos antes de modificar la reserva.</p>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-700">Vuelo cancelado</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{datos.vueloActual}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Nuevo vuelo</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{datos.vueloNuevo}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                {datos.pasajeros.length === 1
                  ? 'Se reubica al pasajero:'
                  : `Se reubica a los ${datos.pasajeros.length} pasajeros de la reserva:`}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {datos.pasajeros.map((nombre, i) => (
                  <li key={i} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                    {nombre}
                  </li>
                ))}
              </ul>
              <p className="mt-3">La reserva queda confirmada en el nuevo vuelo. Si ya habían hecho el check-in, lo tienen que hacer de nuevo.</p>
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
              Volver
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Reubicando…' : 'Confirmar reubicación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
