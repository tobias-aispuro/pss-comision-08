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

  // Un pasajero está completo cuando tiene todos los campos cargados y sin errores de formato.
  const estaCompleto = (i: number) =>
    campos.every(({ campo }) => visibles[i][campo].trim()) && !campos.some(({ campo }) => erroresCliente[i]?.[campo])
  const completos = visibles.filter((_, i) => estaCompleto(i)).length

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="vueloId" value={vueloId} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="clase" value={clase} />
      <input type="hidden" name="cantidad" value={cantidad} />
      {regreso && <input type="hidden" name="regreso" value={regreso} />}
      {idaId && <input type="hidden" name="idaId" value={idaId} />}

      <div className="space-y-6">
        {state.error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
            {state.error}
          </div>
        )}

        {/* Cantidad de pasajes */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">¿Cuántos pasajes necesitás?</h3>
              <p className={`mt-1 text-sm ${cantidad >= maxPasajes ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                {maxPasajes < PASAJES_MAX
                  ? `Quedan ${maxPasajes} ${maxPasajes === 1 ? 'asiento disponible' : 'asientos disponibles'} en esta clase.`
                  : cantidad >= PASAJES_MAX
                    ? `Alcanzaste el máximo de ${PASAJES_MAX} pasajes por compra.`
                    : `Hasta ${PASAJES_MAX} pasajes en una misma transacción.`}
              </p>
            </div>

            <div className="flex items-center gap-1 self-start rounded-2xl border border-slate-200 bg-slate-50 p-1.5 sm:self-auto">
              <button
                type="button"
                onClick={() => setCantidad((c) => c - 1)}
                disabled={cantidad <= 1 || isPending}
                aria-label="Quitar un pasaje"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <output aria-live="polite" className="min-w-28 text-center">
                <span className="block text-2xl font-bold leading-none text-slate-900">{cantidad}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {cantidad === 1 ? 'pasaje' : 'pasajes'}
                </span>
              </output>
              <button
                type="button"
                onClick={() => setCantidad((c) => c + 1)}
                disabled={cantidad >= maxPasajes || isPending}
                aria-label="Agregar un pasaje"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-xl font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                +
              </button>
            </div>
          </div>
        </section>

        {/* Datos de cada pasajero */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Datos de los pasajeros</h3>
              <p className="mt-1 text-sm text-slate-500">Completá DNI, nombre, edad y teléfono de cada integrante.</p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
              {completos}/{cantidad} completos
            </span>
          </div>

          {visibles.map((pasajero, i) => {
            const completo = estaCompleto(i)
            return (
              <fieldset
                key={i}
                disabled={isPending}
                className={`rounded-[24px] border bg-white p-5 shadow-sm transition md:p-6 ${completo ? 'border-slate-200' : 'border-amber-200'}`}
              >
                <legend className="sr-only">Pasajero {i + 1}</legend>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{pasajero.nombre.trim() || `Pasajero ${i + 1}`}</p>
                      <p className="text-xs text-slate-500">
                        {i === 0 && !idaId
                          ? 'Precargado con tus datos'
                          : idaId && i < pasajerosIniciales.length
                            ? 'Mismos datos que en la ida'
                            : `Pasajero ${i + 1}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      completo ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {completo ? '✓ Completo' : 'Incompleto'}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {campos.map(({ campo, etiqueta }) => {
                    const id = `${campo}-${i}`
                    const error = errorDe(i, campo)
                    return (
                      <div key={campo}>
                        <label htmlFor={id} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
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
            )
          })}
        </section>
      </div>

      {/* Resumen lateral */}
      <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <h3 className="text-lg font-bold text-slate-900">Resumen de compra</h3>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Precio por pasajero</dt>
            <dd className="font-semibold text-slate-800">{precioUnitario !== null ? formatearPrecio(precioUnitario) : 'No disponible'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pasajes</dt>
            <dd className="font-semibold text-slate-800">× {cantidad}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
            <dt className="font-semibold text-slate-800">Total estimado</dt>
            <dd className="text-2xl font-bold text-sky-700">
              {precioUnitario !== null ? formatearPrecio(precioUnitario * cantidad) : '—'}
            </dd>
          </div>
        </dl>

        {faltantes.length > 0 ? (
          <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <p className="font-semibold">Faltan completar:</p>
            <ul className="mt-1 space-y-0.5">
              {faltantes.map((p) => (
                <li key={p.numero}>
                  Pasajero {p.numero}: {p.campos.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !validacion.ok && (
            <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
              Revisá los datos marcados en rojo para continuar.
            </p>
          )
        )}

        <button
          type="submit"
          disabled={isPending || !validacion.ok}
          className="mt-5 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Guardando...' : 'Continuar con la compra'}
        </button>
        <Link
          href={urlVolver}
          className="mt-3 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Volver
        </Link>
        <p className="mt-4 text-center text-xs text-slate-500">El pago se habilitará en el siguiente paso.</p>
      </aside>
    </form>
  )
}
