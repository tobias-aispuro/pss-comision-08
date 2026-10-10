import { requireRole } from '@/lib/role-access';
import { fechaDeHoy } from '@/lib/search-utils';
import { obtenerSalidasDelDia } from '@/lib/panel-datos';
import MetricaCard from '@/components/MetricaCard';
import SalidasDelDia from '@/components/SalidasDelDia';

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const tareas = [
  { icono: '🧾', titulo: 'Check-in en mostrador', texto: 'Registro de pasajeros y emisión de tarjetas de embarque.' },
  { icono: '🧳', titulo: 'Equipaje', texto: 'Despacho y etiquetado del equipaje en bodega.' },
  { icono: '🚶', titulo: 'Embarque', texto: 'Control de pasajeros en la puerta de embarque.' },
];

export default async function EmpleadoPage() {
  const user = await requireRole(['EMPLEADO_MOSTRADOR']);
  const hoy = fechaDeHoy();
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const fechaTexto = formatoFecha.format(new Date(Date.UTC(anio, mes - 1, dia)));

  const salidas = await obtenerSalidasDelDia(hoy);
  const pasajeros = salidas.reduce((total, s) => total + s.pasajeros, 0);
  const proxima = salidas[0];

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Mostrador <span className="text-slate-400">›</span> Salidas del día
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Hola, {user.nombre}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Estas son las salidas de hoy, {fechaTexto}, y los pasajeros que tienen que presentarse.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricaCard etiqueta="Salidas hoy" valor={salidas.length} unidad="vuelos" icono="🛫" />
          <MetricaCard
            etiqueta="Pasajeros a atender"
            valor={pasajeros}
            unidad="pax"
            detalle="Pasajeros registrados en las salidas de hoy"
            icono="👥"
            acento="secundario"
          />
          <MetricaCard
            etiqueta="Primera salida"
            valor={proxima ? proxima.horaSalida : '—'}
            unidad={proxima ? proxima.codigoVuelo : undefined}
            detalle={proxima ? `${proxima.origen} → ${proxima.destino}` : 'Sin salidas programadas'}
            icono="⏱️"
            acento="terciario"
          />
        </div>

        <SalidasDelDia salidas={salidas} titulo="Salidas del día" descripcion="Vuelos de hoy con los pasajeros registrados." />

        <section>
          <h3 className="text-lg font-bold text-slate-900">Tareas de mostrador</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {tareas.map(({ icono, titulo, texto }) => (
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
