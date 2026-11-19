'use client'

import { useState, useTransition, useRef, useEffect } from 'react';
import {
  validarTicketAction,
  obtenerTicketsRecientesAction,
  type ResultadoValidacionTicket,
  type TicketRecienteInfo,
} from '@/app/empleado/validar-ticket/actions';

interface ValidadorTicketProps {
  initialTicketsRecientes?: TicketRecienteInfo[];
}

export default function ValidadorTicket({
  initialTicketsRecientes = [],
}: ValidadorTicketProps) {
  const [identificador, setIdentificador] = useState('');
  const [resultado, setResultado] = useState<ResultadoValidacionTicket | null>(null);
  const [errorInput, setErrorInput] = useState<string | null>(null);
  const [ticketsRecientes, setTicketsRecientes] = useState<TicketRecienteInfo[]>(initialTicketsRecientes);
  const [mostrarRecientes, setMostrarRecientes] = useState(true);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleValidar = (idAValidar?: string) => {
    const id = (idAValidar !== undefined ? idAValidar : identificador).trim();
    setErrorInput(null);

    if (!id) {
      setErrorInput('Por favor, ingrese o escanee un identificador de ticket.');
      setResultado(null);
      inputRef.current?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const res = await validarTicketAction(id);
        setResultado(res);
        if (idAValidar !== undefined) {
          setIdentificador(idAValidar);
        }
        // Actualizamos los tickets recientes para reflejar su nuevo estado
        obtenerTicketsRecientesAction().then(setTicketsRecientes).catch(() => {});
      } catch (err: unknown) {
        setResultado({
          ok: false,
          estado: 'INVALIDO',
          mensaje: err instanceof Error ? err.message : 'Error inesperado al validar el ticket.',
        });
      }
    });
  };

  const handleLimpiar = () => {
    setIdentificador('');
    setResultado(null);
    setErrorInput(null);
    inputRef.current?.focus();
  };

  const handleSeleccionarReciente = (id: string) => {
    setIdentificador(id);
    setErrorInput(null);
    setResultado(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta del formulario de validación */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleValidar();
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="ticket-id-input"
              className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-slate-700"
            >
              Identificador del Ticket Electrónico
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Ingrese el código único alfanumérico o escanee el código de barras / QR del ticket.
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  id="ticket-id-input"
                  ref={inputRef}
                  type="text"
                  value={identificador}
                  onChange={(e) => {
                    setIdentificador(e.target.value);
                    if (errorInput) setErrorInput(null);
                  }}
                  placeholder="Ej: f47ac10b-58cc-4372-a567-0e02b2c3d479"
                  disabled={isPending}
                  className={`w-full rounded-xl border pl-4 pr-10 py-3 font-mono text-sm shadow-sm transition placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    errorInput
                      ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-300 bg-white text-slate-900 focus:border-sky-500 focus:ring-sky-200'
                  }`}
                  aria-invalid={!!errorInput}
                  aria-describedby={errorInput ? 'ticket-error-msg' : undefined}
                />
                {identificador && (
                  <button
                    type="button"
                    onClick={() => {
                      setIdentificador('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Borrar texto ingresado"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Confirmar validación</span>
                  </>
                )}
              </button>

              {(resultado || identificador || errorInput) && (
                <button
                  type="button"
                  onClick={handleLimpiar}
                  disabled={isPending}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Nueva consulta
                </button>
              )}
            </div>

            {errorInput && (
              <p
                id="ticket-error-msg"
                role="alert"
                className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600"
              >
                <span>⚠️</span>
                <span>{errorInput}</span>
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Resultados de la validación */}
      {resultado && (
        <section aria-live="polite" className="space-y-4">
          {/* Estado: Ticket Válido */}
          {resultado.ok && resultado.estado === 'VALIDO' && resultado.datos && (
            <div className="overflow-hidden rounded-[24px] border-2 border-emerald-500 bg-white shadow-md">
              {/* Encabezado del resultado exitoso */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-600 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
                    ✓
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">Ticket Electrónico Válido</h3>
                    <p className="text-xs text-emerald-100">
                      Habilitado para continuar con el proceso de embarque
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-800 shadow-sm">
                    EMBARQUE AUTORIZADO
                  </span>
                </div>
              </div>

              {/* Mensaje descriptivo */}
              <div className="border-b border-emerald-100 bg-emerald-50/60 px-6 py-3 text-sm font-medium text-emerald-900">
                {resultado.mensaje}
              </div>

              {/* Tarjetas destacadas de embarque */}
              <div className="grid gap-4 border-b border-slate-200 bg-slate-50/50 p-6 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Asiento asignado
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-slate-900">
                    {resultado.datos.pasajero.asiento}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Grupo de embarque
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-sky-700">
                    {resultado.datos.pasajero.grupoEmbarque}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Vuelo
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-slate-900">
                    {resultado.datos.vuelo.codigoVuelo}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Clase
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold uppercase text-slate-700">
                    {resultado.datos.vuelo.clase}
                  </p>
                </div>
              </div>

              {/* Grilla completa: Pasajero y Vuelo */}
              <div className="grid gap-6 p-6 md:grid-cols-2">
                {/* Datos del Pasajero */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                  <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                    <span>👤</span> Información del Pasajero
                  </h4>
                  <dl className="mt-4 divide-y divide-slate-200 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Nombre completo:</dt>
                      <dd className="font-semibold text-slate-900">{resultado.datos.pasajero.nombre}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Documento (DNI):</dt>
                      <dd className="font-mono font-semibold text-slate-900">{resultado.datos.pasajero.dni}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Teléfono:</dt>
                      <dd className="font-mono text-slate-900">{resultado.datos.pasajero.telefono}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Asiento:</dt>
                      <dd className="font-mono font-bold text-slate-900">{resultado.datos.pasajero.asiento}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Grupo:</dt>
                      <dd className="font-mono font-bold text-sky-700">{resultado.datos.pasajero.grupoEmbarque}</dd>
                    </div>
                  </dl>
                </div>

                {/* Datos del Vuelo */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                  <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
                    <span>🛫</span> Información del Vuelo
                  </h4>
                  <dl className="mt-4 divide-y divide-slate-200 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Código de Vuelo:</dt>
                      <dd className="font-mono font-bold text-slate-900">{resultado.datos.vuelo.codigoVuelo}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Ruta:</dt>
                      <dd className="font-semibold text-slate-900">
                        {resultado.datos.vuelo.origen} → {resultado.datos.vuelo.destino}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Fecha de salida:</dt>
                      <dd className="font-mono text-slate-900">{resultado.datos.vuelo.fecha}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Horario programado:</dt>
                      <dd className="font-mono text-slate-900">
                        Salida: <span className="font-bold">{resultado.datos.vuelo.horaSalida}</span> | Llegada:{' '}
                        <span className="font-bold">{resultado.datos.vuelo.horaLlegada}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Aeronave:</dt>
                      <dd className="text-slate-900">{resultado.datos.vuelo.tipoAvion}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Código de Reserva (PNR):</dt>
                      <dd className="font-mono font-semibold text-slate-700">{resultado.datos.vuelo.pnr}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Pie con metadatos de auditoría */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
                <span>
                  <strong className="font-mono font-semibold text-slate-700">Ticket ID:</strong>{' '}
                  <span className="font-mono">{resultado.datos.ticketId}</span>
                </span>
                <span>
                  <strong className="font-semibold text-slate-700">Validado en mostrador:</strong>{' '}
                  <span className="font-mono">{resultado.datos.validadoAt}</span>
                </span>
              </div>
            </div>
          )}

          {/* Estado: Ticket ya validado */}
          {!resultado.ok && resultado.estado === 'YA_VALIDADO' && (
            <div className="overflow-hidden rounded-[24px] border-2 border-amber-500 bg-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-amber-600 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
                    ⚠️
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">Ticket Ya Utilizado o Validado</h3>
                    <p className="text-xs text-amber-100">
                      No es posible reutilizar este ticket para completar el embarque
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-900 shadow-sm">
                  EMBARQUE DENEGADO
                </span>
              </div>

              <div className="p-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">{resultado.mensaje}</p>
                  <p className="mt-2 text-xs text-amber-800">
                    Acción requerida: Verifique con el supervisor de aeropuerto o solicite al pasajero una identificación adicional.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Estado: Ticket inválido o inexistente */}
          {!resultado.ok && (resultado.estado === 'INEXISTENTE' || resultado.estado === 'INVALIDO') && (
            <div className="overflow-hidden rounded-[24px] border-2 border-rose-500 bg-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-rose-600 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
                    ✕
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">Validación Rechazada</h3>
                    <p className="text-xs text-rose-100">Ticket inexistente o no habilitado para embarque</p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-3.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-rose-900 shadow-sm">
                  EMBARQUE BLOQUEADO
                </span>
              </div>

              <div className="p-6">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-semibold">{resultado.mensaje}</p>
                  <p className="mt-2 text-xs text-rose-800">
                    El sistema impide continuar con el proceso de embarque para este ticket.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Listado de tickets emitidos recientemente */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900">Tickets emitidos recientemente</h4>
            <p className="text-xs text-slate-500">
              Seleccione un ticket para cargar su identificador en el formulario.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarRecientes(!mostrarRecientes)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {mostrarRecientes ? 'Ocultar listado' : 'Ver tickets recientes (' + ticketsRecientes.length + ')'}
          </button>
        </div>

        {mostrarRecientes && (
          <div className="mt-4 space-y-2">
            {ticketsRecientes.length === 0 ? (
              <p className="text-xs text-slate-500">No hay tickets emitidos registrados en la base de datos.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ticketsRecientes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSeleccionarReciente(t.id)}
                    className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{t.codigoVuelo}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          t.validado
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t.validado ? 'Ya validado' : 'Pendiente'}
                      </span>
                    </div>
                    <span className="mt-1 text-xs font-semibold text-slate-700">
                      {t.pasajeroNombre} (DNI: {t.pasajeroDni}) · Asiento: {t.asiento || 'Sin asignar'}
                    </span>
                    <span className="mt-1 font-mono text-[11px] text-slate-500 break-all">{t.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
