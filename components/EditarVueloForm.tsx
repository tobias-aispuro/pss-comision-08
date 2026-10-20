'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  modificarVuelo,
  type EditarVueloState,
} from '@/app/admin/vuelos/[id]/editar/actions'

// Actualizamos los días a nombres completos
const diasDisponibles = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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
  precioEconomy: number | null
  precioPrimera: number | null 
}

const initialState: EditarVueloState = { error: '' }
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500'

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
    precioEconomy: vuelo.precioEconomy ?? '',
    precioPrimera: vuelo.precioPrimera ?? '',
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

      {/* ---------- Sección 1: Ruta ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
            1
          </span>
          <h3 className="text-lg font-bold text-slate-800">Ruta e identificación</h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Código de vuelo</label>
            <input
              name="codigoVuelo"
              required
              value={formValues.codigoVuelo}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Tipo de avión</label>
            <select
              name="tipoAvion"
              required
              value={formValues.tipoAvion}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Seleccionar</option>
              <option>Regional</option>
              <option>Fuselaje Estrecho</option>
              <option>Fuselaje Ancho</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Origen</label>
            <input
              name="origen"
              required
              value={formValues.origen}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Destino</label>
            <input
              name="destino"
              required
              value={formValues.destino}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ---------- Sección 2: Período y horarios ---------- */}
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
              <label className={labelClass}>Disponibilidad anual</label>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  name="periodoDesde"
                  required
                  value={formValues.periodoDesde}
                  onChange={handleChange}
                  className={inputClass}
                />
                <input
                  type="date"
                  name="periodoHasta"
                  required
                  value={formValues.periodoHasta}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Días de operación</label>
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
                    {/* Cortamos el texto para que entre en el botón (Lun, Mar, etc.) */}
                    <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-600 shadow-sm transition peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-checked:text-white peer-checked:shadow-md hover:border-sky-200 hover:bg-sky-50">
                      {dia.slice(0, 3)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className={labelClass}>Hora de salida</label>
              <input
                type="time"
                name="horaSalida"
                required
                value={formValues.horaSalida}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Hora de llegada</label>
              <input
                type="time"
                name="horaLlegada"
                required
                value={formValues.horaLlegada}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Sección 3: Precios ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
            3
          </span>
          <h3 className="text-lg font-bold text-slate-800">Precio por pasaje</h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Economy · ARS</label>
            <input
              name="precioEconomy"
              type="number"
              min="1"
              step="1"
              required
              value={formValues.precioEconomy}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Primera · ARS</label>
            <input
              name="precioPrimera"
              type="number"
              min="1"
              step="1"
              required
              value={formValues.precioPrimera}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ---------- Botones ---------- */}
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