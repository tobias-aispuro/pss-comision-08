// Tarjeta de métrica de los paneles, con el estilo de los wireframes (etiqueta, valor grande y detalle).
const acentos = {
  primario: { borde: 'border-r-[#08A6C9]', icono: 'bg-sky-50 text-sky-700' },
  secundario: { borde: 'border-r-[#318098]', icono: 'bg-teal-50 text-teal-700' },
  terciario: { borde: 'border-r-[#6475AC]', icono: 'bg-indigo-50 text-indigo-700' },
  alerta: { borde: 'border-r-amber-400', icono: 'bg-amber-50 text-amber-700' },
}

export default function MetricaCard({
  etiqueta,
  valor,
  unidad,
  detalle,
  icono,
  acento = 'primario',
}: {
  etiqueta: string
  valor: string | number
  unidad?: string
  detalle?: string
  icono: string
  acento?: keyof typeof acentos
}) {
  const estilo = acentos[acento]

  return (
    <div className={`rounded-2xl border border-slate-200 border-r-4 bg-white p-5 shadow-sm ${estilo.borde}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{etiqueta}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm ${estilo.icono}`} aria-hidden="true">
          {icono}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {valor}
        {unidad && <span className="ml-1.5 font-mono text-xs font-semibold text-[#08A6C9]">{unidad}</span>}
      </p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
    </div>
  )
}
