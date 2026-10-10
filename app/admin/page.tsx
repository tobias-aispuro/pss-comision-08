import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/role-access';
import { fechaDeHoy } from '@/lib/search-utils';
import { contarReservasActivas, obtenerSalidasDelDia } from '@/lib/panel-datos';
import MetricaCard from '@/components/MetricaCard';
import SalidasDelDia from '@/components/SalidasDelDia';

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const modulosPendientes = [
  { icono: '🗓️', titulo: 'Programación semanal', texto: 'Plantillas de frecuencias por temporada.' },
  { icono: '⏱️', titulo: 'Gestión de slots', texto: 'Horarios de despegue y aterrizaje asignados.' },
  { icono: '🚪', titulo: 'Asignación de puertas', texto: 'Puertas y posiciones de embarque.' },
];

export default async function AdminPage() {
  const user = await requireRole(['ADMINISTRADOR']);
  const hoy = fechaDeHoy();
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const fechaTexto = formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)));

  const [salidas, vuelosActivos, vuelosTotales, reservas, cancelaciones] = await Promise.all([
    obtenerSalidasDelDia(hoy),
    prisma.vuelo.count({ where: { activo: true } }),
    prisma.vuelo.count(),
    contarReservasActivas(hoy),
    prisma.cancelacionVuelo.count({ where: { fecha: { gte: hoy } } }),
  ]);
  const pasajerosHoy = salidas.reduce((total, s) => total + s.pasajeros, 0);

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Centro de despacho <span className="text-slate-400">›</span> Inicio
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Hola, {user.nombre}</h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                Hoy
              </span>
              {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/vuelos"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Todos los vuelos
            </Link>
            <Link
              href="/admin/nuevoVuelo"
              className="rounded-xl bg-[#08A6C9] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(8,166,201,0.25)] transition hover:bg-[#318098]"
            >
              + Crear nuevo vuelo
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricaCard etiqueta="Salidas hoy" valor={salidas.length} unidad="vuelos" detalle={`${pasajerosHoy} pasajeros registrados`} icono="🛫" />
          <MetricaCard
            etiqueta="Vuelos activos"
            valor={vuelosActivos}
            unidad="series"
            detalle={`${vuelosTotales} vuelos cargados en total`}
            icono="✈"
            acento="secundario"
          />
          <MetricaCard
            etiqueta="Reservas activas"
            valor={reservas._count}
            unidad="reservas"
            detalle={`${reservas._sum.asientos ?? 0} asientos de hoy en adelante`}
            icono="🎟️"
            acento="terciario"
          />
          <MetricaCard
            etiqueta="Cancelaciones"
            valor={cancelaciones}
            unidad="salidas"
            detalle="Salidas canceladas de hoy en adelante"
            icono="⚠"
            acento="alerta"
          />
        </div>

        <SalidasDelDia salidas={salidas} titulo="Salidas de hoy" descripcion="Vuelos programados para hoy y su ocupación." />

        <section>
          <h3 className="text-lg font-bold text-slate-900">Próximos módulos</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {modulosPendientes.map(({ icono, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl" aria-hidden="true">
                    {icono}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">Próximamente</span>
                </div>
                <p className="mt-3 font-bold text-slate-700">{titulo}</p>
                <p className="mt-1 text-sm text-slate-500">{texto}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
