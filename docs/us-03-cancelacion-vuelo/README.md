# US-03 — Cancelación de un vuelo en fecha específica

| Prioridad | Estimación |
|---|---|
| Media | 4 hs |

## Historia de usuario

Como **Administrador** del sistema, quiero cancelar la salida de un vuelo para una fecha puntual en específico, para responder a situaciones inesperadas (clima, mantenimiento, etc.) sin afectar la programación anual de las demás salidas programadas.

## Criterios de aceptación

### Escenario 1 — Camino exitoso

1. Loguearse en la página con un usuario administrador.
2. Seleccionar la opción "Todos los vuelos" en el panel de administrador.
3. Presionar el botón **Cancelar**.
4. Ver un cartel donde se muestran las 2 opciones de cancelación para seleccionar.
5. Presionar modalidad **Cancelar en Fecha puntual**.
6. Seleccionar la fecha deseada e ingresar el motivo de cancelación.
7. Presionar el botón **Confirmar cancelación**.

**Resultado esperado:** La salida del vuelo únicamente para la fecha seleccionada fue cancelada, manteniendo el resto de las salidas programadas en el año sin alteraciones. Se muestra un cartel de éxito al administrador ("Vuelo cancelado correctamente").

## Tareas

- [ ] Front
- [ ] Back
- [ ] Testing

## Wireframes

<!-- Exportados como PNG/JPG/PDF en docs/wireframes/ -->

## Notas

