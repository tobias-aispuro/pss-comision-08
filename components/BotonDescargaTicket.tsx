'use client'

import { useState, useEffect } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { TicketPDF } from './TicketPDF'

export default function BotonDescargaTicket({ reserva, pasajero, checkInCompletado }: { reserva: any, pasajero: any, checkInCompletado: boolean }) {
  const [errorValidacion, setErrorValidacion] = useState('')
  const [isClient, setIsClient] = useState(false)

  // Aseguramos que la librería de PDF solo se monte en el navegador
  useEffect(() => {
    setIsClient(true)
  }, [])

  const intentarDescarga = () => {
    if (!checkInCompletado) {
      setErrorValidacion('Es obligatorio completar el check-in previo para poder obtener el pasaje de embarque.')
    }
  }

  if (!isClient) return null // Evita errores de hidratación en Next.js

  return (
    <div className="flex flex-col items-end gap-2">
      {checkInCompletado ? (
        <PDFDownloadLink 
          document={<TicketPDF reserva={reserva} pasajero={pasajero} />} 
          fileName={`Ticket_${reserva.vuelo.codigoVuelo}_${pasajero.nombre.replace(/\s+/g, '_')}.pdf`}
        >
          {({ loading }) => (
            <button 
              className="rounded-lg bg-[#046A7A] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Generando PDF...' : 'Descargar Ticket Electrónico'}
            </button>
          )}
        </PDFDownloadLink>
      ) : (
        <button 
          onClick={intentarDescarga}
          className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-300"
        >
          Descargar Ticket Electrónico
        </button>
      )}

      {/* Cartel rojo del Escenario 2 */}
      {errorValidacion && (
        <p className="mt-1 max-w-xs text-right text-[11px] font-medium text-red-600 leading-tight">
          {errorValidacion}
        </p>
      )}
    </div>
  )
}