'use client'

import { useState } from 'react'

export default function BotonDescargaTicket({
  ticketId,
  checkInCompletado,
}: {
  ticketId: string | null
  checkInCompletado: boolean
}) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')

  if (!checkInCompletado) {
    return (
      <p role="status" className="max-w-xs text-right text-[11px] font-medium leading-tight text-amber-700">
        Completá el check-in antes de descargar el ticket electrónico.
      </p>
    )
  }

  if (!ticketId) {
    return (
      <p role="status" className="max-w-xs text-right text-[11px] font-medium leading-tight text-slate-500">
        El ticket electrónico todavía no está disponible.
      </p>
    )
  }

  const descargar = async () => {
    setError('')
    setDescargando(true)

    try {
      const response = await fetch(`/api/pasajero/tickets/${encodeURIComponent(ticketId)}`, {
        credentials: 'same-origin',
      })

      if (!response.ok) {
        let mensaje = 'No se pudo descargar el ticket electrónico.'
        try {
          const body = await response.json() as { error?: string }
          if (body.error) mensaje = body.error
        } catch {
          // Se conserva el mensaje general si el servidor no devuelve JSON.
        }
        setError(mensaje)
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
      const filename = filenameMatch?.[1] ?? `Ticket_${ticketId}.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar el ticket electrónico. Intentá nuevamente.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={descargar}
        disabled={descargando}
        className="rounded-lg bg-[#046A7A] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
      >
        {descargando ? 'Descargando...' : 'Descargar Ticket Electrónico'}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-xs text-right text-[11px] font-medium leading-tight text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}