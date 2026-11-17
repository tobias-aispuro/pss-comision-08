# US-24 — Reubicación manual en vuelos alternativos

> Estado: **implementado** en la rama `feat/us-24-reubicacion`. El schema y el backfill ya están aplicados en Neon, y hay datos de prueba cargados (ver "Datos de prueba cargados").

## Historia de usuario

Como **Empleado de Mostrador**, quiero consultar los vuelos alternativos de un pasajero afectado por la cancelación de su vuelo y reubicarlo manualmente en uno con disponibilidad, para que su reserva quede actualizada en el sistema.

**Tarea:** implementar la consulta de vuelos alternativos en la interfaz del empleado de mostrador y la acción para seleccionar una alternativa y reubicar manualmente al pasajero, actualizando su reserva en el sistema.

## Criterios de aceptación (Plan de demo)

### Escenario 1 — Camino exitoso: reubicación en un vuelo alternativo

1. Ingresar al sistema con un usuario con rol Empleado de Mostrador.
2. Acceder a la sección de gestión de pasajeros afectados por cancelaciones de vuelos.
3. Seleccionar un pasajero que tenga una reserva asociada a un vuelo cancelado.
4. Consultar los vuelos alternativos disponibles.
5. Seleccionar un vuelo alternativo que cuente con disponibilidad.
6. Confirmar la reubicación del pasajero.

**Resultado esperado:** el sistema registra la reubicación manual del pasajero, actualiza su reserva y lo asigna al vuelo alternativo seleccionado.

### Escenario 2 — Vuelo alternativo sin disponibilidad

1. Ingresar al sistema como Empleado de Mostrador.
2. Seleccionar un pasajero afectado por la cancelación de su vuelo.
3. Consultar los vuelos alternativos.
4. Intentar seleccionar un vuelo que no cuente con disponibilidad.

**Resultado esperado:** el sistema impide realizar la reubicación en un vuelo sin disponibilidad e informa que no es posible completar la operación.

### Escenario 3 — Cancelación de la operación de reubicación

1. Ingresar al sistema como Empleado de Mostrador.
2. Seleccionar un pasajero afectado por la cancelación de un vuelo.
3. Consultar y seleccionar un vuelo alternativo disponible.
4. Antes de confirmar la operación, cancelar o abandonar el proceso de reubicación.

**Resultado esperado:** el sistema no registra la reubicación y mantiene la reserva del pasajero en su estado anterior hasta que se confirme una alternativa.

### Escenario 4 — Usuario sin permisos de reubicación

1. Ingresar al sistema con una cuenta que no posea el rol Empleado de Mostrador.
2. Intentar acceder a la sección de reubicación manual de pasajeros.
3. Intentar realizar una reubicación.

**Resultado esperado:** el sistema restringe el acceso a la funcionalidad y evita que usuarios sin los permisos correspondientes modifiquen las reservas de los pasajeros.

## Situación actual del sistema

- El rol `EMPLEADO_MOSTRADOR` ya existe y tiene su panel en `/empleado` (`app/empleado/layout.tsx`), con el mismo `PanelLayout` que pasajero y admin.
- **Cancelación de una fecha (US-03)** — `cancelarVueloEnFecha` en `app/admin/vuelos/actions.ts`: crea un `CancelacionVuelo` y pasa las reservas `PENDIENTE`/`CONFIRMADA` de esa salida a `CANCELADA`.
  Problema: después no hay forma de distinguirlas de las que canceló el propio pasajero (US-13).
- **Cancelación de la frecuencia completa (US-04)** — `cancelarFrecuencia`: **borra el vuelo** y sus reservas se borran en cascada.
  Problema: esos pasajeros no se pueden reubicar porque su reserva deja de existir.
- La búsqueda de vuelos ya resuelve casi todo lo que necesitan las alternativas.
  - `buscarTramo` en `lib/vuelos-search.js` filtra por ruta, día de operación, período y fechas canceladas.
  - También descuenta los asientos reservados de cada clase.
