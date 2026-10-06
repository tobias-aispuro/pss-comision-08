import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* Barra de Navegación */}
      <header className="bg-white px-8 py-4 flex justify-between items-center shadow-sm relative z-50">
        <div className="flex items-center gap-3">
          <img 
            src="/Logo.png" 
            alt="SkyLink Logo" 
            width={45} 
            height={45} 
            className="object-contain"
          />
          <span className="text-2xl font-bold text-[#08A6C9] tracking-tight">SkyLink</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-[#747682] hover:text-[#08A6C9] font-medium transition-colors">
            Iniciar Sesión
          </Link>
          <Link href="/sign-up" className="bg-[#08A6C9] hover:bg-[#318098] text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-md shadow-[#08A6C9]/20">
            Crear Cuenta
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Fondo con color secundario y terciario de la paleta */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#318098] to-[#6475AC] z-0" />
        
        {/* Patrón decorativo opcional */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] z-0" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <span className="text-white/80 font-mono text-sm tracking-widest uppercase mb-6 border border-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
            Sistema de Operaciones Aeroportuarias
          </span>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Conectando cada vuelo con <span className="text-[#08A6C9] drop-shadow-md">precisión</span> y seguridad.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-100 mb-10 max-w-2xl">
            Gestiona reservas, agiliza facturaciones y administra operaciones de rampa en tiempo real bajo los estándares de IATA One ID.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Link href="/sign-up" className="bg-white text-[#08A6C9] hover:bg-slate-50 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2">
              Comenzar Registro ✈
            </Link>
            <Link href="/sign-in" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm flex items-center justify-center">
              Acceso Empleados
            </Link>
          </div>
        </div>
      </main>

    </div>
  );
}