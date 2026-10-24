'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  cancelarPorExpiracion,
  confirmarPagoCombinado,
  confirmarPagoSimulado,
} from './actions'
import {
  calcularMaximoTarjeta,
  calculateInstallmentAmount,
  formatearARS,
  formatearSegundosMMSS,
  MINUTOS_EXPIRACION_RESERVA,
  normalizarNumeroTarjeta,
  snapMontoTarjeta,
  validateCardDetails,
  validateMultiCardAmounts,
} from '@/lib/payment-utils'

type PaymentMethod = 'CREDITO' | 'DEBITO'
type ModalidadPago = 'INDIVIDUAL' | 'COMBINADO'

type CardFields = {
  numero: string
  titular: string
  vencimiento: string
  cvv: string
  tipoDocumento: string
  documento: string
}

type TarjetaCombinada = CardFields & {
  id: string
  monto: string
  metodo: PaymentMethod
  cuotas: number
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base sm:text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-3 focus:ring-sky-100'
const labelClass = 'mb-2 block text-sm font-semibold text-slate-700'
const errorClass = 'mt-1.5 text-sm font-medium text-rose-700'

const initialCard: CardFields = {
  numero: '',
  titular: '',
  vencimiento: '',
  cvv: '',
  tipoDocumento: 'DNI',
  documento: '',
}

function formatearVencimiento(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  if (digits.length === 2 && raw.includes('/')) {
    return `${digits}/`
  }
  return digits
}

let idCounter = 1

function generarIdTarjeta(): string {
  idCounter += 1
  return `tarjeta-${Date.now()}-${idCounter}`
}

function crearTarjetaVacia(id: string, montoInicial = ''): TarjetaCombinada {
  return {
    id,
    monto: montoInicial,
    metodo: 'CREDITO',
    cuotas: 1,
    numero: '',
    titular: '',
    vencimiento: '',
    cvv: '',
    tipoDocumento: 'DNI',
    documento: '',
  }
}

export default function PagoSimuladoForm({
  reservaId,
  idaId,
  total,
  segundosRestantes = MINUTOS_EXPIRACION_RESERVA * 60,
}: {
  reservaId: string
  idaId?: string
  total: number
  segundosRestantes?: number
}) {
  const [modalidad, setModalidad] = useState<ModalidadPago>('INDIVIDUAL')
  const [segundos, setSegundos] = useState(segundosRestantes)

  // Single card state
  const [card, setCard] = useState<CardFields>(initialCard)
  const [method, setMethod] = useState<PaymentMethod>('CREDITO')
  const [installments, setInstallments] = useState(1)

  // Multi card state
  const [tarjetas, setTarjetas] = useState<TarjetaCombinada[]>([
    crearTarjetaVacia('tarjeta-1'),
    crearTarjetaVacia('tarjeta-2'),
  ])
  const [usarMismosDatos, setUsarMismosDatos] = useState(false)
  const [tarjetaErrors, setTarjetaErrors] = useState<Record<number, Record<string, string>>>({})

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [sumaError, setSumaError] = useState('')
  const [isPending, startTransition] = useTransition()
  const haExpiradoRef = useRef(false)

  // Combined payment metrics
  const sumaAsignada = tarjetas.reduce(
    (acc, t) => acc + (Number(t.monto) || 0),
    0
  )
  const saldoPendiente = Math.round((total - sumaAsignada) * 100) / 100 || 0
  const mostrarAlertaSuma = Boolean(sumaError)

  useEffect(() => {
    if (segundos <= 0) {
      if (!haExpiradoRef.current) {
        haExpiradoRef.current = true
        startTransition(async () => {
          await cancelarPorExpiracion(reservaId, idaId)
        })
      }
      return
    }
    const timer = setInterval(() => {
      setSegundos((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [segundos, reservaId, idaId])

  function updateCard(field: keyof CardFields, value: string) {
    setCard((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setActionError('')
  }

  function handleSingleVencimientoChange(event: React.ChangeEvent<HTMLInputElement>) {
    updateCard('vencimiento', formatearVencimiento(event.target.value))
  }

  function handleToggleUsarMismosDatos(checked: boolean) {
    setUsarMismosDatos(checked)
    if (checked) {
      setTarjetas((current) => {
        const t0 = current[0]
        if (!t0) return current
        return current.map((t, idx) =>
          idx === 0
            ? t
            : {
                ...t,
                titular: t0.titular,
                tipoDocumento: t0.tipoDocumento,
                documento: t0.documento,
              }
        )
      })
      setTarjetaErrors((current) => {
        const updated = { ...current }
        Object.keys(updated).forEach((key) => {
          const idx = Number(key)
          if (idx > 0 && updated[idx]) {
            const copy = { ...updated[idx] }
            delete copy.titular
            delete copy.documento
            delete copy.tipoDocumento
            if (Object.keys(copy).length === 0) {
              delete updated[idx]
            } else {
              updated[idx] = copy
            }
          }
        })
        return updated
      })
    }
  }

  function updateTarjeta(
    index: number,
    field: keyof TarjetaCombinada,
    value: unknown
  ) {
    setTarjetas((current) => {
      return current.map((t, i) => {
        if (i === index) {
          return { ...t, [field]: value }
        }
        if (
          index === 0 &&
          usarMismosDatos &&
          (field === 'titular' || field === 'tipoDocumento' || field === 'documento')
        ) {
          return { ...t, [field]: value }
        }
        return t
      })
    })

    setTarjetaErrors((current) => {
      const updated = { ...current }
      if (updated[index] && updated[index][field as string]) {
        const copy = { ...updated[index] }
        delete copy[field as string]
        if (Object.keys(copy).length === 0) {
          delete updated[index]
        } else {
          updated[index] = copy
        }
      }
      if (
        index === 0 &&
        usarMismosDatos &&
        (field === 'titular' || field === 'tipoDocumento' || field === 'documento')
      ) {
        Object.keys(updated).forEach((key) => {
          const idx = Number(key)
          if (idx > 0 && updated[idx] && updated[idx][field as string]) {
            const copy = { ...updated[idx] }
            delete copy[field as string]
            if (Object.keys(copy).length === 0) {
              delete updated[idx]
            } else {
              updated[idx] = copy
            }
          }
        })
      }
      return updated
    })

    setActionError('')
    setSumaError('')
  }

  function agregarTarjeta() {
    setTarjetas((current) => {
      const nueva = crearTarjetaVacia(generarIdTarjeta())
      if (usarMismosDatos && current[0]) {
        nueva.titular = current[0].titular
        nueva.tipoDocumento = current[0].tipoDocumento
        nueva.documento = current[0].documento
      }
      return [...current, nueva]
    })
    setSumaError('')
  }

  function eliminarTarjeta(index: number) {
    if (tarjetas.length <= 2) return
    setTarjetas((current) => current.filter((_, i) => i !== index))
    setTarjetaErrors((current) => {
      const next: Record<number, Record<string, string>> = {}
      let targetIdx = 0
      for (let i = 0; i < tarjetas.length; i++) {
        if (i === index) continue
        if (current[i]) {
          next[targetIdx] = current[i]
        }
        targetIdx++
      }
      return next
    })
    setSumaError('')
  }

  function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Si el tiempo venció, se cancela la reserva antes de enviar el pago a la pasarela
    if (segundos <= 0) {
      if (!haExpiradoRef.current) {
        haExpiradoRef.current = true
        startTransition(async () => {
          await cancelarPorExpiracion(reservaId, idaId)
        })
      }
      return
    }

    if (modalidad === 'COMBINADO') {
      const validacionMontos = validateMultiCardAmounts(
        tarjetas.map((t) => ({ ...t, monto: Number(t.monto) || 0 })),
        total
      )
      if (!validacionMontos.ok) {
        setSumaError(validacionMontos.error!)
        return
      }

      if (!acceptedTerms) {
        setErrors({ terms: 'Aceptá las condiciones para continuar.' })
        return
      }

      // Propagate data from card 1 if checkbox is active
      const tarjetasFinales = tarjetas.map((t, idx) => {
        if (idx > 0 && usarMismosDatos) {
          return {
            ...t,
            titular: tarjetas[0].titular,
            tipoDocumento: tarjetas[0].tipoDocumento,
            documento: tarjetas[0].documento,
          }
        }
        return t
      })

      // Client-side validation
      const today = new Date().toISOString().slice(0, 7)
      const newTarjetaErrors: Record<number, Record<string, string>> = {}
      let hayErrores = false

      tarjetasFinales.forEach((t, idx) => {
        const errs = validateCardDetails(
          {
            ...t,
            monto: Number(t.monto) || 0,
            cuotas: Number(t.cuotas) || 1,
          },
          today
        )
        if (usarMismosDatos && idx > 0) {
          delete errs.titular
          delete errs.tipoDocumento
          delete errs.documento
        }
        if (Object.keys(errs).length > 0) {
          newTarjetaErrors[idx] = errs
          hayErrores = true
        }
      })

      if (hayErrores) {
        setTarjetaErrors(newTarjetaErrors)
        setActionError(
          'Una o más tarjetas contienen datos inválidos. Por favor, revisá los campos señalados.'
        )
        return
      }

      setActionError('')
      setSumaError('')
      setTarjetaErrors({})

      startTransition(async () => {
        const result = await confirmarPagoCombinado({
          reservaId,
          idaId,
          usarMismosDatos,
          tarjetas: tarjetasFinales.map((t) => ({
            monto: Number(t.monto) || 0,
            metodo: t.metodo,
            cuotas: t.cuotas,
            numero: t.numero,
            titular: t.titular,
            vencimiento: t.vencimiento,
            cvv: t.cvv,
            tipoDocumento: t.tipoDocumento,
            documento: t.documento,
          })),
          tiempoExpirado: segundos <= 0,
        })
        if (result?.error) {
          setActionError(result.error)
          if (result.tarjetaErrors) {
            const serverErrors = { ...result.tarjetaErrors }
            if (usarMismosDatos) {
              Object.keys(serverErrors).forEach((key) => {
                const idx = Number(key)
                if (idx > 0 && serverErrors[idx]) {
                  const copy = { ...serverErrors[idx] }
                  delete copy.titular
                  delete copy.tipoDocumento
                  delete copy.documento
                  if (Object.keys(copy).length === 0) {
                    delete serverErrors[idx]
                  } else {
                    serverErrors[idx] = copy
                  }
                }
              })
            }
            setTarjetaErrors(serverErrors)
          }
        }
      })
      return
    }

    // Modalidad individual (una sola tarjeta)
    const today = new Date().toISOString().slice(0, 7)
    const nextErrors: Record<string, string> = validateCardDetails(
      { ...card, metodo: method, cuotas: installments },
      today
    )
    if (!acceptedTerms) nextErrors.terms = 'Aceptá las condiciones para continuar.'
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    setActionError('')
    startTransition(async () => {
      const result = await confirmarPagoSimulado({
        reservaId,
        idaId,
        metodo: method,
        cuotas: installments,
        tiempoExpirado: segundos <= 0,
      })
      if (result?.error) setActionError(result.error)
    })
  }

  const displayedCardNumber = normalizarNumeroTarjeta(card.numero)
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim()

  return (
    <form onSubmit={submitPayment} noValidate className="space-y-6">
      {/* Contador de tiempo */}
      <div
        role="timer"
        aria-live="polite"
        aria-atomic="true"
        className={`flex items-center justify-between rounded-xl border p-3.5 text-sm transition ${
          segundos <= 60
            ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">⏱</span>
          <span className="font-semibold">Tiempo para completar el pago</span>
        </div>
        <span
          className={`font-mono text-base font-bold ${
            segundos === 0
              ? 'text-rose-700'
              : segundos <= 60
              ? 'text-amber-700 animate-pulse'
              : 'text-slate-900'
          }`}
        >
          {formatearSegundosMMSS(segundos)}
          {segundos === 0 && ' (Expirado)'}
        </span>
      </div>

      {/* Selector de Modalidad de Pago */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-700">
          Modalidad de pago
        </label>
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Modalidad de pago"
        >
          <label className="cursor-pointer">
            <input
              type="radio"
              name="modalidadPago"
              value="INDIVIDUAL"
              checked={modalidad === 'INDIVIDUAL'}
              onChange={() => {
                setModalidad('INDIVIDUAL')
                setSumaError('')
                setActionError('')
              }}
              className="peer sr-only"
            />
            <span className="block rounded-xl border border-slate-200 bg-white p-4 transition peer-checked:border-sky-700 peer-checked:bg-sky-50 peer-checked:shadow-sm">
              <span className="block font-bold text-slate-800">
                Una sola tarjeta
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Abonar el monto total con una tarjeta de crédito o débito
              </span>
            </span>
          </label>

          <label className="cursor-pointer">
            <input
              type="radio"
              name="modalidadPago"
              value="COMBINADO"
              checked={modalidad === 'COMBINADO'}
              onChange={() => {
                setModalidad('COMBINADO')
                setTarjetas((curr) =>
                  curr.length < 2
                    ? [
                        curr[0] || crearTarjetaVacia('tarjeta-1'),
                        crearTarjetaVacia(generarIdTarjeta()),
                      ]
                    : curr
                )
                setSumaError('')
                setActionError('')
              }}
              className="peer sr-only"
            />
            <span className="block rounded-xl border border-slate-200 bg-white p-4 transition peer-checked:border-sky-700 peer-checked:bg-sky-50 peer-checked:shadow-sm">
              <span className="block font-bold text-slate-800">
                Pago Combinado con Múltiples Tarjetas
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Dividir el total entre dos o más tarjetas
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Flujo Individual */}
      {modalidad === 'INDIVIDUAL' && (
        <div className="space-y-5">
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Medio de pago"
          >
            {([
              ['CREDITO', 'Crédito', 'Una o varias cuotas'],
              ['DEBITO', 'Débito', 'Un solo pago'],
            ] as const).map(([value, title, description]) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="medioVisual"
                  value={value}
                  checked={method === value}
                  onChange={() => {
                    setMethod(value)
                    if (value === 'DEBITO') setInstallments(1)
                    setErrors((current) => ({
                      ...current,
                      metodo: '',
                      cuotas: '',
                    }))
                  }}
                  className="peer sr-only"
                />
                <span className="block rounded-xl border border-slate-200 bg-white p-4 transition peer-checked:border-sky-700 peer-checked:bg-sky-50 peer-checked:shadow-sm">
                  <span className="block font-bold text-slate-800">{title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {errors.metodo && <p className={errorClass}>{errors.metodo}</p>}

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-bold text-slate-800">
              Datos de la tarjeta
            </h2>

            <div>
              <label htmlFor="numeroTarjeta" className={labelClass}>
                Número de tarjeta
              </label>
              <input
                id="numeroTarjeta"
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={displayedCardNumber}
                onChange={(event) => updateCard('numero', event.target.value)}
                maxLength={23}
                placeholder="0000 0000 0000 0000"
                aria-invalid={Boolean(errors.numero)}
                className={inputClass}
              />
              {errors.numero && <p className={errorClass}>{errors.numero}</p>}
            </div>

            <div>
              <label htmlFor="titularTarjeta" className={labelClass}>
                Nombre y apellido del titular
              </label>
              <input
                id="titularTarjeta"
                type="text"
                autoComplete="cc-name"
                value={card.titular}
                onChange={(event) => updateCard('titular', event.target.value)}
                maxLength={80}
                placeholder="Como figura en la tarjeta"
                aria-invalid={Boolean(errors.titular)}
                className={inputClass}
              />
              {errors.titular && <p className={errorClass}>{errors.titular}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="vencimientoTarjeta" className={labelClass}>
                  Fecha de vencimiento
                </label>
                <input
                  id="vencimientoTarjeta"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  maxLength={5}
                  value={card.vencimiento}
                  onChange={handleSingleVencimientoChange}
                  aria-invalid={Boolean(errors.vencimiento)}
                  className={inputClass}
                />
                {errors.vencimiento && (
                  <p className={errorClass}>{errors.vencimiento}</p>
                )}
              </div>
              <div>
                <label htmlFor="cvvTarjeta" className={labelClass}>
                  Código de seguridad (CVV)
                </label>
                <input
                  id="cvvTarjeta"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={card.cvv}
                  onChange={(event) =>
                    updateCard(
                      'cvv',
                      event.target.value.replace(/\D/g, '').slice(0, 4)
                    )
                  }
                  maxLength={4}
                  placeholder="3 o 4 dígitos"
                  aria-invalid={Boolean(errors.cvv)}
                  className={inputClass}
                />
                {errors.cvv && <p className={errorClass}>{errors.cvv}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
              <div>
                <label htmlFor="tipoDocumento" className={labelClass}>
                  Documento
                </label>
                <select
                  id="tipoDocumento"
                  value={card.tipoDocumento}
                  onChange={(event) =>
                    updateCard('tipoDocumento', event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="DNI">DNI</option>
                  <option value="NIF">NIF</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
                {errors.tipoDocumento && (
                  <p className={errorClass}>{errors.tipoDocumento}</p>
                )}
              </div>
              <div>
                <label htmlFor="documentoTitular" className={labelClass}>
                  Número de documento del titular
                </label>
                <input
                  id="documentoTitular"
                  type="text"
                  value={card.documento}
                  onChange={(event) =>
                    updateCard('documento', event.target.value)
                  }
                  maxLength={20}
                  placeholder="Número de documento"
                  aria-invalid={Boolean(errors.documento)}
                  className={inputClass}
                />
                {errors.documento && (
                  <p className={errorClass}>{errors.documento}</p>
                )}
              </div>
            </div>

            {method === 'CREDITO' && (
              <fieldset>
                <legend className={`${labelClass} mb-3`}>Plan de cuotas</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[1, 3, 6].map((count) => (
                    <label key={count} className="cursor-pointer">
                      <input
                        type="radio"
                        name="cuotasVisual"
                        value={count}
                        checked={installments === count}
                        onChange={() => {
                          setInstallments(count)
                          setErrors((current) => ({ ...current, cuotas: '' }))
                        }}
                        className="peer sr-only"
                      />
                      <span className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition peer-checked:border-sky-600 peer-checked:bg-sky-50">
                        <span className="block text-sm font-bold text-slate-800">
                          {count === 1 ? '1 pago' : `${count} cuotas`}
                        </span>
                        <span className="mt-1 block text-xs font-semibold text-sky-800">
                          {formatearARS(
                            calculateInstallmentAmount(total, count)
                          )}{' '}
                          / pago
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors.cuotas && <p className={errorClass}>{errors.cuotas}</p>}
              </fieldset>
            )}
            {method === 'DEBITO' && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-600">
                El pago con débito se realiza en un solo pago de{' '}
                {formatearARS(total)}.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Flujo Pago Combinado con Múltiples Tarjetas */}
      {modalidad === 'COMBINADO' && (
        <div className="space-y-6">
          {/* Indicadores de Monto total a cubrir y Saldo pendiente por asignar */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Monto total a cubrir
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
                  {formatearARS(total)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Saldo pendiente por asignar
                </p>
                <p
                  className={`mt-1 text-xl sm:text-2xl font-bold ${
                    saldoPendiente === 0
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {formatearARS(Math.max(0, saldoPendiente))}
                </p>
              </div>
            </div>

            {saldoPendiente > 0 && (
              <div
                role="status"
                className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-amber-900"
              >
                <span aria-hidden="true">⚠️</span>
                <span>
                  Faltan {formatearARS(saldoPendiente)} para cubrir el 100% del total.
                </span>
              </div>
            )}

            {saldoPendiente === 0 && (
              <div
                role="status"
                className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-emerald-800"
              >
                <span aria-hidden="true">✓</span>
                <span>Monto total asignado en su totalidad (100%).</span>
              </div>
            )}
          </section>

          {/* Alerta en rojo si la suma no es exactamente igual al total */}
          {mostrarAlertaSuma && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800 shadow-sm"
            >
              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                ✕
              </span>
              <p className="flex-1">{sumaError}</p>
            </div>
          )}

          {/* Checkmark: Usar los mismos datos para todas las tarjetas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                id="usarMismosDatos"
                type="checkbox"
                checked={usarMismosDatos}
                onChange={(e) => handleToggleUsarMismosDatos(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500 cursor-pointer"
              />
              <div>
                <span className="block text-sm font-bold text-slate-800 select-none">
                  Usar los mismos datos para todas las tarjetas
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 select-none">
                  El Documento, el número de documento y el nombre y apellido del titular se ponen una sola vez en la primera tarjeta y se usan para todas las tarjetas.
                </span>
              </div>
            </label>
          </div>

          {/* Lista de Tarjetas */}
          <div className="space-y-5">
            {tarjetas.map((tarjeta, index) => {
              const formattedNumber = normalizarNumeroTarjeta(tarjeta.numero)
                .slice(0, 19)
                .replace(/(.{4})/g, '$1 ')
                .trim()
              const montoNum = Number(tarjeta.monto) || 0
              const hasCardErrors = Boolean(tarjetaErrors[index] && Object.keys(tarjetaErrors[index]).length > 0)

              return (
                <section
                  key={tarjeta.id}
                  className={`space-y-4 rounded-2xl border bg-white p-4 sm:p-5 shadow-sm transition ${
                    hasCardErrors ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">
                        Tarjeta {index + 1}
                      </h3>
                      {hasCardErrors && (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          Revisar datos
                        </span>
                      )}
                    </div>
                    {tarjetas.length > 2 && (
                      <button
                        type="button"
                        onClick={() => eliminarTarjeta(index)}
                        className="text-xs font-semibold text-rose-700 hover:text-rose-800 hover:underline"
                      >
                        ✕ Eliminar tarjeta
                      </button>
                    )}
                  </div>

                  {/* Monto parcial y Medio */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor={`monto-${index}`} className={labelClass}>
                          Monto parcial a abonar
                        </label>
                        {(() => {
                          const maxPermitido = calcularMaximoTarjeta(index, tarjetas, total)
                          if (maxPermitido > 0 && Number(tarjeta.monto) !== maxPermitido) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  const valorSnap = Number.isInteger(maxPermitido)
                                    ? String(maxPermitido)
                                    : String(Math.round(maxPermitido * 100) / 100)
                                  updateTarjeta(index, 'monto', valorSnap)
                                }}
                                className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
                              >
                                Completar restante ({formatearARS(maxPermitido)})
                              </button>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-bold text-slate-500">
                          $
                        </span>
                        <input
                          id={`monto-${index}`}
                          type="text"
                          inputMode="decimal"
                          maxLength={50}
                          value={tarjeta.monto}
                          onKeyDown={(e) => {
                            if (
                              e.key.length > 1 ||
                              e.ctrlKey ||
                              e.metaKey ||
                              e.altKey
                            ) {
                              return
                            }
                            if (!/[\d,.]/.test(e.key)) {
                              e.preventDefault()
                              return
                            }
                            if (
                              (e.key === '.' || e.key === ',') &&
                              tarjeta.monto.includes('.')
                            ) {
                              e.preventDefault()
                            }
                          }}
                          onChange={(e) => {
                            const valorSnap = snapMontoTarjeta(
                              index,
                              e.target.value,
                              tarjetas,
                              total
                            )
                            updateTarjeta(index, 'monto', valorSnap)
                          }}
                          onBlur={() => {
                            let val = tarjeta.monto
                            if (val.endsWith('.')) {
                              val = val.slice(0, -1)
                            }
                            const valorSnap = snapMontoTarjeta(
                              index,
                              val,
                              tarjetas,
                              total
                            )
                            if (valorSnap !== tarjeta.monto) {
                              updateTarjeta(index, 'monto', valorSnap)
                            }
                          }}
                          placeholder="Monto parcial"
                          className={`${inputClass} pl-8 font-semibold`}
                        />
                      </div>
                    </div>

                    <div>
                      <span className={labelClass}>Tipo de tarjeta</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateTarjeta(index, 'metodo', 'CREDITO')}
                          className={`rounded-xl border p-3 text-sm font-bold transition ${
                            tarjeta.metodo === 'CREDITO'
                              ? 'border-sky-600 bg-sky-50 text-sky-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Crédito
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateTarjeta(index, 'metodo', 'DEBITO')
                            updateTarjeta(index, 'cuotas', 1)
                          }}
                          className={`rounded-xl border p-3 text-sm font-bold transition ${
                            tarjeta.metodo === 'DEBITO'
                              ? 'border-sky-600 bg-sky-50 text-sky-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Débito
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cuotas si es crédito */}
                  {tarjeta.metodo === 'CREDITO' && (
                    <div>
                      <span className={`${labelClass} text-xs`}>Plan de cuotas</span>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {[1, 3, 6].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => updateTarjeta(index, 'cuotas', count)}
                            className={`rounded-xl border p-2.5 text-left transition ${
                              tarjeta.cuotas === count
                                ? 'border-sky-600 bg-sky-50'
                                : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <span className="block text-xs font-bold text-slate-800">
                              {count === 1 ? '1 pago' : `${count} cuotas`}
                            </span>
                            <span className="block text-[11px] font-semibold text-sky-800">
                              {formatearARS(
                                calculateInstallmentAmount(montoNum, count)
                              )}{' '}
                              / pago
                            </span>
                          </button>
                        ))}
                      </div>
                      {tarjetaErrors[index]?.cuotas && (
                        <p className={errorClass}>{tarjetaErrors[index].cuotas}</p>
                      )}
                    </div>
                  )}

                  {/* Datos del plástico */}
                  <div>
                    <label
                      htmlFor={`numeroTarjeta-${index}`}
                      className={labelClass}
                    >
                      Número de tarjeta
                    </label>
                    <input
                      id={`numeroTarjeta-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={formattedNumber}
                      onChange={(e) =>
                        updateTarjeta(index, 'numero', e.target.value)
                      }
                      maxLength={23}
                      placeholder="0000 0000 0000 0000"
                      aria-invalid={Boolean(tarjetaErrors[index]?.numero)}
                      className={`${inputClass} ${tarjetaErrors[index]?.numero ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200' : ''}`}
                    />
                    {tarjetaErrors[index]?.numero && (
                      <p className={errorClass}>{tarjetaErrors[index].numero}</p>
                    )}
                  </div>

                  {/* Titular: Input editable si es tarjeta 1 o modo sin unificar, o aviso si es tarjeta 2+ con datos unificados */}
                  {usarMismosDatos && index > 0 ? (
                    <div
                      role="status"
                      className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-800 transition"
                    >
                      <span aria-hidden="true" className="shrink-0 text-base">
                        ℹ️
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold">
                          Datos del titular compartidos con Tarjeta 1
                        </p>
                        <p className="mt-0.5 text-slate-600">
                          {tarjetas[0].titular ? (
                            <>
                              <span className="font-medium text-slate-800">{tarjetas[0].titular}</span>
                              {' • '}
                              <span>{tarjetas[0].tipoDocumento}</span> {tarjetas[0].documento || '(sin número)'}
                            </>
                          ) : (
                            'Se aplicarán el titular y documento ingresados en la Tarjeta 1.'
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor={`titularTarjeta-${index}`}
                        className={labelClass}
                      >
                        Nombre y apellido del titular
                      </label>
                      <input
                        id={`titularTarjeta-${index}`}
                        type="text"
                        autoComplete="cc-name"
                        value={tarjeta.titular}
                        onChange={(e) =>
                          updateTarjeta(index, 'titular', e.target.value)
                        }
                        maxLength={80}
                        placeholder="Como figura en la tarjeta"
                        aria-invalid={Boolean(tarjetaErrors[index]?.titular)}
                        className={`${inputClass} ${tarjetaErrors[index]?.titular ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200' : ''}`}
                      />
                      {tarjetaErrors[index]?.titular && (
                        <p className={errorClass}>{tarjetaErrors[index].titular}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`vencimientoTarjeta-${index}`}
                        className={labelClass}
                      >
                        Fecha de vencimiento
                      </label>
                      <input
                        id={`vencimientoTarjeta-${index}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM/AA"
                        maxLength={5}
                        value={tarjeta.vencimiento}
                        onChange={(e) =>
                          updateTarjeta(
                            index,
                            'vencimiento',
                            formatearVencimiento(e.target.value)
                          )
                        }
                        aria-invalid={Boolean(tarjetaErrors[index]?.vencimiento)}
                        className={`${inputClass} ${tarjetaErrors[index]?.vencimiento ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200' : ''}`}
                      />
                      {tarjetaErrors[index]?.vencimiento && (
                        <p className={errorClass}>{tarjetaErrors[index].vencimiento}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor={`cvvTarjeta-${index}`} className={labelClass}>
                        Código de seguridad (CVV)
                      </label>
                      <input
                        id={`cvvTarjeta-${index}`}
                        type="password"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={tarjeta.cvv}
                        onChange={(e) =>
                          updateTarjeta(
                            index,
                            'cvv',
                            e.target.value.replace(/\D/g, '').slice(0, 4)
                          )
                        }
                        maxLength={4}
                        placeholder="3 o 4 dígitos"
                        aria-invalid={Boolean(tarjetaErrors[index]?.cvv)}
                        className={`${inputClass} ${tarjetaErrors[index]?.cvv ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200' : ''}`}
                      />
                      {tarjetaErrors[index]?.cvv && (
                        <p className={errorClass}>{tarjetaErrors[index].cvv}</p>
                      )}
                    </div>
                  </div>

                  {/* Documento y Número de documento si no están unificados con Tarjeta 1 */}
                  {(!usarMismosDatos || index === 0) && (
                    <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                      <div>
                        <label
                          htmlFor={`tipoDocumento-${index}`}
                          className={labelClass}
                        >
                          Documento
                        </label>
                        <select
                          id={`tipoDocumento-${index}`}
                          value={tarjeta.tipoDocumento}
                          onChange={(e) =>
                            updateTarjeta(index, 'tipoDocumento', e.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="DNI">DNI</option>
                          <option value="NIF">NIF</option>
                          <option value="PASAPORTE">Pasaporte</option>
                        </select>
                        {tarjetaErrors[index]?.tipoDocumento && (
                          <p className={errorClass}>{tarjetaErrors[index].tipoDocumento}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor={`documentoTitular-${index}`}
                          className={labelClass}
                        >
                          Número de documento del titular
                        </label>
                        <input
                          id={`documentoTitular-${index}`}
                          type="text"
                          value={tarjeta.documento}
                          onChange={(e) =>
                            updateTarjeta(index, 'documento', e.target.value)
                          }
                          maxLength={20}
                          placeholder="Número de documento"
                          aria-invalid={Boolean(tarjetaErrors[index]?.documento)}
                          className={`${inputClass} ${tarjetaErrors[index]?.documento ? 'border-rose-500 bg-rose-50/30 ring-1 ring-rose-200' : ''}`}
                        />
                        {tarjetaErrors[index]?.documento && (
                          <p className={errorClass}>{tarjetaErrors[index].documento}</p>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          {/* Botón para agregar tarjetas adicionales */}
          <button
            type="button"
            onClick={agregarTarjeta}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400 bg-sky-50/50 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span aria-hidden="true">+</span>
            <span>Agregar otra tarjeta</span>
          </button>
        </div>
      )}

      {/* Términos y seguridad */}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked)
              setErrors((current) => ({ ...current, terms: '' }))
            }}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
          />
          <span>
            Acepto las condiciones de compra y confirmo que los datos ingresados
            son correctos.
          </span>
        </label>
        {errors.terms && <p className={errorClass}>{errors.terms}</p>}
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          <span aria-hidden="true">🔒</span>
          <span>
            Transacción protegida con cifrado y protocolos de seguridad bancaria.
          </span>
        </p>
      </div>

      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700"
          >
            ✕
          </span>
          <p className="flex-1">{actionError}</p>
        </div>
      )}

      {/* Botón Confirmar Pago */}
      <button
        type="submit"
        disabled={isPending || segundos <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#006b7b] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005866] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {segundos <= 0 ? 'Tiempo expirado' : isPending ? 'Procesando pago...' : 'Confirmar Pago'}
      </button>
    </form>
  )
}