- El check-in (US-18) guarda `checkInCompletado`, `asiento` y `grupoEmbarque` por pasajero. Al cambiar de vuelo, esos datos dejan de ser válidos.

## Diseño propuesto

### 1. Datos (schema) — se aplica con `npx prisma db push`

En `Reserva`:

```prisma
// true = cancelada por la cancelación del vuelo (US-03), no por el pasajero; se puede reubicar (US-24)
canceladaPorVuelo Boolean @default(false)
reubicaciones     Reubicacion[]
```

Modelo nuevo, que funciona como historial de cada reubicación manual (el "registro" que pide el escenario 1):

```prisma
model Reubicacion {
  id              String   @id @default(uuid())
  reservaId       String
  vueloAnteriorId String
  fechaAnterior   String
  vueloNuevoId    String
  fechaNueva      String
  empleadoId      String
  createdAt       DateTime @default(now())
  reserva         Reserva  @relation(fields: [reservaId], references: [id], onDelete: Cascade)

  @@index([reservaId])
}
```

- **Por qué un campo y no un estado nuevo en `EstadoReserva`:** la reserva afectada sigue siendo `CANCELADA` para todo el resto del sistema. Así no hay que tocar las consultas de asientos, pagos, ocupación, check-in ni "Mis reservas", que hoy filtran por `PENDIENTE`/`CONFIRMADA`.
- **Por qué una tabla de historial:** la reserva queda apuntando al vuelo nuevo. Sin historial se perdería de qué vuelo venía y qué empleado hizo el cambio.
- **Reservas que ya están en la base:** un script de una sola vez marca `canceladaPorVuelo = true` en las reservas `CANCELADA` que cumplan dos condiciones:
  - su salida (`vueloId` + `fecha`) tiene un `CancelacionVuelo`;
  - ninguno de sus pasajeros tiene `canceladoAt`, porque en ese caso las canceló el pasajero.

### 2. Cambio en la cancelación de vuelos (US-03)

En `cancelarVueloEnFecha`, el `updateMany` pasa a `data: { estado: 'CANCELADA', canceladaPorVuelo: true }`. No cambia nada más (mails, contadores ni mensajes).

### 3. Reglas de negocio — `lib/reubicacion-utils.js` (CommonJS + tests con `node --test`)

- **Reserva reubicable:** `estado = CANCELADA`, `canceladaPorVuelo = true`, **paga** (`pagadoAt` con valor) y con al menos un pasajero activo. No importa si la salida original ya pasó: el pasajero puede presentarse en el mostrador después.
- **Vuelo alternativo válido:**
  - misma ruta (origen y destino);
  - activo;
  - opera ese día y está dentro de su período;
  - esa fecha no está cancelada;
  - no es la misma salida cancelada;
  - el despegue es posterior al momento actual.
- **Disponibilidad:** en la **misma clase** de la reserva, `capacidad − reservados ≥ pasajeros activos`. Se reutiliza `prepararVuelo` / `asientosReservados`.
- **Estado después de reubicar:** `CONFIRMADA`. Como solo se reubican reservas pagas, ese es el estado que tenían antes de la cancelación.
- **Check-in:** se reinicia para los pasajeros activos (`checkInCompletado = false`, `asiento = null`, `grupoEmbarque = null`). Tienen que hacerlo de nuevo en el vuelo nuevo.

Funciones: `pasajerosActivos(pasajeros)`, `evaluarReubicable(reserva, pasajeros)`, `validarAlternativa({ reserva, vueloOriginal, alternativa, fecha, canceladas, reservados, cantidad }, ahora)` y la constante `ESTADO_TRAS_REUBICACION`.

### 4. Acción del servidor — `app/empleado/reubicacion/actions.ts`

`reubicarReserva(prevState, formData)`:

