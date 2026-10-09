# US-10 — Compra de pasajes para múltiples pasajeros

| Prioridad | Estimación |
|---|---|
| Media | 3 hs |

## Historia de usuario

Como **Comprador**, quiero seleccionar hasta 9 pasajes en una misma transacción e ingresar los datos personales (DNI, nombre, edad y teléfono) de cada integrante, para registrar formalmente a todos los pasajeros que viajan conmigo.

## Criterios de aceptación

### Escenario 1 — Camino exitoso

1. Loguearse en la página con un usuario Pasajero.
2. Haber realizado una búsqueda de vuelos y seleccionado un vuelo específico.
3. Seleccionar la cantidad de pasajes deseada (hasta 9).
4. Completar los datos personales (DNI, Nombre, Edad y Teléfono) de cada integrante.
5. Presionar el botón para confirmar o continuar con la compra.

**Resultado esperado:** El sistema registra formalmente a todos los pasajeros ingresados, asocia los datos a la transacción actual y permite avanzar al siguiente paso del proceso de compra. Se muestra una indicación visual de que los datos fueron guardados correctamente.

### Escenario 2 — Límite de pasajes excedido

1. Loguearse en la página con un usuario Pasajero.
2. Haber realizado una búsqueda de vuelos y seleccionado un vuelo específico.
3. Intentar seleccionar más de 9 pasajes para la misma transacción.

**Resultado esperado:** El sistema no permite seleccionar una cantidad mayor a 9 pasajes, mostrando un mensaje de error o deshabilitando la opción de agregar más pasajeros.

### Escenario 3 — Campos obligatorios incompletos

1. Loguearse en la página con un usuario Pasajero.
2. Seleccionar una cantidad válida de pasajes (ej. 2).
3. Omitir el ingreso de algún dato obligatorio (DNI, Nombre, Edad o Teléfono) para al menos uno de los pasajeros.
4. Intentar presionar el botón para continuar con la compra.

**Resultado esperado:** El sistema bloquea la acción, manteniendo el botón deshabilitado o mostrando mensajes de error indicando cuáles son los campos requeridos que faltan completar para poder registrar a los pasajeros.

## Tareas

- [ ] Front
- [ ] Back
- [ ] Testing

## Wireframes

<!-- Exportados como PNG/JPG/PDF en docs/wireframes/ -->

## Notas

