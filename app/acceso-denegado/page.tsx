import Link from 'next/link';

export default function AccesoDenegadoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="max-w-lg w-full bg-white border border-red-200 rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600 mb-3">
          Acceso restringido
        </p>
        <h1 className="text-3xl font-bold text-slate-800 mb-4">No tenés permisos para ver esta sección</h1>
        <p className="text-slate-600 mb-6">
          Tu perfil no tiene acceso a este módulo de SkyLink. Contactá con un administrador si necesitas permisos.
        </p>
      </div>
    </main>
  );
}