1. `requireRole(['EMPLEADO_MOSTRADOR'])`. Si no tiene el rol, devuelve un error y no toca nada (escenario 4).
2. Lee `reservaId`, `vueloId` y `fecha`.
3. Abre una transacción `Serializable`, igual que la compra, para que dos empleados no ocupen el mismo lugar:
   - vuelve a leer la reserva y verifica que siga siendo reubicable;
   - vuelve a leer el vuelo alternativo y sus asientos reservados en esa fecha;
   - valida con `validarAlternativa`; si no hay lugar, devuelve *"No es posible completar la reubicación: el vuelo seleccionado no tiene disponibilidad."* (escenario 2);
   - actualiza la reserva: `vueloId`, `fecha`, `estado = CONFIRMADA`, `canceladaPorVuelo = false` y `asientos` igual a la cantidad de pasajeros activos;
   - reinicia el check-in de los pasajeros activos;
   - crea el registro en `Reubicacion` con el id del empleado.
4. Revalida las páginas y redirige al listado con el cartel *"Pasajero reubicado en el vuelo X del día Y"* (escenario 1).

### 5. Interfaz del empleado

Nueva opción en el menú de `app/empleado/layout.tsx`: **"Reubicación"** → `/empleado/reubicacion`.

**a) `/empleado/reubicacion` — Pasajeros afectados**

- Muestra una tabla con las reservas reubicables. Columnas: vuelo cancelado, ruta, fecha y hora, motivo de la cancelación, titular de la compra, pasajeros, clase y estado de pago.
- Tiene un filtro opcional por DNI o código de vuelo, del lado del servidor, con query params.
- Cada fila lleva un botón **"Ver alternativas"**.
- Si no hay afectados, muestra un estado vacío.

**b) `/empleado/reubicacion/[reservaId]` — Vuelos alternativos**

- **Resumen:** reserva original (vuelo cancelado, fecha y motivo) y pasajeros activos.
- **Selector de fecha:** por defecto, la fecha original o hoy si ya pasó. Va con flechas de "día anterior" y "día siguiente", y se maneja con un query param `?fecha=`.
- **Alternativas para esa fecha:** cada tarjeta muestra horario, duración, tipo de avión y lugares libres en la clase de la reserva. Se usa un componente propio (`AlternativaVuelo`) porque `TarjetaVuelo` lleva a la compra.
  - **Con lugar:** botón **"Seleccionar"**.
  - **Sin lugar:** la tarjeta se ve atenuada y el botón queda deshabilitado con *"Sin disponibilidad para N pasajeros"* (escenario 2). Además, el servidor rechaza la operación aunque se fuerce el formulario.
- **Al seleccionar:** se abre el modal `ConfirmarReubicacionModal`, con el vuelo actual, el vuelo nuevo, los pasajeros y el aviso de que se reinicia el check-in.
  - **"Confirmar reubicación":** ejecuta la acción.
  - **"Volver"**, la tecla Escape o salir de la página: no se guarda nada y la reserva sigue como estaba (escenario 3).

**Permisos (escenario 4):** las dos páginas llaman a `requireRole(['EMPLEADO_MOSTRADOR'])`. Un pasajero o un admin que entra por URL termina en `/acceso-denegado`, y la acción vuelve a verificar el rol.

### 6. Tests (`tests/reubicacion-utils.test.js`)

- Reserva reubicable o no:
  - cancelada por el pasajero;
  - sin pasajeros activos;
  - salida ya pasada;
  - activa.
- Alternativa válida o inválida:
  - otra ruta;
  - la misma salida cancelada;
  - una fecha cancelada;
  - un despegue que ya pasó.
- Disponibilidad:
  - justo alcanza;
  - falta un lugar;
  - capacidad sin configurar.
- `estadoTrasReubicacion`: `CONFIRMADA` si estaba paga y `PENDIENTE` si no.
- `cancelarVueloEnFecha` marca `canceladaPorVuelo`. Se ajusta `tests/flight-cancellation.test.js`.

