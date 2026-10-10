import { UserButton } from '@clerk/nextjs';

import { requireRole } from '@/lib/role-access';
import LogoSkyLink from '@/components/LogoSkyLink';

export default async function EmpleadoPage() {
  const user = await requireRole(['EMPLEADO_MOSTRADOR']);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white p-4 shadow-sm flex justify-between items-center px-8">
        <LogoSkyLink href="/empleado" subtitulo="Panel de empleado" />
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
            Aquí puedes gestionar tareas operativas del aeropuerto.
          </p>
        </div>
      </main>
    </div>
  );
}
