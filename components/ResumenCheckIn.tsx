export type PasajeroCheckIn = {
  id: string
  nombre: string
  asiento: string | null
  checkInCompletado: boolean
}

export default function ResumenCheckIn({ pasajeros }: { pasajeros: PasajeroCheckIn[] }) {
  return (
    <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-4 text-emerald-800">
      <p className="font-semibold">Check-in completado</p>
      <ul className="space-y-1 text-sm">
        {pasajeros.map((pasajero) => (
          <li key={pasajero.id}>
            {pasajero.nombre} · Asiento {pasajero.asiento ?? 'sin asignar'}
          </li>
        ))}
      </ul>
    </div>
  )
}
