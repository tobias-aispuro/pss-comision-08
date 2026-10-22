'use client'

import { useEffect, useState, useTransition } from 'react'
import { cancelarPorExpiracion, confirmarPagoSimulado } from './actions'
import {
  calculateInstallmentAmount,
  formatearARS,
  formatearSegundosMMSS,
  normalizarNumeroTarjeta,
  validateCardDetails,
} from '@/lib/payment-utils'

type PaymentMethod = 'CREDITO' | 'DEBITO'

type CardFields = {
  numero: string
  titular: string
  vencimiento: string
  cvv: string
  tipoDocumento: string
  documento: string
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-[#f1f2ff] px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-3 focus:ring-sky-100'
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

export default function PagoSimuladoForm({
  reservaId,
  idaId,
  total,
  segundosRestantes = 180,
}: {
  reservaId: string
  idaId?: string
  total: number
  segundosRestantes?: number
}) {
  const [segundos, setSegundos] = useState(segundosRestantes)
  const [card, setCard] = useState(initialCard)
  const [method, setMethod] = useState<PaymentMethod>('CREDITO')
  const [installments, setInstallments] = useState(1)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (segundos <= 0) {
      startTransition(async () => {
        await cancelarPorExpiracion(reservaId, idaId)
      })
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

  function handleVencimientoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    let formatted = digits
    if (digits.length >= 3) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`
    } else if (digits.length === 2 && raw.includes('/')) {
      formatted = `${digits}/`
    }
    updateCard('vencimiento', formatted)
  }

  function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (segundos <= 0) {
      startTransition(async () => {
        await cancelarPorExpiracion(reservaId, idaId)
      })
      return
    }
    const today = new Date().toISOString().slice(0, 7)
    const nextErrors: Record<string, string> = validateCardDetails({ ...card, metodo: method, cuotas: installments }, today)
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

  const displayedCardNumber = normalizarNumeroTarjeta(card.numero).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()

  return (
    <form onSubmit={submitPayment} noValidate className="space-y-5">
      <div className={`flex items-center justify-between rounded-xl border p-3.5 text-sm ${segundos <= 60 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        <div className="flex items-center gap-2">
          <span>⏱</span>
          <span className="font-semibold">Tiempo para completar el pago</span>
        </div>
        <span className={`font-mono text-base font-bold ${segundos <= 60 ? 'text-amber-700' : 'text-slate-800'}`}>
          {formatearSegundosMMSS(segundos)}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Medio de pago">
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
                setErrors((current) => ({ ...current, metodo: '', cuotas: '' }))
              }}
              className="peer sr-only"
            />
            <span className="block rounded-xl border border-slate-200 bg-white p-4 transition peer-checked:border-sky-700 peer-checked:bg-sky-50 peer-checked:shadow-sm">
              <span className="block font-bold text-slate-800">{title}</span>
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.metodo && <p className={errorClass}>{errors.metodo}</p>}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-800">Datos de la tarjeta</h2>
        <div>
          <label htmlFor="numeroTarjeta" className={labelClass}>Número de tarjeta</label>
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
          <label htmlFor="titularTarjeta" className={labelClass}>Nombre y apellido del titular</label>
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
            <label htmlFor="vencimientoTarjeta" className={labelClass}>Fecha de vencimiento</label>
            <input
              id="vencimientoTarjeta"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              maxLength={5}
              value={card.vencimiento}
              onChange={handleVencimientoChange}
              aria-invalid={Boolean(errors.vencimiento)}
              className={inputClass}
            />
            {errors.vencimiento && <p className={errorClass}>{errors.vencimiento}</p>}
          </div>
          <div>
            <label htmlFor="cvvTarjeta" className={labelClass}>Código de seguridad (CVV)</label>
            <input
              id="cvvTarjeta"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={card.cvv}
              onChange={(event) => updateCard('cvv', event.target.value.replace(/\D/g, '').slice(0, 4))}
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
            <label htmlFor="tipoDocumento" className={labelClass}>Documento</label>
            <select
              id="tipoDocumento"
              value={card.tipoDocumento}
              onChange={(event) => updateCard('tipoDocumento', event.target.value)}
              className={inputClass}
            >
              <option value="DNI">DNI</option>
              <option value="NIF">NIF</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
            {errors.tipoDocumento && <p className={errorClass}>{errors.tipoDocumento}</p>}
          </div>
          <div>
            <label htmlFor="documentoTitular" className={labelClass}>Número de documento del titular</label>
            <input
              id="documentoTitular"
              type="text"
              value={card.documento}
              onChange={(event) => updateCard('documento', event.target.value)}
              maxLength={20}
              placeholder="Número de documento"
              aria-invalid={Boolean(errors.documento)}
              className={inputClass}
            />
            {errors.documento && <p className={errorClass}>{errors.documento}</p>}
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
                  <span className="block rounded-xl border border-slate-200 bg-[#f1f2ff] p-3 transition peer-checked:border-sky-600 peer-checked:bg-sky-50">
                    <span className="block text-sm font-bold text-slate-800">{count === 1 ? '1 pago' : `${count} cuotas`}</span>
                    <span className="mt-1 block text-xs font-semibold text-sky-800">
                      {formatearARS(calculateInstallmentAmount(total, count))} / pago
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {errors.cuotas && <p className={errorClass}>{errors.cuotas}</p>}
          </fieldset>
        )}
        {method === 'DEBITO' && (
          <div className="rounded-xl bg-[#f1f2ff] p-3 text-sm font-medium text-slate-600">
            El pago con débito se realiza en un solo pago de {formatearARS(total)}.
          </div>
        )}
      </section>

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
          <span>Acepto las condiciones de compra y confirmo que los datos ingresados son correctos.</span>
        </label>
        {errors.terms && <p className={errorClass}>{errors.terms}</p>}
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
          Simulación de pago: el número de tarjeta y el CVV se validan en esta pantalla, pero no se envían ni se guardan.
        </p>
      </div>

      {actionError && <p role="alert" className={errorClass}>{actionError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#006b7b] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005866] disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? 'Procesando simulación...' : `Pagar ${formatearARS(total)}`}
      </button>
    </form>
  )
}
