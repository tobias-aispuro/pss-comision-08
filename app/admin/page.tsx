import { requireRole } from '@/lib/role-access';

export default async function AdminPage() {
  const user = await requireRole(['ADMINISTRADOR']);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-xl w-full p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 mb-3">
            Acceso autorizado
          </p>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Bienvenido, {user.nombre} {user.apellido}
          </h2>
          <p className="text-slate-600">
            Administración de vuelos, puertas, slots y programación semanal. Esta sección está en desarrollo y se irán habilitando nuevas funcionalidades próximamente.
          </p>
        </div>
    </main>
  );
}
