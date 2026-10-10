'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  modificarVuelo,
  type EditarVueloState,
} from '@/app/admin/vuelos/[id]/editar/actions'

const diasDisponibles = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']

type Vuelo = {
  id: string
  codigoVuelo: string
  origen: string
  destino: string
  diasOperacion: string[]
  horaSalida: string
  horaLlegada: string
  periodoDesde: string
  periodoHasta: string
  tipoAvion: string
}

const initialState: EditarVueloState = { error: '' }

export default function EditarVueloForm({ vuelo }: { vuelo: Vuelo }) {
  const [state, formAction, isPending] = useActionState(modificarVuelo, initialState)

  const [formValues, setFormValues] = useState({
    codigoVuelo: vuelo.codigoVuelo,
    tipoAvion: vuelo.tipoAvion,
    origen: vuelo.origen,
    destino: vuelo.destino,
    periodoDesde: vuelo.periodoDesde,
    periodoHasta: vuelo.periodoHasta,
    horaSalida: vuelo.horaSalida,
    horaLlegada: vuelo.horaLlegada,
  })

  const [dias, setDias] = useState<string[]>(vuelo.diasOperacion)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormValues((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const toggleDia = (dia: string) => {
    setDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    )
  }

  return (
    <form action={formAction} className="space-y-7 p-6 md:p-8">
      <input type="hidden" name="id" value={vuelo.id} />

      {state.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {state.error}
        </div>
      )}

      {/* Sección 1 */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
            1
          </span>
          <h3 className="text-lg font-bold text-slate-800">Ruta e identificación</h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Código de vuelo
            </label>
            <input
              name="codigoVuelo"
              required
              value={formValues.codigoVuelo}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Tipo de avión
            </label>
            <select
              name="tipoAvion"
              required
              value={formValues.tipoAvion}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
            >
              <option value="">Seleccionar</option>
              <option>Regional</option>
              <option>Fuselaje Estrecho</option>
              <option>Fuselaje Ancho</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Origen
            </label>
            <input
              name="origen"
              required
              value={formValues.origen}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Destino
            </label>
            <input
              name="destino"
              required
              value={formValues.destino}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
            />
          </div>
        </div>
      </section>

      {/* Sección 2 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
            2
          </span>
          <h3 className="text-lg font-bold text-slate-800">Periodo y horarios</h3>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Disponibilidad anual
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="month"
                  name="periodoDesde"
                  required
                  value={formValues.periodoDesde}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
                />
                <input
                  type="month"
                  name="periodoHasta"
                  required
                  value={formValues.periodoHasta}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Días de operación
              </label>
              <div className="grid grid-cols-7 gap-2">
                {diasDisponibles.map((dia) => (
                  <label key={dia} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="diasOperacion"
                      value={dia}
                      checked={dias.includes(dia)}
                      onChange={() => toggleDia(dia)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-600 shadow-sm transition peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-checked:text-white peer-checked:shadow-md hover:border-sky-200 hover:bg-sky-50">
                      {dia}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Hora de salida
              </label>
              <input
                type="time"
                name="horaSalida"
                required
                value={formValues.horaSalida}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Hora de llegada
              </label>
              <input
                type="time"
                name="horaLlegada"
                required
                value={formValues.horaLlegada}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/admin/vuelos"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Guardando...' : 'Publicar cambios'}
        </button>
      </div>
    </form>
  )
}