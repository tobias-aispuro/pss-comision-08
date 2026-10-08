'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/role-access'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { enviarEmailEdicionVuelo, VueloComparativo, DatosVuelo } from '@/lib/email'

export type EditarVueloState = {
    error: string
}

function arraysIguales(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false
    return arr1.every((val, idx) => val === arr2[idx])
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

    // 2. ID
    const id = formData.get('id')
    if (typeof id !== 'string' || !id) {
        return { error: 'ID de vuelo inválido.' }
    }

    // 3. Validaciones del form
    let vuelo
    try {
        const { parseFlightFormData } = await import('@/lib/flight-utils')
        vuelo = parseFlightFormData(formData)
    } catch (e) {
        return {
            error: e instanceof Error ? e.message : 'Datos inválidos.',
        }
    }

    // 4. Código duplicado
    const existente = await prisma.vuelo.findUnique({
        where: { codigoVuelo: vuelo.codigoVuelo },
    })
    if (existente && existente.id !== id) {
        return { error: 'Ya existe otro vuelo con ese código.' }
    }

    // 5. Obtener datos anteriores del vuelo
    const vueloAnterior = await prisma.vuelo.findUnique({
        where: { id },
    })

    if (!vueloAnterior) {
        return { error: 'Vuelo no encontrado.' }
    }

    // 6. Update
    let vueloActualizado
    try {
        vueloActualizado = await prisma.vuelo.update({
            where: { id },
            data: {
                codigoVuelo: vuelo.codigoVuelo,
                origen: vuelo.origen,
                destino: vuelo.destino,
                diasOperacion: vuelo.diasOperacion,
                horaSalida: vuelo.horaSalida,
                horaLlegada: vuelo.horaLlegada,
                periodoDesde: vuelo.periodoDesde,
                periodoHasta: vuelo.periodoHasta,
                tipoAvion: vuelo.tipoAvion,
            },
        })
    } catch (error) {
        console.error('Error al guardar vuelo:', error)
        return { error: 'Error al guardar los cambios en la base de datos.' }
    }

    // 7. Detectar cambios
    const cambios: VueloComparativo[] = []

    if (vueloAnterior.codigoVuelo !== vueloActualizado.codigoVuelo) {
        cambios.push({
            campo: 'Código Vuelo',
            anterior: vueloAnterior.codigoVuelo,
            nuevo: vueloActualizado.codigoVuelo,
        })
    }
    if (vueloAnterior.origen !== vueloActualizado.origen) {
        cambios.push({
            campo: 'Origen',
            anterior: vueloAnterior.origen,
            nuevo: vueloActualizado.origen,
        })
    }
    if (vueloAnterior.destino !== vueloActualizado.destino) {
        cambios.push({
            campo: 'Destino',
            anterior: vueloAnterior.destino,
            nuevo: vueloActualizado.destino,
        })
    }
    if (vueloAnterior.horaSalida !== vueloActualizado.horaSalida) {
        cambios.push({
            campo: 'Hora Salida',
            anterior: vueloAnterior.horaSalida,
            nuevo: vueloActualizado.horaSalida,
        })
    }
    if (vueloAnterior.horaLlegada !== vueloActualizado.horaLlegada) {
        cambios.push({
            campo: 'Hora Llegada',
            anterior: vueloAnterior.horaLlegada,
            nuevo: vueloActualizado.horaLlegada,
        })
    }
    if (!arraysIguales(vueloAnterior.diasOperacion, vueloActualizado.diasOperacion)) {
        cambios.push({
            campo: 'Días Operación',
            anterior: vueloAnterior.diasOperacion.join(', '),
            nuevo: vueloActualizado.diasOperacion.join(', '),
        })
    }
    if (vueloAnterior.periodoDesde !== vueloActualizado.periodoDesde) {
        cambios.push({
            campo: 'Período Desde',
            anterior: vueloAnterior.periodoDesde,
            nuevo: vueloActualizado.periodoDesde,
        })
    }
    if (vueloAnterior.periodoHasta !== vueloActualizado.periodoHasta) {
        cambios.push({
            campo: 'Período Hasta',
            anterior: vueloAnterior.periodoHasta,
            nuevo: vueloActualizado.periodoHasta,
        })
    }
    if (vueloAnterior.tipoAvion !== vueloActualizado.tipoAvion) {
        cambios.push({
            campo: 'Tipo Avión',
            anterior: vueloAnterior.tipoAvion,
            nuevo: vueloActualizado.tipoAvion,
        })
    }

    // 8. Enviar emails si hay cambios
    if (cambios.length > 0) {
        try {
            // Obtener usuarios con reservas en este vuelo
            const reservas = await prisma.reserva.findMany({
                where: { vueloId: id },
                include: {
                    user: {
                        select: {
                            email: true,
                            nombre: true,
                            apellido: true,
                        }
                    }
                }
            })

            // Agrupar por email para evitar duplicados
            const usuariosUnicos = new Map()
            reservas.forEach(reserva => {
                if (!usuariosUnicos.has(reserva.user.email)) {
                    usuariosUnicos.set(reserva.user.email, {
                        email: reserva.user.email,
                        nombre: reserva.user.nombre,
                        apellido: reserva.user.apellido,
                    })
                }
            })

            // Enviar email a cada usuario
            for (const usuario of usuariosUnicos.values()) {
                console.log(usuario.email);
                await enviarEmailEdicionVuelo(
                    usuario.email,
                    cambios,
                    vueloActualizado
                )
            }

            console.log(`Emails de edición de vuelo enviados a ${usuariosUnicos.size} usuarios`)
        } catch (error) {
            console.error('Error al enviar emails de edición:', error)
        }
    }

    // 9. Revalidar y redirigir
    revalidatePath('/admin/vuelos')
    redirect('/admin/vuelos?success=1')
}