## Decisiones tomadas

1. **Frecuencia completa (US-04): no se modificó.** Sigue borrando el vuelo y sus reservas, así que la US-24 cubre las cancelaciones de **una fecha puntual**, que son las del plan de demo. Si el equipo quiere reubicar también a esos pasajeros, la propuesta es que `cancelarFrecuencia` desactive el vuelo (`activo = false`) en vez de borrarlo y marque sus reservas futuras con `canceladaPorVuelo`.
2. **Solo el Empleado de Mostrador** puede ver la sección y reubicar. El administrador no entra, como pide el escenario 4.
3. **Misma clase.** La reubicación se hace siempre en la clase de la reserva.
4. **Sin mail al pasajero.** No lo pide el plan de demo. Queda como mejora, reutilizando `lib/mailer`.
5. **Solo reservas pagas.** Una reserva sin pagar vence según su `createdAt` (`esReservaExpirada`), así que reubicarla la dejaría vencida. Esas no aparecen en la lista y el pasajero tiene que hacer una compra nueva.

## Riesgos conocidos

- **Formato de los vuelos nuevos.** Los vuelos cargados con el formulario nuevo de alta guardan los días como `Jueves` (en vez de `JUE`) y el período con fecha completa (`YYYY-MM-DD`). Las ciudades quedan como `Ciudad, Región, País`.
  - `construirFiltroTramo` espera el formato viejo, así que esos vuelos **no van a aparecer como alternativas**, igual que hoy no aparecen en la búsqueda del pasajero.
  - Para la demo conviene usar vuelos con formato viejo, o resolver primero la compatibilidad de formatos.
- **Neon compartido.** El `db push` agrega una columna con valor por defecto y una tabla nueva. Es un cambio aditivo y no rompe a los demás, pero tienen que hacer `git pull` + `npm install` (o `npx prisma generate`) y reiniciar `npm run dev`.

## Preparación de la demo

| Caso | Datos necesarios |
|---|---|
| Escenario 1 | Una reserva **paga** de un pasajero en un vuelo (por ejemplo, SL712 Buenos Aires → Cordoba) cuya fecha se cancela desde el admin. Otra salida con lugar en la misma ruta (otra fecha del SL712 u otro vuelo Buenos Aires → Cordoba). |
| Escenario 2 | Una alternativa con capacidad agotada en la clase de la reserva (bajar la capacidad desde la edición del vuelo o cargar reservas que la completen). |
| Escenario 3 | La misma reserva del escenario 1: abrir el modal y tocar "Volver". |
| Escenario 4 | Entrar con una cuenta de Pasajero o Administrador a `/empleado/reubicacion`. |

Para tener un usuario Empleado de Mostrador hay que cambiar a mano el `rol` de un usuario a `EMPLEADO_MOSTRADOR` en la base, porque el registro crea siempre `PASAJERO`.

## Datos de prueba cargados

Están en Neon con ids que empiezan con `us24-`, para encontrarlos y borrarlos fácil. Todas las reservas son de la cuenta **Pasajero Prueba**, y para operar se usa el usuario **Empleado Prueba** (rol `EMPLEADO_MOSTRADOR`).

| Dato | Detalle |
|---|---|
| Vuelo cancelado | **SL712** Buenos Aires → Cordoba del **miércoles 02/12/2026** (07:00). Motivo: "Prueba US-24: mantenimiento no programado". |
| Reserva afectada | Paga, en **Primera**, con 2 pasajeros: Pasajero Prueba (DNI 22416589) y Acompañante Prueba (DNI 30111222). |
| Vuelo lleno | **SL712 del jueves 03/12/2026**: tiene 11 de los 12 lugares de Primera ocupados, así que queda 1 libre y no alcanza para 2 pasajeros. |

