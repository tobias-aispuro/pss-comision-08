'use server'

import { Vuelo, Reserva, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { notificarReprogramacion } from '@/lib/reprogramacion-email'
import { enviarEmail } from '@/lib/mailer'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type EditarVueloState = {
    error: string
}

type ReservaConUsuario = Reserva & {
    user: User
}

type CambioHorario = {
    horaSalida: string
    horaLlegada: string
    fecha: string
}

type DeteccionCambios = {
    cambios: Record<string, CambioHorario>
    afectadas: ReservaConUsuario[]
}

type CambiosDetectados = {
    horaSalida?: string
    horaLlegada?: string
}

/**
 * Detecta cambios en horarios que afecten a reservas existentes.
 * Retorna { cambios: { [fecha: string]: { horaSalida, horaLlegada, fecha } }, afectadas: Reserva[] }
 */
async function detectarCambiosYReservas(
    vueloId: string,
    cambios: CambiosDetectados,
    vueloAnterior: Vuelo
): Promise<DeteccionCambios> {
    const afectadas = await prisma.reserva.findMany({
        where: { vueloId, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
        include: { user: true },
    })

    if (afectadas.length === 0) {
        return { cambios: {}, afectadas: [] }
    }

    const cambiosPorFecha: Record<string, CambioHorario> = {}

    // Si cambió la hora de salida o llegada, afecta a todas las reservas
    const horaSalidaCambió = cambios.horaSalida && cambios.horaSalida !== vueloAnterior.horaSalida
    const horaLlegadaCambió = cambios.horaLlegada && cambios.horaLlegada !== vueloAnterior.horaLlegada

    if (horaSalidaCambió || horaLlegadaCambió) {
        const horaSalida = cambios.horaSalida || vueloAnterior.horaSalida
        const horaLlegada = cambios.horaLlegada || vueloAnterior.horaLlegada

        for (const reserva of afectadas) {
            cambiosPorFecha[reserva.fecha] = { horaSalida, horaLlegada, fecha: reserva.fecha }
        }
    }

    return { cambios: cambiosPorFecha, afectadas }
}

type DatosVueloNotificacion = {
    codigoVuelo: string
    origen: string
    destino: string
    horaSalida: string
}

async function notificarReprogramacionSiNecesario( 
    vuelo: DatosVueloNotificacion,
    cambiosPorFecha: Record<string, CambioHorario>,
    reservas: ReservaConUsuario[]
): Promise<string> {
    if (Object.keys(cambiosPorFecha).length === 0 || reservas.length === 0) {
        return ''
    }

    const { notificados, fallidos } = await notificarReprogramacion(
        { vuelo, reservas, cambiosPorFecha },
        enviarEmail
    )

    return `&notificados=${notificados}&fallidos=${fallidos.length}`
}

export async function modificarVuelo(
    _prevState: EditarVueloState,
    formData: FormData
): Promise<EditarVueloState> {
    // 1. Auth
    try {
        await requireRole(['ADMINISTRADOR'])
    } catch {
        return { error: 'No tenés permisos para modificar vuelos.' }
    }

    // 2. Extraer ID
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
        return { error: 'ID de vuelo inválido.' }
    }

    // 3. Obtener vuelo anterior para detectar cambios
    const vueloAnterior = await prisma.vuelo.findUnique({
        where: { id },
    })
    if (!vueloAnterior) {
        return { error: 'El vuelo no existe.' }
    }

    // 4. Extraer y validar datos manualmente
    const codigoVuelo = formData.get('codigoVuelo')?.toString().trim()
    const origen = formData.get('origen')?.toString().trim()
    const destino = formData.get('destino')?.toString().trim()
    const tipoAvion = formData.get('tipoAvion')?.toString().trim()
    const horaSalida = formData.get('horaSalida')?.toString()
    const horaLlegada = formData.get('horaLlegada')?.toString()
    const periodoDesde = formData.get('periodoDesde')?.toString()
    const periodoHasta = formData.get('periodoHasta')?.toString()
    const diasOperacion = formData.getAll('diasOperacion').map(String)

    const precioEconomyRaw = formData.get('precioEconomy')
    const precioPrimeraRaw = formData.get('precioPrimera')

    const precioEconomy = precioEconomyRaw ? Number(precioEconomyRaw) : NaN
    const precioPrimera = precioPrimeraRaw ? Number(precioPrimeraRaw) : NaN

    // Validaciones básicas
    if (
        !codigoVuelo ||
        !origen ||
        !destino ||
        !tipoAvion ||
        !horaSalida ||
        !horaLlegada ||
        !periodoDesde ||
        !periodoHasta ||
        diasOperacion.length === 0
    ) {
        return { error: 'Todos los campos son obligatorios.' }
    }
    if (origen === destino) {
        return { error: 'El origen y el destino deben ser distintos.' }
    }
    if (horaLlegada <= horaSalida) {
        return { error: 'La hora de llegada debe ser posterior a la hora de salida.' }
    }
    if (isNaN(precioEconomy) || isNaN(precioPrimera) || precioEconomy < 1 || precioPrimera < 1) {
        return { error: 'Los precios deben ser mayores a 0.' }
    }

    // 5. Código duplicado
    const existente = await prisma.vuelo.findUnique({
        where: { codigoVuelo },
    })
    if (existente && existente.id !== id) {
        return { error: 'Ya existe otro vuelo con ese código.' }
    }

    // 6. Detectar cambios relevantes para notificaciones
    const cambiosDetectados: CambiosDetectados = {
        horaSalida,
        horaLlegada,
    }

    const { cambios: cambiosPorFecha, afectadas } = await detectarCambiosYReservas(
        id,
        cambiosDetectados,
        vueloAnterior
    )

    // 7. Update
    try {
        await prisma.vuelo.update({
            where: { id },
            data: {
                codigoVuelo,
                origen,
                destino,
                diasOperacion,
                horaSalida,
                horaLlegada,
                periodoDesde,
                periodoHasta,
                tipoAvion,
                precioEconomy,
                precioPrimera,
            },
        })
    } catch (error) {
        console.error(error)
        return { error: 'Error al guardar los cambios en la base de datos.' }
    }

    // 8. Notificar si hay cambios relevantes en horarios
    const resumen = await notificarReprogramacionSiNecesario(
        {
            codigoVuelo,
            origen,
            destino,
            horaSalida,
        },
        cambiosPorFecha,
        afectadas
    )

    // 9. Revalidar y redirigir
    revalidatePath('/admin/vuelos')
    redirect(`/admin/vuelos?success=1${resumen}`)
}