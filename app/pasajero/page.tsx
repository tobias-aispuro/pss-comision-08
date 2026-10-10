import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/role-access';
import { fechaDeHoy } from '@/lib/search-utils';
import { CLASES_PASAJE } from '@/lib/compra-utils';
import { evaluarCancelacion } from '@/lib/reserva-cancelacion-utils';
import MetricaCard from '@/components/MetricaCard';

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const formatoLimite = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function aUtc(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

const accesos = [
  { href: '/pasajero/busquedaVuelo', icono: '🔎', titulo: 'Buscar vuelos', texto: 'Vuelos directos de ida o de ida y vuelta.' },
  { href: '/pasajero/reservas', icono: '🎟️', titulo: 'Mis reservas', texto: 'Tus viajes, pasajeros y cancelaciones.' },
];

export default async function PasajeroHome() {
  const user = await requireRole(['PASAJERO']);
  const hoy = fechaDeHoy();

  const reservas = await prisma.reserva.findMany({
    where: { userId: user.id, fecha: { gte: hoy }, estado: { in: ['PENDIENTE', 'CONFIRMADA'] } },
    include: { vuelo: true, pasajeros: { where: { canceladoAt: null } } },
  });
  const proximas = reservas
    .filter((r) => r.pasajeros.length > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.vuelo.horaSalida.localeCompare(b.vuelo.horaSalida));
  const proxima = proximas[0];

  const pasajes = proximas.reduce((total, r) => total + r.pasajeros.length, 0);
  const destinos = new Set(proximas.map((r) => r.vuelo.destino)).size;

  let diasRestantes = 0;
  let plazoCancelacion: string | null = null;
  if (proxima) {
    diasRestantes = Math.round((aUtc(proxima.fecha) - aUtc(hoy)) / (24 * 60 * 60 * 1000));
    const evaluacion = evaluarCancelacion({
      reserva: proxima,
      vuelo: proxima.vuelo,
      pasajeros: proxima.pasajeros,
      dniTitular: user.dni,
    });
    plazoCancelacion = evaluacion.ok ? `${formatoLimite.format(evaluacion.limite)} hs` : null;
  }

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#318098] to-[#6475AC] p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.15)] md:p-8">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-[#08A6C9]/30" aria-hidden="true" />
          <div className="relative">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Panel del pasajero</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">¡Hola, {user.nombre}!</h2>
            <p className="mt-2 max-w-xl text-white/85">
              {proxima
                ? `Tu próximo vuelo sale ${diasRestantes === 0 ? 'hoy' : diasRestantes === 1 ? 'mañana' : `en ${diasRestantes} días`}. ¿Planeás otro viaje?`
                : '¿A dónde querés viajar? Buscá vuelos y comprá los pasajes de todo tu grupo.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/pasajero/busquedaVuelo"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#318098] shadow-sm transition hover:bg-slate-50"
              >
                Buscar vuelos
              </Link>
              <Link
                href="/pasajero/reservas"
                className="rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Mis reservas
              </Link>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">Tu próximo viaje</h3>
              {proxima && (
                <span className="rounded-full bg-sky-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  {diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Mañana' : `En ${diasRestantes} días`}
                </span>
              )}
            </div>

            {proxima ? (
              <>
                <div className="mt-4 rounded-2xl border border-slate-200 border-l-4 border-l-sky-600 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    SkyLink <span className="text-slate-800">{proxima.vuelo.codigoVuelo}</span>
                    <span className="font-medium normal-case tracking-normal">
                      {' '}
                      · {CLASES_PASAJE[proxima.clase as keyof typeof CLASES_PASAJE]?.nombre ?? proxima.clase}
                    </span>
                  </p>
                  <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{proxima.vuelo.horaSalida}</p>
                      <p className="text-sm font-semibold text-slate-700">{proxima.vuelo.origen}</p>
                    </div>
                    <div className="flex items-center gap-2 px-1" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full bg-sky-700" />
                      <span className="h-px flex-1 bg-slate-300" />
                      <span className="text-sm text-sky-700">✈</span>
                      <span className="h-px flex-1 bg-slate-300" />
                      <span className="h-2 w-2 rounded-full bg-sky-700" />
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{proxima.vuelo.horaLlegada}</p>
                      <p className="text-sm font-semibold text-slate-700">{proxima.vuelo.destino}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {(() => {
                      const texto = formatoFecha.format(new Date(aUtc(proxima.fecha)));
                      return texto.charAt(0).toUpperCase() + texto.slice(1);
                    })()}{' '}
                    · {proxima.pasajeros.length} {proxima.pasajeros.length === 1 ? 'pasajero' : 'pasajeros'}
                  </p>
                </div>
                {plazoCancelacion && (
                  <p className="mt-3 text-sm text-slate-500">Podés cancelar tu pasaje hasta el {plazoCancelacion}.</p>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="font-semibold text-slate-700">Todavía no tenés viajes próximos.</p>
                <Link href="/pasajero/busquedaVuelo" className="mt-2 inline-block text-sm font-semibold text-sky-700 hover:underline">
                  Buscá tu próximo vuelo →
                </Link>
              </div>
            )}
          </section>

          <div className="grid gap-4">
            <MetricaCard etiqueta="Reservas activas" valor={proximas.length} unidad="viajes" icono="🎟️" />
            <MetricaCard etiqueta="Pasajes activos" valor={pasajes} unidad="pax" detalle="Pasajeros en tus próximos viajes" icono="👥" acento="secundario" />
            <MetricaCard etiqueta="Destinos" valor={destinos} detalle="Ciudades a las que vas a viajar" icono="📍" acento="terciario" />
          </div>
        </div>

        <section>
          <h3 className="text-lg font-bold text-slate-900">Accesos rápidos</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {accesos.map(({ href, icono, titulo, texto }) => (
              <Link
                key={titulo}
                href={href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-lg" aria-hidden="true">
                  {icono}
                </span>
                <p className="mt-3 font-bold text-slate-900 group-hover:text-sky-700">{titulo} →</p>
                <p className="mt-1 text-sm text-slate-500">{texto}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
