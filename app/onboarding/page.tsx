'use client'

import { useState } from 'react'
import { completarRegistro } from './actions'

export default function OnboardingPage() {
  const [errorMsg, setErrorMsg] = useState('')

  const hoy = new Date()
  const hace18Anios = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate())
    .toISOString()
    .split('T')[0]

  const validarFormulario = (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMsg('') // Limpiamos errores anteriores
    
    // Obtenemos los datos que el usuario escribió
    const formData = new FormData(e.currentTarget)
    
    // --- 1. VALIDAR LONGITUD DEL DNI ---
    const dni = formData.get('dni') as string
    if (dni.length < 7 || dni.length > 8 || isNaN(Number(dni))) {
      e.preventDefault() // Bloqueamos el envío a la base de datos
      setErrorMsg('El DNI debe contener exactamente 7 u 8 números (sin puntos ni letras).')
      return
    }

    // --- 2. VALIDAR EDAD (Mínimo 18 años) ---
    const fechaNacString = formData.get('fechaNacimiento') as string
    // Agregamos 'T12:00:00' para evitar que la zona horaria de Argentina reste un día por error
    const fechaNac = new Date(fechaNacString + 'T12:00:00')
    
    let edad = hoy.getFullYear() - fechaNac.getFullYear()
    const mes = hoy.getMonth() - fechaNac.getMonth()
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--
    }

    if (edad < 18) {
      e.preventDefault() // Bloqueamos el envío
      setErrorMsg('Operación denegada: Debes ser mayor de 18 años para registrarte en SkyLink.')
      return
    }
    
    // Si llega hasta acá, el formulario está perfecto y se ejecuta action={completarRegistro} naturalmente.
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <span className="text-xs font-bold text-sky-primary bg-sky-primary/10 px-3 py-1 rounded-full uppercase tracking-wider">
            ✈ Registro Oficial de Pasajeros
          </span>
          <h2 className="text-3xl font-bold text-slate-900 mt-4">Crea tu cuenta de pasajero SkyLink</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-sky-primary to-[#E0F2F1]"></div>
          
          {/* Agregamos el onSubmit aquí para que valide antes de mandar la acción */}
          <form action={completarRegistro} onSubmit={validarFormulario} className="p-8 space-y-10">
            
            {/* Si hay un error, mostramos este cartel rojo arriba de todo */}
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-sm font-medium">
                {errorMsg}
              </div>
            )}
            
            <section>
              <div className="flex justify-between border-b border-slate-100 pb-2 mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                  <span className="text-sky-primary">1.</span> Identificación Oficial del Pasajero
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento *</label>
                  <select className="w-full border border-slate-300 rounded-md p-3 focus:ring-1 focus:ring-sky-primary outline-none">
                    <option>DNI / NIF</option>
                    <option>Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número de Documento *</label>
                  {/* Agregamos minLength y maxLength para forzar a nivel HTML también */}
                  <input name="dni" required minLength={7} maxLength={8} placeholder="Ej. 71928374" className="w-full border border-slate-300 rounded-md p-3 focus:ring-1 focus:ring-sky-primary outline-none" />
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between border-b border-slate-100 pb-2 mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                  <span className="text-sky-primary">2.</span> Datos Personales y de Contacto
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre(s) *</label>
                  <input name="nombre" required className="w-full border border-slate-300 rounded-md p-3 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos *</label>
                  <input name="apellido" required className="w-full border border-slate-300 rounded-md p-3 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Nacimiento *</label>
                  <input name="fechaNacimiento" type="date" required max={hace18Anios} className="w-full border border-slate-300 rounded-md p-3 outline-none text-slate-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Móvil *</label>
                  <input name="telefono" required className="w-full border border-slate-300 rounded-md p-3 outline-none" />
                </div>
              </div>
            </section>

            <div className="pt-6 flex justify-end border-t border-slate-100">
              <button type="submit" className="bg-[#046A7A] hover:bg-sky-secondary text-white font-medium rounded-md px-8 py-3 transition-colors">
                Completar Registro ✈
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}