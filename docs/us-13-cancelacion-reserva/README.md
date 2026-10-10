# US-13 — Cancelación de reserva desde plataforma web

| Prioridad | Estimación |
|---|---|
| Alta | 2 hs |

## Historia de usuario

Como **Pasajero**, quiero solicitar la cancelación de mi reserva desde el portal web hasta 48 horas antes del despegue, para autogestionar la anulación de mi pasaje.

## Criterios de aceptación

### Escenario 1 — Camino exitoso (Cancelación a tiempo)

1. Loguearse en la plataforma web con un usuario Pasajero.
2. Navegar a la sección de "Mis Reservas" o perfil del usuario.
3. Seleccionar una reserva cuyo vuelo tenga programado su despegue para dentro de más de 48 horas.
4. Presionar el botón o la opción para solicitar la cancelación.
5. Confirmar la intención de cancelar la reserva.

**Resultado esperado:** El sistema procesa la solicitud, anula el pasaje de manera exitosa y actualiza el estado de la reserva en el portal web. Se muestra un mensaje de confirmación al pasajero indicando que la cancelación se realizó correctamente.

### Escenario 2 — Cancelación fuera de término (Menos de 48 hs)

1. Loguearse en la plataforma web con un usuario Pasajero.
2. Navegar a la sección de "Mis Reservas" o perfil del usuario.
3. Seleccionar una reserva cuyo vuelo tenga programado su despegue en menos de 48 horas.
4. Intentar buscar o presionar la opción de cancelación.

**Resultado esperado:** El sistema no permite realizar la anulación. El botón de cancelación se encuentra deshabilitado, oculto, o al presionarlo se despliega un mensaje informando que ya ha expirado el plazo permitido (hasta 48 horas antes del despegue) para autogestionar la cancelación.

## Tareas

- [ ] Front
- [ ] Back
- [ ] Testing

## Wireframes

<!-- Exportados como PNG/JPG/PDF en docs/wireframes/ -->

## Notas

- Se cancela únicamente el pasaje del pasajero que solicita la cancelación (el pasajero de la reserva con el DNI de su cuenta). Los acompañantes de la misma reserva mantienen su pasaje.
- El plazo de 48 horas se calcula sobre la hora de salida en el huso horario del aeropuerto de origen.
- La notificación por email de la cancelación queda para una US posterior.
