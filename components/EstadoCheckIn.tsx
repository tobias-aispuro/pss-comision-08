'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { evaluarCheckIn } from '@/lib/check-in-utils'

type Props = {
  reservaId: string
  fecha: string
  estado: string
  vuelo: { horaSalida: string; zonaOrigen: string | null; activo: boolean }
  cancelado: boolean
  ahora: number
  acceso?: boolean
  children?: ReactNode
}

export default function EstadoCheckIn({ reservaId, fecha, estado, vuelo, cancelado, ahora, acceso = false, children }: Props) {
  const [instante, setInstante] = useState(ahora)

  useEffect(() => {
    // El reloj del servidor es la referencia; el reloj del dispositivo no decide el acceso.
    const inicio = performance.now()
    const actualizar = () => setInstante(ahora + performance.now() - inicio)
    const timer = window.setInterval(actualizar, 1000)
    window.addEventListener('focus', actualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', actualizar)
    }
  }, [ahora])

  const evaluacion = evaluarCheckIn({ reserva: { fecha, estado }, vuelo, cancelado }, instante)
  const formato = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: vuelo.zonaOrigen || 'America/Argentina/Buenos_Aires',
  })
  const boton = 'inline-block rounded-xl px-5 py-2.5 text-sm font-semibold'

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <div role={evaluacion.estado === 'VENCIDO' ? 'alert' : 'status'} className={evaluacion.ok ? 'text-sm text-emerald-700' : 'text-sm text-amber-800'}>
        <p>{evaluacion.mensaje}</p>
        {evaluacion.estado === 'ANTICIPADO' && evaluacion.apertura !== undefined && (
          <p className="mt-1">Se habilitará el {formato.format(evaluacion.apertura)} (hora del aeropuerto de origen).</p>
        )}
        {evaluacion.ok && evaluacion.cierre !== undefined && (
          <p className="mt-1">Disponible hasta el {formato.format(evaluacion.cierre)} (hora del aeropuerto de origen).</p>
        )}
      </div>
      {evaluacion.ok ? (
        acceso ? (
          children ?? <p className="rounded-xl bg-emerald-50 p-4 font-medium text-emerald-800">Podés continuar con el proceso de check-in.</p>
        ) : (
          <Link href={`/pasajero/check-in/${reservaId}`} prefetch={false} className={`${boton} bg-sky-700 text-white hover:bg-sky-800`}>
            Realizar Check-in
          </Link>
        )
      ) : (
        <button disabled className={`${boton} cursor-not-allowed bg-slate-100 text-slate-400`}>Realizar Check-in</button>
      )}
    </div>
  )
}
