'use server'

import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function completarRegistro(formData: FormData) {
  // 1. Obtenemos el usuario autenticado de Clerk
  const { userId } = await auth()
  const clerkUser = await currentUser()
  
  if (!userId || !clerkUser) {
    throw new Error("No autorizado")
  }

  const email = clerkUser.emailAddresses[0].emailAddress

  // 2. Extraemos los datos del formulario
  const dni = formData.get('dni') as string
  const nombre = formData.get('nombre') as string
  const apellido = formData.get('apellido') as string
  const telefono = formData.get('telefono') as string
  const fechaNacimiento = formData.get('fechaNacimiento') as string

 // ---  VALIDACIÓN DE EDAD EN EL BACKEND ---
  const fechaNac = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  
  // Si el mes actual es anterior al mes de nacimiento, o si es el mismo mes pero el día no llegó, le restamos 1 año
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }

  if (edad < 18) {
    throw new Error("Debes ser mayor de 18 años para registrarte en SkyLink.");
  }
  // ----------------------------------------------
  
  if (!dni || dni.length < 7 || dni.length > 8) {
    throw new Error("El DNI es inválido.")
  }
  // 3. Guardamos en Prisma vinculando el clerkId
  await prisma.user.create({
    data: {
      clerkId: userId,
      email: email,
      dni: dni,
      nombre: nombre,
      apellido: apellido,
      telefono: telefono,
      fechaNacimiento: new Date(fechaNacimiento),
      rol: 'PASAJERO', // Valor por defecto
    }
  })

  // 4. Redirigimos al panel del pasajero
  redirect('/pasajero')
}