| Escenario | Cómo probarlo |
|---|---|
| 1 · Reubicación exitosa | Entrar como Empleado Prueba → Reubicación → "Ver alternativas" en el SL712 del 02/12. Ese mismo día aparecen **AR212 17:12**, **AR123 18:00** y **AR789 19:20**, que no tienen capacidad cargada. También se puede pasar al **04/12**, donde el **SL712** tiene 12 lugares libres. Elegir uno y confirmar. |
| 2 · Sin disponibilidad | En las alternativas, ir al **03/12**: el **SL712** aparece con "Sin disponibilidad" y el botón deshabilitado. El **AR125** de ese día sí se puede elegir. |
| 3 · Cancelar la operación | Elegir una alternativa y tocar **"Volver"** en la confirmación: la reserva sigue en la lista de afectados, sin cambios. |
| 4 · Sin permisos | Entrar como Pasajero Prueba o como Administrador y abrir `/empleado/reubicacion`: redirige a acceso denegado. |

También aparece en la lista una reserva afectada más vieja, del **SL716 del 23/10**, que el backfill marcó a partir de una cancelación real.

Para borrar los datos de prueba:

```sql
DELETE FROM "Reserva" WHERE id IN ('us24-reserva-afectada', 'us24-reserva-ocupacion');
DELETE FROM "CancelacionVuelo" WHERE id = 'us24-cancelacion';
```

## Backfill de las cancelaciones existentes

Las reservas que el admin canceló **antes** de este cambio no tienen `canceladaPorVuelo`. Este SQL las marca una sola vez, después del `db push`.

Toma las reservas canceladas cuya salida tiene un `CancelacionVuelo` y descarta las que tienen algún pasajero con `canceladoAt`, porque esas las canceló el pasajero o vencieron sin pagarse:

```sql
UPDATE "Reserva" r
SET "canceladaPorVuelo" = true
WHERE r.estado = 'CANCELADA'
  AND EXISTS (
    SELECT 1 FROM "CancelacionVuelo" c
    WHERE c."vueloId" = r."vueloId" AND c.fecha = r.fecha
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PasajeroReserva" p
    WHERE p."reservaId" = r.id AND p."canceladoAt" IS NOT NULL
  );
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `prisma/schema.prisma` | `Reserva.canceladaPorVuelo` y modelo `Reubicacion` |
| `app/admin/vuelos/actions.ts` | La cancelación de una fecha marca `canceladaPorVuelo` |
| `lib/reubicacion-utils.js` | Reglas: reserva reubicable, alternativa válida y disponibilidad |
| `lib/reubicacion-datos.ts` | Consultas: reservas afectadas y vuelos alternativos de una fecha |
| `app/empleado/reubicacion/page.tsx` | Pasajeros afectados, con búsqueda por DNI o código de vuelo |
| `app/empleado/reubicacion/[reservaId]/page.tsx` | Vuelos alternativos con selector de fecha |
| `app/empleado/reubicacion/actions.ts` | Acción `reubicarReserva` |
| `components/ConfirmarReubicacionModal.tsx` | Confirmación con "Volver" |
| `app/empleado/layout.tsx` | Opción "Reubicación" en el menú del empleado |
| `tests/reubicacion-utils.test.js`, `tests/reubicacion-action.test.js` | Tests de reglas y de la acción |

## Tareas

- [x] Schema: `canceladaPorVuelo` + modelo `Reubicacion`
- [x] Schema aplicado en Neon
- [x] Backfill de `canceladaPorVuelo` para las cancelaciones existentes (5 reservas marcadas)
- [x] US-03: marcar `canceladaPorVuelo` al cancelar una fecha (+ ajustar test)
- [x] `lib/reubicacion-utils.js` + tests
- [x] Acción `reubicarReserva` + tests
- [x] Página de pasajeros afectados
- [x] Página de vuelos alternativos + modal de confirmación
- [x] Opción "Reubicación" en el menú del empleado
- [ ] Probar los 4 escenarios en local y documentar los resultados
