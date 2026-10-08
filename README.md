# ✈️ SkyLink - Sistema Integral de Operaciones Aeroportuarias

¡Bienvenidos al repositorio de SkyLink! Este documento contiene los pasos necesarios para que cualquier miembro del equipo pueda configurar el proyecto localmente y comenzar a programar sus Historias de Usuario (US).

## 🛠 Tecnologías Utilizadas
* **Framework:** Next.js 16 (App Router)
* **Base de Datos:** PostgreSQL alojada en [Neon.tech](https://neon.tech) (Compartida)
* **ORM:** Prisma 7 (con `@prisma/adapter-pg`)
* **Autenticación:** Clerk
* **Estilos:** Tailwind CSS

---

## 🚀 Guía de Instalación Rápida

Sigue estos pasos estrictamente en orden para levantar el entorno de desarrollo en tu computadora.

### 1. Clonar el repositorio
Abre tu terminal y clona el proyecto en tu carpeta local:
```bash
git clone <URL_DEL_REPOSITORIO>
cd pss-comision-08
```

### 2. Instalar dependencias
Instala todas las librerías necesarias ejecutando:
```bash
npm install
```

### 3. Configurar Variables de Entorno (IMPORTANTE)
El proyecto requiere credenciales para conectarse a la base de datos de Neon y al sistema de Clerk. **Por seguridad, el archivo `.env` no se sube a GitHub**, por lo que cada uno debe crearlo manualmente.

1. En la raíz del proyecto (al mismo nivel que `package.json`), crea un archivo llamado exactamente `.env`.
2. Copia y pega el siguiente contenido dentro de ese archivo:

```env
MIREN EL GRUPO DE WPPPPP
```

3. Para que se envíen los emails a los pasajeros (avisos de modificación y de cancelación de vuelos), agrega además las credenciales de la cuenta de Gmail. `EMAIL_PASSWORD` es una contraseña de aplicación de Google, no la contraseña normal de la cuenta:

```env
EMAIL_USER=
EMAIL_PASSWORD=
```

### 4. Generar el Cliente de Prisma
Como Prisma crea código a medida para que TypeScript entienda nuestra base de datos, debes ejecutar este comando cada vez que bajes el proyecto por primera vez o cuando alguien del equipo modifique el archivo `schema.prisma`:
```bash
npx prisma generate
```

### 5. Levantar el Servidor Local
Ya estás listo para probar la aplicación. Ejecuta:
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la página principal.

---

## ⚠️ Reglas del Equipo (Base de Datos Compartida)

Estamos usando **la misma base de datos en la nube (Neon)** para todos. Esto significa que si creas un pasajero o un vuelo en tu entorno local, todos los demás lo verán al instante.

**Regla de Oro con Prisma:**
Si te toca hacer una tarea que requiera modificar la estructura de la base de datos (agregar nuevas tablas o columnas en `prisma/schema.prisma`), debes avisar al equipo. 
Para aplicar esos cambios a la base de datos de Neon, usa:
```bash
npx prisma db push
```
*(Si no modificaste el esquema, **NO** ejecutes este comando, solo usa `npx prisma generate`).*

## 🧰 Herramientas Útiles
Si necesitas ver qué datos están guardados en la base de datos sin entrar a la web de Neon, puedes usar la interfaz local de Prisma:
```bash
npx prisma studio
```
Esto abrirá un panel de control en `http://localhost:5555`.


## Usuarios y roles
Cuenta Admin:
Email: admin@skylink.com 
Contraseña: SkylinkAdmin2026*

Cuenta Empleado:
Email: empleado@skylink.com
Contraseña: SkylinkEmpleado2026*

Cuenta Pasajero:
Email: pasajero@skylink.com
Contraseña: SkylinkPasajero2026*
