import { UserButton } from "@clerk/nextjs";

export default function PasajeroHome() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barra de navegación simple */}
      <nav className="bg-white p-4 shadow-sm flex justify-between items-center px-8">
        <h1 className="text-xl font-bold text-blue-600">Sky Link</h1>
        {/* Este componente de Clerk muestra el avatar del usuario y le permite cerrar sesión */}
        <UserButton  />
      </nav>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 max-w-lg">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">¡Registro Exitoso!</h2>
          <p className="text-slate-600 mb-6">
            Tu cuenta ha sido creada y validada correctamente en nuestra base de datos.
          </p>
        </div>
      </main>
    </div>
  )
}