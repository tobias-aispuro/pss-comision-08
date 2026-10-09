'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  registrarPasajeros,
  type CompraPasajesState,
} from '@/app/pasajero/compra/actions'
import { EDAD_MAX, NOMBRE_MAX, PASAJES_MAX, validarPasajeros } from '@/lib/compra-utils'

type Pasajero = {
  dni: string
  nombre: string
  edad: string
  telefono: string
}

type Campo = keyof Pasajero

const campos: Array<{ campo: Campo; etiqueta: string }> = [
  { campo: 'dni', etiqueta: 'DNI' },
  { campo: 'nombre', etiqueta: 'Nombre' },
  { campo: 'edad', etiqueta: 'Edad' },
  { campo: 'telefono', etiqueta: 'Teléfono' },
]

const pasajeroVacio: Pasajero = { dni: '', nombre: '', edad: '', telefono: '' }

const initialState: CompraPasajesState = { error: '', errores: [] }

const inputClass =
  'w-full rounded-xl border bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:ring-3'
const inputOk = 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
const inputError = 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'

function formatearPrecio(precio: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function DatosPasajerosForm({
  vueloId,
  fecha,
  clase,
  cantidadInicial,
  maxPasajes,
  pasajerosIniciales,
  precioUnitario,
  urlVolver,
  regreso,
  idaId,
}: {
  vueloId: string
  fecha: string
  clase: string
  cantidadInicial: number
  maxPasajes: number
  pasajerosIniciales: Pasajero[]
  precioUnitario: number | null
  urlVolver: string
  regreso: string
  idaId: string
}) {
  const [state, formAction, isPending] = useActionState(registrarPasajeros, initialState)
  const [cantidad, setCantidad] = useState(Math.min(Math.max(cantidadInicial, 1), maxPasajes))
  // Se guardan siempre 9 pasajeros para no perder lo cargado si se baja y se vuelve a subir la cantidad.
  const [pasajeros, setPasajeros] = useState<Pasajero[]>(() =>
    Array.from({ length: PASAJES_MAX }, (_, i) => pasajerosIniciales[i] ?? pasajeroVacio)
  )
  // Los datos precargados se validan desde el inicio, por si alguno no cumple el formato.
  const [tocados, setTocados] = useState<Set<string>>(
    () => new Set(pasajerosIniciales.flatMap((_, i) => campos.map(({ campo }) => `${campo}-${i}`)))
  )

  const visibles = pasajeros.slice(0, cantidad)
  const validacion = validarPasajeros(visibles)
  const erroresCliente: Array<Record<string, string>> = validacion.ok ? [] : validacion.errores
  const faltantes = visibles
    .map((p, i) => ({
      numero: i + 1,
      campos: campos.filter(({ campo }) => !p[campo].trim()).map(({ etiqueta }) => etiqueta),
    }))
    .filter((p) => p.campos.length > 0)

  const actualizar = (i: number, campo: Campo, valor: string) => {
    setPasajeros((prev) => prev.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)))
  }

  const tocar = (i: number, campo: Campo) => {
    setTocados((prev) => new Set(prev).add(`${campo}-${i}`))
  }

  const errorDe = (i: number, campo: Campo) => {
    if (tocados.has(`${campo}-${i}`)) return erroresCliente[i]?.[campo]
    return state.errores[i]?.[campo]
  }

  return (
    <form action={formAction} className="space-y-7 p-6 md:p-8">
      <input type="hidden" name="vueloId" value={vueloId} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="clase" value={clase} />
      <input type="hidden" name="cantidad" value={cantidad} />
      {regreso && <input type="hidden" name="regreso" value={regreso} />}
      {idaId && <input type="hidden" name="idaId" value={idaId} />}

      {state.error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {state.error}
        </div>
      )}

      {/* Sección 1 */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
            1
          </span>
          <h3 className="text-lg font-bold text-slate-800">Cantidad de pasajes</h3>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCantidad((c) => c - 1)}
              disabled={cantidad <= 1 || isPending}
              aria-label="Quitar un pasaje"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <output aria-live="polite" className="min-w-24 text-center text-lg font-bold text-slate-900">
              {cantidad} {cantidad === 1 ? 'pasaje' : 'pasajes'}
            </output>
            <button
              type="button"
              onClick={() => setCantidad((c) => c + 1)}
              disabled={cantidad >= maxPasajes || isPending}
              aria-label="Agregar un pasaje"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>

          <p className={`text-sm ${cantidad >= maxPasajes ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
            {maxPasajes < PASAJES_MAX
              ? `Quedan ${maxPasajes} ${maxPasajes === 1 ? 'asiento disponible' : 'asientos disponibles'} en esta clase.`
              : cantidad >= PASAJES_MAX
                ? `Alcanzaste el máximo de ${PASAJES_MAX} pasajes por compra.`
                : `Podés comprar hasta ${PASAJES_MAX} pasajes en una misma transacción.`}
          </p>
        </div>
      </section>

      {/* Sección 2 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
            2
          </span>
          <h3 className="text-lg font-bold text-slate-800">Datos de los pasajeros</h3>
        </div>

        <div className="space-y-4">
          {visibles.map((pasajero, i) => (
            <fieldset key={i} disabled={isPending} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
              <legend className="sr-only">Pasajero {i + 1}</legend>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">Pasajero {i + 1}</p>
                {i === 0 && !idaId && (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Precargado con tus datos
                  </span>
                )}
                {idaId && i < pasajerosIniciales.length && (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Mismos datos que en la ida
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_0.6fr_1fr]">
                {campos.map(({ campo, etiqueta }) => {
                  const id = `${campo}-${i}`
                  const error = errorDe(i, campo)
                  return (
                    <div key={campo}>
                      <label htmlFor={id} className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        {etiqueta}
                      </label>
                      <input
                        id={id}
                        name={id}
                        value={pasajero[campo]}
                        onChange={(e) => actualizar(i, campo, e.target.value)}
                        onBlur={() => tocar(i, campo)}
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${id}-error` : undefined}
                        className={`${inputClass} ${error ? inputError : inputOk}`}
                        {...(campo === 'dni' && { inputMode: 'numeric' as const, maxLength: 8, placeholder: 'Ej. 40123456' })}
                        {...(campo === 'nombre' && { maxLength: NOMBRE_MAX, autoComplete: 'off', placeholder: 'Nombre y apellido' })}
                        {...(campo === 'edad' && { type: 'number', min: 0, max: EDAD_MAX, inputMode: 'numeric' as const })}
                        {...(campo === 'telefono' && { type: 'tel', placeholder: 'Ej. 11 5555-1234' })}
                      />
                      {error && (
                        <p id={`${id}-error`} className="mt-2 text-sm text-rose-600">
                          {error}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          {precioUnitario !== null && (
            <p className="text-slate-600">
              Total estimado:{' '}
              <span className="text-lg font-bold text-slate-900">{formatearPrecio(precioUnitario * cantidad)}</span>
              <span className="text-slate-500">
                {' '}
                ({cantidad} × {formatearPrecio(precioUnitario)})
              </span>
            </p>
          )}
          {faltantes.length > 0 ? (
            <p role="status" className="mt-1 font-medium text-amber-700">
              Faltan completar:{' '}
              {faltantes.map((p) => `Pasajero ${p.numero} (${p.campos.join(', ')})`).join(' · ')}
            </p>
          ) : (
            !validacion.ok && (
              <p role="status" className="mt-1 font-medium text-amber-700">
                Revisá los datos marcados en rojo para continuar.
              </p>
            )
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={urlVolver}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Volver
          </Link>
          <button
            type="submit"
            disabled={isPending || !validacion.ok}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Guardando...' : 'Continuar con la compra'}
          </button>
        </div>
      </div>
    </form>
  )
}
