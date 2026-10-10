'use client'

import { useActionState, useEffect, useState } from 'react'
import { checkFlightCode, createFlight } from './actions'
import { getTodayISODate, validateFlightValues } from '@/lib/flight-utils'

const diasDisponibles = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const initialState = { errors: {} as Record<string, string> }
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-3 focus:ring-sky-100'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500'
const errorClass = 'mt-1.5 text-sm font-medium text-rose-700'

type CityOption = {
  label: string
  city: string
  region: string
  country: string
}

type FlightValues = {
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

type FlightFormState = {
  errors: Record<string, string>
  formError?: string
}

function CityAutocomplete({
  id,
  label,
  query,
  selected,
  error,
  onQueryChange,
  onSelect,
}: {
  id: string
  label: string
  query: string
  selected: CityOption | null
  error?: string
  onQueryChange: (value: string) => void
  onSelect: (city: CityOption | null) => void
}) {
  const [suggestions, setSuggestions] = useState<CityOption[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const search = query.trim()
    if (search.length < 2 || selected?.label === search) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }

    let current = true
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/ciudades?q=${encodeURIComponent(search)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('No se pudieron cargar ciudades')
        const results = (await response.json()) as CityOption[]
        if (current) {
          setSuggestions(results)
          setActiveIndex(0)
          setOpen(true)
        }
      } catch {
        if (current) {
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        if (current) setLoading(false)
      }
    }, 250)

    return () => {
      current = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query, selected])

  function choose(city: CityOption) {
    onSelect(city)
    onQueryChange(city.label)
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-suggestions`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value)
          onSelect(null)
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className={inputClass}
        placeholder="Escribe una ciudad"
      />
      {loading && <p className="mt-1.5 text-xs text-slate-500">Buscando ciudades...</p>}
      {!selected && query.trim().length >= 2 && !loading && (
        <p className={errorClass}>
          {suggestions.length > 0 ? 'Selecciona una ciudad de las sugerencias.' : 'No se encontraron ciudades con ese nombre.'}
        </p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((city, index) => (
            <li key={`${city.label}-${index}`} role="presentation">
              <button
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
                className={`w-full px-3.5 py-2.5 text-left text-sm transition ${index === activeIndex ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="font-semibold">{city.city}</span>
                <span className="ml-1 text-slate-500">{[city.region, city.country].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}

export default function NuevoVueloForm({ success }: { success: boolean }) {
  const [state, formAction, pending] = useActionState<FlightFormState, FormData>(createFlight, initialState)
  const [values, setValues] = useState<FlightValues>({
    codigoVuelo: '',
    origen: '',
    destino: '',
    diasOperacion: [],
    horaSalida: '',
    horaLlegada: '',
    periodoDesde: '',
    periodoHasta: '',
    tipoAvion: '',
  })
  const [originCity, setOriginCity] = useState<CityOption | null>(null)
  const [destinationCity, setDestinationCity] = useState<CityOption | null>(null)
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [attempted, setAttempted] = useState(false)
  const [duplicateCode, setDuplicateCode] = useState('')
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false)
  const [checkingCode, setCheckingCode] = useState(false)

  const today = getTodayISODate()
  const localErrors = validateFlightValues(values, today)
  const normalizedCode = values.codigoVuelo.trim().toUpperCase()

  useEffect(() => {
    if (!normalizedCode) {
      setDuplicateCode('')
      setDatabaseUnavailable(false)
      setCheckingCode(false)
      return
    }

    let current = true
    const timeout = setTimeout(async () => {
      setCheckingCode(true)
      try {
        const result = await checkFlightCode(normalizedCode)
        if (current) {
          setDuplicateCode(result.exists ? normalizedCode : '')
          setDatabaseUnavailable(result.unavailable)
        }
      } catch {
        if (current) {
          setDuplicateCode('')
          setDatabaseUnavailable(true)
        }
      } finally {
        if (current) setCheckingCode(false)
      }
    }, 350)

    return () => {
      current = false
      clearTimeout(timeout)
    }
  }, [normalizedCode])

  function setField<K extends keyof FlightValues>(field: K, value: FlightValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    setTouched((current) => new Set(current).add(field))
  }

  function visibleError(field: keyof FlightValues) {
    if (!attempted && !touched.has(field)) return undefined
    return localErrors[field] || (!touched.has(field) ? state.errors[field] : undefined)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setAttempted(true)
    const formErrors = validateFlightValues(values, today)
    const invalidCity = !originCity || !destinationCity
    const duplicate = duplicateCode === normalizedCode

    if (Object.keys(formErrors).length > 0 || invalidCity || duplicate || checkingCode) {
      event.preventDefault()
    }
  }

  const cityOriginError = visibleError('origen') || (attempted && !originCity ? 'Selecciona una ciudad de las sugerencias.' : undefined)
  const cityDestinationError = visibleError('destino') || (attempted && !destinationCity ? 'Selecciona una ciudad de las sugerencias.' : undefined)
  const codeError = (duplicateCode === normalizedCode && normalizedCode ? 'Ya existe un vuelo con ese código.' : undefined)
    || (databaseUnavailable ? 'No se pudo comprobar el código: revisa la conexión con la base de datos.' : undefined)
    || visibleError('codigoVuelo')

  return (
    <div className="min-h-screen bg-[#edf3f6] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-6 md:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Administración</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Crear nuevo vuelo</h1>
          </div>

          <form action={formAction} onSubmit={handleSubmit} className="space-y-7 p-6 md:p-8" noValidate>
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm" role="status">
                El vuelo fue creado correctamente.
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">1</span>
                  <h2 className="text-lg font-bold text-slate-800">Ruta e identificación</h2>
                </div>
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-sky-700">Requerido</span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="codigoVuelo" className={labelClass}>Código de vuelo</label>
                  <input
                    id="codigoVuelo"
                    name="codigoVuelo"
                    value={values.codigoVuelo}
                    onChange={(event) => setField('codigoVuelo', event.target.value)}
                    required
                    aria-invalid={Boolean(codeError)}
                    className={inputClass}
                    placeholder="AR123"
                  />
                  {checkingCode && <p className="mt-1.5 text-xs text-slate-500">Verificando código...</p>}
                  {codeError && <p className={errorClass}>{codeError}</p>}
                </div>

                <div>
                  <label htmlFor="tipoAvion" className={labelClass}>Tipo de avión</label>
                  <select
                    id="tipoAvion"
                    name="tipoAvion"
                    value={values.tipoAvion}
                    onChange={(event) => setField('tipoAvion', event.target.value)}
                    required
                    aria-invalid={Boolean(visibleError('tipoAvion'))}
                    className={inputClass}
                  >
                    <option value="">Seleccionar</option>
                    <option>Regional</option>
                    <option>Fuselaje Estrecho</option>
                    <option>Fuselaje Ancho</option>
                  </select>
                  {visibleError('tipoAvion') && <p className={errorClass}>{visibleError('tipoAvion')}</p>}
                </div>

                <CityAutocomplete
                  id="origen"
                  label="Ciudad de origen"
                  query={originQuery}
                  selected={originCity}
                  error={cityOriginError}
                  onQueryChange={setOriginQuery}
                  onSelect={(city) => {
                    setOriginCity(city)
                    setField('origen', city?.label ?? '')
                  }}
                />
                <input type="hidden" name="origen" value={originCity?.label ?? ''} />

                <CityAutocomplete
                  id="destino"
                  label="Ciudad de destino"
                  query={destinationQuery}
                  selected={destinationCity}
                  error={cityDestinationError}
                  onQueryChange={setDestinationQuery}
                  onSelect={(city) => {
                    setDestinationCity(city)
                    setField('destino', city?.label ?? '')
                  }}
                />
                <input type="hidden" name="destino" value={destinationCity?.label ?? ''} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">2</span>
                <h2 className="text-lg font-bold text-slate-800">Periodo y horarios</h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="periodoDesde" className={labelClass}>Disponibilidad anual</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <input
                          id="periodoDesde"
                          type="date"
                          name="periodoDesde"
                          min={today}
                          value={values.periodoDesde}
                          onChange={(event) => setField('periodoDesde', event.target.value)}
                          required
                          aria-label="Fecha de inicio del periodo"
                          aria-invalid={Boolean(visibleError('periodoDesde'))}
                          className={inputClass}
                        />
                        {visibleError('periodoDesde') && <p className={errorClass}>{visibleError('periodoDesde')}</p>}
                      </div>
                      <div>
                        <input
                          type="date"
                          name="periodoHasta"
                          min={values.periodoDesde || today}
                          value={values.periodoHasta}
                          onChange={(event) => setField('periodoHasta', event.target.value)}
                          required
                          aria-label="Fecha de fin del periodo"
                          aria-invalid={Boolean(visibleError('periodoHasta'))}
                          className={inputClass}
                        />
                        {visibleError('periodoHasta') && <p className={errorClass}>{visibleError('periodoHasta')}</p>}
                      </div>
                    </div>
                  </div>

                  <fieldset>
                    <legend className={labelClass}>Días de operación</legend>
                    <div className="grid grid-cols-7 gap-2">
                      {diasDisponibles.map((dia, index) => {
                        const dayValues = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
                        const selected = values.diasOperacion.includes(dayValues[index])
                        return (
                          <label key={dia} className="cursor-pointer">
                            <input
                              type="checkbox"
                              name="diasOperacion"
                              value={dayValues[index]}
                              checked={selected}
                              onChange={(event) => {
                                const nextDays = event.target.checked
                                  ? [...values.diasOperacion, dayValues[index]]
                                  : values.diasOperacion.filter((value) => value !== dayValues[index])
                                setField('diasOperacion', nextDays)
                              }}
                              className="peer sr-only"
                            />
                            <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-slate-600 shadow-sm transition peer-checked:border-sky-600 peer-checked:bg-sky-600 peer-checked:text-white peer-checked:shadow-md hover:border-sky-200 hover:bg-sky-50">
                              {dia}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {visibleError('diasOperacion') && <p className={errorClass}>{visibleError('diasOperacion')}</p>}
                  </fieldset>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <label htmlFor="horaSalida" className={labelClass}>Hora de salida</label>
                    <input
                      id="horaSalida"
                      type="time"
                      name="horaSalida"
                      value={values.horaSalida}
                      onChange={(event) => setField('horaSalida', event.target.value)}
                      required
                      aria-invalid={Boolean(visibleError('horaSalida'))}
                      className={inputClass}
                    />
                    {visibleError('horaSalida') && <p className={errorClass}>{visibleError('horaSalida')}</p>}
                  </div>

                  <div>
                    <label htmlFor="horaLlegada" className={labelClass}>Hora de llegada</label>
                    <input
                      id="horaLlegada"
                      type="time"
                      name="horaLlegada"
                      value={values.horaLlegada}
                      onChange={(event) => setField('horaLlegada', event.target.value)}
                      required
                      aria-invalid={Boolean(visibleError('horaLlegada'))}
                      className={inputClass}
                    />
                    {visibleError('horaLlegada') && <p className={errorClass}>{visibleError('horaLlegada')}</p>}
                  </div>
                </div>
              </div>
            </section>

            {state.formError && <p className={errorClass} role="alert">{state.formError}</p>}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={pending || checkingCode || databaseUnavailable || duplicateCode === normalizedCode && Boolean(normalizedCode)}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? 'Guardando...' : 'Guardar vuelo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}