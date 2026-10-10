'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getFlightValues, getTodayISODate, validateFlightValues } from '@/lib/flight-utils'
import { isWorldCityLabel } from '@/lib/world-cities'

type FlightFormState = {
  errors: Record<string, string>
  formError?: string
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

function databaseErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ['28P01', 'P1000', 'P1001', 'P1002', 'ETIMEDOUT'].includes(String(error.code))
  ) {
    return 'No se pudo conectar con la base de datos. Verifica las credenciales de Neon en .env e inténtalo nuevamente.'
  }

  return 'No se pudo guardar el vuelo. Inténtalo nuevamente.'
}

export async function checkFlightCode(code: string) {
  const codigoVuelo = code.trim().toUpperCase()
  if (!codigoVuelo) return { exists: false, unavailable: false }

  try {
    const existingFlight = await prisma.vuelo.findFirst({
      where: { codigoVuelo: { equals: codigoVuelo, mode: 'insensitive' } },
      select: { id: true },
    })

    return { exists: Boolean(existingFlight), unavailable: false }
  } catch {
    return { exists: false, unavailable: true }
  }
}

export async function createFlight(
  _previousState: FlightFormState,
  formData: FormData,
): Promise<FlightFormState> {
  const flight = getFlightValues(formData)
  const errors = validateFlightValues(flight, getTodayISODate())

  if (flight.origen && !isWorldCityLabel(flight.origen)) {
    errors.origen = 'Selecciona una ciudad de las sugerencias.'
  }

  if (flight.destino && !isWorldCityLabel(flight.destino)) {
    errors.destino = 'Selecciona una ciudad de las sugerencias.'
  }

  if (Object.keys(errors).length > 0) return { errors }

  try {
    const existingFlight = await prisma.vuelo.findFirst({
      where: { codigoVuelo: { equals: flight.codigoVuelo, mode: 'insensitive' } },
      select: { id: true },
    })

    if (existingFlight) {
      return { errors: { codigoVuelo: 'Ya existe un vuelo con ese código.' } }
    }

    await prisma.vuelo.create({ data: flight })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { errors: { codigoVuelo: 'Ya existe un vuelo con ese código.' } }
    }

    return { errors: {}, formError: databaseErrorMessage(error) }
  }

  redirect('/admin/nuevoVuelo?success=1')
}