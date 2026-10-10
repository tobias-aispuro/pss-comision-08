import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { resolvePostAuthRedirect } from '@/lib/role-access';
import { fechaDeHoy } from '@/lib/search-utils';
import LogoSkyLink from '@/components/LogoSkyLink';
import RutaAnimada from '@/components/RutaAnimada';

const funciones = [
  {
    icono: '🔎',
    titulo: 'Buscá vuelos',
    texto: 'Encontrá vuelos directos de ida o de ida y vuelta, con horarios, duración y precio por clase.',
  },
  {
    icono: '🎟️',
    titulo: 'Comprá para todo tu grupo',
    texto: 'Hasta 9 pasajes en una misma compra, cargando los datos de cada pasajero una sola vez.',
  },
  {
    icono: '🗓️',
    titulo: 'Gestioná tus reservas',
    texto: 'Consultá tus viajes en "Mis reservas" y cancelá tu pasaje hasta 48 horas antes del despegue.',
  },
];

// Vista previa estática del producto, con el mismo estilo que las tarjetas de la búsqueda.
function VistaPreviaVuelo() {
  return (
    <div className="relative mx-auto w-full max-w-md pt-28 lg:max-w-none lg:pt-32" aria-hidden="true">
      {/* La ruta pasa por arriba de la tarjeta: el avión despega desde atrás y llega al destino */}
      <RutaAnimada variante="clara" className="absolute inset-x-0 top-0 w-full" />
      <div className="absolute -inset-6 top-24 rounded-[40px] bg-gradient-to-br from-[#08A6C9]/20 via-sky-100 to-[#6475AC]/20 blur-2xl" />

      <div className="relative rounded-[24px] border border-slate-200 border-l-4 border-l-sky-600 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          SkyLink <span className="text-slate-800">SL717</span>
          <span className="font-medium normal-case tracking-normal"> · Airbus A350</span>
        </p>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">10:45</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Madrid</p>
          </div>
          <div className="px-1 text-center">
            <p className="text-xs font-medium text-slate-500">08h 35m</p>
            <div className="my-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-700" />
              <span className="h-px flex-1 bg-slate-300" />
              <span className="text-sm text-sky-700">✈</span>
              <span className="h-px flex-1 bg-slate-300" />
              <span className="h-2 w-2 rounded-full bg-sky-700" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">Vuelo directo</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-tight text-slate-900">13:20</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Nueva York</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500">Economy</p>
            <p className="text-lg font-bold text-sky-700">$720</p>
          </div>
          <div className="rounded-xl border border-sky-700 p-3">
            <p className="text-xs font-semibold text-slate-500">Primera</p>
            <p className="text-lg font-bold text-sky-700">$1.650</p>
          </div>
        </div>
      </div>

      <div className="relative -mt-4 ml-auto mr-4 w-64 rounded-2xl border border-emerald-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] sm:mr-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">✓</span>
          <div>
            <p className="text-sm font-bold text-slate-900">Pasajeros registrados</p>
            <p className="text-xs text-slate-500">3 pasajes · Madrid → Nueva York</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      redirect('/onboarding');
    }

    redirect(resolvePostAuthRedirect(user.rol));
  }

  const anio = fechaDeHoy().slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col bg-[#edf3f6] font-sans">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <LogoSkyLink href="/" subtitulo="Vuelos y reservas" />
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Acceso">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Bloque principal */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
              ✈ SkyLink
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">
              Tu próximo vuelo, a <span className="text-[#08A6C9]">unos clics</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Buscá vuelos, comprá los pasajes de todo tu grupo y gestioná tus reservas desde un solo lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="rounded-xl bg-sky-600 px-6 py-3.5 text-center text-base font-semibold text-white shadow-[0_12px_24px_rgba(14,116,144,0.24)] transition hover:bg-sky-700"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/sign-in"
                className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <VistaPreviaVuelo />
        </section>

        {/* Qué podés hacer */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">Para pasajeros</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Qué podés hacer con SkyLink</h2>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {funciones.map(({ icono, titulo, texto }) => (
                <article
                  key={titulo}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 transition duration-200 hover:-translate-y-1 hover:border-sky-300 hover:bg-white hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm" aria-hidden="true">
                    {icono}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Personal */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 rounded-[28px] bg-gradient-to-r from-[#318098] to-[#6475AC] p-8 text-white shadow-[0_18px_45px_rgba(15,23,42,0.15)] md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">¿Trabajás en SkyLink?</h2>
              <p className="mt-1 text-white/85">Administradores y empleados de mostrador ingresan con su cuenta para gestionar vuelos.</p>
            </div>
            <Link
              href="/sign-in"
              className="shrink-0 rounded-xl bg-white px-6 py-3 text-center font-semibold text-[#318098] shadow-sm transition hover:bg-slate-50"
            >
              Ingresar al sistema
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {anio} SkyLink · Airline &amp; Airport Operations</p>
          <p>Sistema de reservas de vuelos</p>
        </div>
      </footer>
    </div>
  );
}
