import { requireRole } from '@/lib/role-access';

export default async function PasajeroHome() {
  const user = await requireRole(['PASAJERO']);

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 mb-3">
            Perfil activo
          </p>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            ¡Bienvenido, {user.nombre} {user.apellido}!
          </h2>
          <p className="text-slate-600 mb-6">
            Desde este panel podés gestionar tus reservas, realizar el check-in online y consultar el estado de tus vuelos. Próximamente se habilitarán nuevas funcionalidades para mejorar tu experiencia como pasajero.
          </p>
        </div>
    </main>
  );
}