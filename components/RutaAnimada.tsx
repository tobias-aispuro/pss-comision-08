// Ruta de vuelo animada: un avión recorre un arco punteado que se va dibujando detrás de él,
// del punto de origen al destino (que late). Con "reducir movimiento" se muestra la ruta quieta.

const RUTA = 'M 20 170 C 150 40, 380 10, 580 110'
const DURACION = '7s'
// El avión vuela el 80 % del ciclo y espera en destino el resto.
const TIEMPOS = '0;0.8;1'
const AVANCE = '0;1;1'

// Avión apuntando hacia +x, centrado en el origen para que siga la tangente de la ruta.
const AVION =
  'M21 12c0-.8-.7-1.5-1.5-1.5H14L9 3H7l2.5 7.5H5L3.5 8.5H2l1 3.5-1 3.5h1.5L5 13.5h4.5L7 21h2l5-7.5h5.5c.8 0 1.5-.7 1.5-1.5z'

// "oscura" va sobre fondos oscuros (panel del login); "clara" sobre el fondo claro de la página principal.
const VARIANTES = {
  oscura: { guia: 'white', guiaOpacidad: '0.15', ruta: 'white', avion: 'white', origen: '#08A6C9', destino: 'white', pulso: '#08A6C9' },
  clara: { guia: '#318098', guiaOpacidad: '0.18', ruta: '#08A6C9', avion: '#318098', origen: '#318098', destino: '#08A6C9', pulso: '#08A6C9' },
}

export default function RutaAnimada({
  className = '',
  variante = 'oscura',
}: {
  className?: string
  variante?: keyof typeof VARIANTES
}) {
  const c = VARIANTES[variante]
  const mascara = `ruta-revelada-${variante}`

  return (
    <svg viewBox="0 0 600 200" className={className} fill="none" aria-hidden="true">
      <defs>
        <mask id={mascara} maskUnits="userSpaceOnUse">
          <path d={RUTA} stroke="white" strokeWidth="8" pathLength={1} strokeDasharray="1" strokeDashoffset="1">
            <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes={TIEMPOS} dur={DURACION} repeatCount="indefinite" />
          </path>
        </mask>
      </defs>

      {/* Guía tenue de la ruta completa */}
      <path d={RUTA} stroke={c.guia} strokeOpacity={c.guiaOpacidad} strokeWidth="2" strokeDasharray="6 9" strokeLinecap="round" />

      {/* Tramo ya recorrido (animado) o ruta completa (sin animación) */}
      <path
        d={RUTA}
        stroke={c.ruta}
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeDasharray="6 9"
        strokeLinecap="round"
        mask={`url(#${mascara})`}
        className="motion-reduce:hidden"
      />
      <path
        d={RUTA}
        stroke={c.ruta}
        strokeOpacity="0.75"
        strokeWidth="2"
        strokeDasharray="6 9"
        strokeLinecap="round"
        className="hidden motion-reduce:block"
      />

      {/* Origen */}
      <circle cx="20" cy="170" r="4" fill={c.origen} />

      {/* Destino con pulso */}
      <circle cx="580" cy="110" r="6" stroke={c.pulso} strokeWidth="2" className="motion-reduce:hidden">
        <animate attributeName="r" values="6;18" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.9;0" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="580" cy="110" r="6" fill={c.destino} />

      {/* Avión en movimiento */}
      <g className="motion-reduce:hidden">
        <animateMotion dur={DURACION} repeatCount="indefinite" rotate="auto" keyPoints={AVANCE} keyTimes={TIEMPOS} calcMode="linear" path={RUTA} />
        <path d={AVION} fill={c.avion} transform="translate(-12 -12)" />
      </g>

      {/* Avión quieto a mitad de camino (sin animación) */}
      <g className="hidden motion-reduce:block" transform="translate(300 52) rotate(-2)">
        <path d={AVION} fill={c.avion} transform="translate(-12 -12)" />
      </g>
    </svg>
  )
}
