import { UserButton } from '@clerk/nextjs';

import { requireRole } from '@/lib/role-access';

export default async function AdminPage() {
  const user = await requireRole(['ADMINISTRADOR']);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white p-4 shadow-sm flex justify-between items-center px-8">
        <div>
          <h1 className="text-xl font-bold text-sky-600">SkyLink</h1>
          <p className="text-sm text-slate-500">Panel administrativo</p>
        </div>
        <UserButton />
      </nav>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-xl w-full p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 mb-3">
            Acceso autorizado
          </p>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">
            Bienvenido, {user.nombre} {user.apellido}
          </h2>
          <p className="text-slate-600">
            Aquí podés administrar usuarios, vuelos, operaciones y permisos del sistema.
          </p>
        </div>
      </main>
    </div>
  );
}
