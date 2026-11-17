# US-18 — Ventana de check-in y selección de asientos

Alcance según las páginas 1 y 2 de **Plan de demo Sprint 3**: habilitación temporal del check-in, selección de asientos y confirmación. La emisión, descarga y envío de tickets corresponden a la US-19.

## Comportamiento implementado

- Solo puede realizarlo un pasajero autenticado sobre una reserva propia y confirmada, con pasajeros activos y un vuelo disponible.
- La ventana incluye los instantes exactos de **14 días antes** y **48 horas antes** del despegue. Se usa la fecha de la reserva y la hora de salida en la zona del aeropuerto de origen; si no se configuró una zona, se usa Argentina.
- Antes de la apertura, el botón está deshabilitado y se informa la fecha y hora de habilitación en el huso de origen.
- Después del cierre, se bloquea la operación y se indica que el pasajero debe acercarse al mostrador del aeropuerto.
- El mapa muestra Primera Clase y Economy con sus capacidades configuradas. Los asientos ocupados y los de otra clase están deshabilitados.
- Cada pasajero pendiente debe elegir un asiento distinto de su clase. La confirmación vuelve a verificar permisos, ventana, cancelaciones y disponibilidad en el servidor.
- La asignación del grupo es atómica. Dos confirmaciones simultáneas del mismo asiento para la misma salida no pueden ser exitosas.
- Al confirmar se muestra **Check-in completado**, junto con los nombres y asientos asignados. El listado de check-in y Mis reservas reflejan el resultado al volver o recargar.
- Un check-in ya realizado sigue figurando como completado después del cierre de la ventana y no permite reasignar sus asientos.

El estado se guarda por pasajero en `PasajeroReserva.checkInCompletado` y `asiento`. Una reserva se muestra como **Check-in completado** cuando todos sus pasajeros activos terminaron. Los pasajes cancelados no participan del cálculo. Se conserva `Reserva.estado = CONFIRMADA` como estado de compra para mantener compatibles las consultas de ocupación, reservas y tickets; no se necesita una migración de base de datos.

## Preparación de la demo

Usar una cuenta de Pasajero con reservas confirmadas y vuelos activos que operen en las fechas elegidas. Configurar capacidades mayores que cero para ambas clases. Todas las reservas deben tener al menos un pasajero activo.

Preparar estas reservas en relación con la hora en que se hará la demo:

| Caso | Datos necesarios |
| --- | --- |
| Exitoso | Vuelo dentro de 7 días, reserva sin check-in y asientos libres en su clase. |
| Anticipado | Vuelo dentro de 20 días y reserva sin check-in. |
| Expirado | Vuelo dentro de 24 horas y reserva sin check-in. |
| Asiento ocupado | Otra reserva confirmada del mismo vuelo y fecha con un asiento ya asignado. |
| Otra clase | Reserva Economy sobre un avión que también tenga asientos de Primera Clase. |

### Recorrido de los cinco escenarios

1. **Exitoso:** ingresar a Check-in online, abrir la reserva habilitada, elegir un asiento por pasajero y pulsar Confirmar Asiento (o Confirmar asientos para un grupo). Verificar el mensaje de completado y los asientos. Volver al listado y a Mis reservas; recargar para comprobar que persiste y que no se ofrece repetirlo.
2. **Anticipado:** mostrar la reserva a más de 14 días. Verificar el botón deshabilitado y la fecha/hora exacta de apertura.
3. **Expirado:** mostrar la reserva a menos de 48 horas. Verificar el botón deshabilitado y el aviso de atención en mostrador. El acceso directo a la URL tampoco debe mostrar el mapa.
4. **Asiento ocupado:** abrir una reserva habilitada de la misma salida. Intentar elegir el asiento gris ocupado; verificar que no se selecciona y que sí puede elegirse otro libre.
5. **Clase incorrecta:** con la reserva Economy, intentar elegir un asiento de Primera Clase; verificar que está deshabilitado y elegir uno libre de Economy.

Para repetir el escenario exitoso, usar otra reserva pendiente de check-in y otro asiento libre. La confirmación es persistente. La base de datos del equipo es compartida: coordinar los datos de demostración con el equipo.

## Verificación automatizada

```sh
node --test tests/check-in-utils.test.js tests/asientos-check-in.test.js tests/check-in-ui.test.js
npm test
npx tsc --noEmit
npm run build
```

Las pruebas específicas cubren los límites temporales, zonas horarias, estados completados y parciales, pasajeros cancelados, renderizado de botones y mensajes, validación de clase, asignaciones simultáneas, permisos y rollback del grupo. Usan datos simulados y no escriben en la base de datos compartida.

### Validación del 17/11/2026

- Suite completa: 168 pruebas aprobadas, incluidas 31 de la US-18.
- TypeScript, ESLint de los archivos modificados y compilación de producción: aprobados. La compilación requiere acceso a Google Fonts para descargar las fuentes ya utilizadas por el proyecto.
- Interacción en Edge sin ventana: cinco escenarios del plan aprobados, más reserva grupal, resumen completado fuera de ventana y conflicto de disponibilidad al confirmar (8 verificaciones).
- La prueba en navegador utilizó los componentes reales con datos y acciones simuladas. No reemplaza el ensayo de la demo con sesión de Pasajero y reservas reales; no se crearon ni modificaron datos en la base compartida.
