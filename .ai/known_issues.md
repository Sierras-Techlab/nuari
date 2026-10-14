# Problemas conocidos y decisiones abiertas

- Actualizado: 2026-10-14

## Decisiones de producto abiertas

### Negocio piloto del MVP

Se eligieron barberías y negocios de servicios similares como segmento inicial de exploración. Todavía falta seleccionar un negocio piloto concreto y confirmar con él si la agenda de turnos es el registro manual que conviene reemplazar primero.

### Flujo y métrica de validación

El objetivo general es reemplazar un registro manual o Excel, pero todavía no se definieron el flujo exacto, el período de prueba ni la métrica cuantitativa de éxito.

### Persistencia del Turnero

Agenda y Caja todavía usan datos operativos locales que se reinician al recargar. Clientes, Servicios, Categorías, Profesionales y habilitaciones ya usan API tenant-aware. B1 creó y migró el esquema base en Neon dev; B2 agregó permisos; B3–B6 implementaron los módulos API; B7–B9 integraron Clientes, Servicios y Profesionales en sus rutas separadas. `/app/equipo` administra accesos. La Agenda conserva catálogo demo local y no está conectada a citas persistidas. Antes de usar el producto con datos de terceros falta cerrar la política de retención.

### Alcance funcional del Turnero

Servicios y Caja conservan demostraciones locales; Clientes, Servicios y Profesionales ya consumen persistencia API. Equipo administra miembros con acceso real según TASK-08. [TASK-09 — FEAT-003](../docs/tasks/TASK-09-feat-003-operational-catalog.md) define el núcleo persistente de clientes, catálogo y personal. B1–B10 cubren esquema, permisos, APIs, pantallas y validación cruzada focalizada. Caja no equivale a ventas o pagos. La Agenda sigue siendo demostración local; la lista de espera, hotelería y reservas por recursos requieren definiciones posteriores. El piloto y su métrica siguen pendientes.

Las fichas de Clientes todavía no están vinculadas por identificador a los turnos: el formulario actual toma nombre y teléfono como datos del turno. Definir esa relación con el modelo de dominio y la API antes de usar historial de clientes real.

### Dependencias futuras por empleado

TASK-09 sección 4.5 documenta la dirección aprobada para ventas/servicios desde móviles, fichaje y estadísticas opcionales por organización, capacidades configurables sin elevar EMPLOYEE a ADMIN y ejecutante separado del actor de carga. No se implementan en FEAT-003. Ventas, asistencia y reportes deberán definir configuración, acceso propio/equipo, registro por terceros, métricas, privacidad y correcciones. Ya están aprobadas notas internas para OWNER/ADMIN, archivo lógico sin perder historial y privacidad del personal con datos básicos visibles y sensibles sólo OWNER/ADMIN. Archivo/reactivación está aprobado sólo para OWNER/ADMIN; EMPLOYEE no modifica el estado.

### Detalles restantes de FEAT-003

La tabla de producto cerró duplicados con advertencia por correo/teléfono sin bloqueo, duración entera 5–720, configuración de profesional por servicio y sección operativa independiente conservando rutas de Clientes/Servicios. No reabrir esas decisiones. El cierre técnico también define modos y default condicional, IN_PERSON inicial con remoto futuro, /app/profesionales con etiqueta Profesionales y /app/equipo para accesos, archivo OWNER/ADMIN y política monetaria. No reabrirlos. FEAT-003 B1–B10 están implementados; piloto, métrica y retención siguen abiertos. Las APIs operativas aplican la matriz B2. La pantalla Profesionales muestra habilitaciones en la ficha; las modificaciones se hacen desde el detalle de Servicios. No se hizo revisión manual de diseño Canvas en desktop/móvil ni despliegue desde cero; esos límites constan en TASK-09.

### Promesas de la landing antes del piloto

La landing muestra capacidades, planes con importes concretos y un selector mensual/anual sin comportamiento. Registro, login, onboarding y la prueba de 14 días ya están conectados al backend; antes de publicar la página como oferta comercial, alinear capacidades, precios y llamadas a la acción con el alcance aprobado y el estado real del producto. Los textos de Términos y Política de Privacidad del formulario de registro tampoco enlazan documentos.

## Decisiones técnicas abiertas

### Credenciales y ambiente Neon

La conexión a Neon dev, configuración pooled/direct y migraciones de FEAT-001/FEAT-002 fueron ejecutadas y verificadas en sus tareas. No asumir que la base de desarrollo representa producción; antes de un despliegue, confirmar el proyecto, región, credenciales y procedimiento de migración del ambiente destino.

### Advisory de Prisma CLI

El lockfile de `api/` reporta 4 vulnerabilidades altas de tooling (`deepmerge-ts` y `mysql2` transitivas de Prisma CLI). Afectan desarrollo/configuración y npm sólo propone bajar a Prisma 6.19.3 como corrección automática, incompatible con la decisión vigente de Prisma 7. El árbol productivo excluyendo desarrollo y peers opcionales devuelve 0 vulnerabilidades con `npm audit --omit=dev --omit=optional`.

Revisar este advisory al actualizar Prisma. No usar `npm audit fix --force` sin evaluar la migración de versión mayor.

### Runtime de la API

Se acordó desplegar NestJS como proceso o contenedor, pero no se eligió entre VPS y plataforma administrada.

### Autenticación

FEAT-001 y FEAT-002 se cerraron el 2026-10-14 después de validar manualmente los flujos principales. El reenvío usa la infraestructura existente, pero el dispatcher en memoria no garantiza entrega final, rebotes ni reintentos durables; evaluar transporte durable/outbox si la operación lo requiere. La validación manual no sustituye una verificación de correo real, cookies, proxy y transporte en staging antes de publicar.

### Auditoría de dependencias TASK-07

El 2026-10-12 `npm audit` de `app/` reportó seis vulnerabilidades, incluida una crítica en Next.js 16.3.3 (fix indicado por npm fuera de la versión fijada) y advisories altas transitivas; la actualización a Next 16.4.0 no pudo instalarse porque Windows devolvió `EBUSY` al copiar el binario SWC. `npm audit` de `api/` mantiene cuatro advisories altas en tooling Prisma 7 (`deepmerge-ts`/`mysql2`); `npm audit --omit=dev --omit=optional` sí reporta cero vulnerabilidades. No usar `npm audit fix --force` ni bajar Prisma: resolver con versiones compatibles, instalador desbloqueado y verificación de builds antes de publicar.

### Política monetaria y temporal

Están aprobados Decimal(12,2), ausencia de conversión automática, confirmación de todo cambio monetario efectivo y bloqueo ante importes persistidos hasta una migración explícita, incluso vía country y con precios cero/inactivos. B4 implementa `confirmCurrencyChange`, sincronización transaccional de metadata en servicios sin precio y locks ante alta/primer precio concurrentes. Configuración solicita confirmación antes del cambio monetario; cuando hay importes, mantiene el formulario y explica que falta una migración explícita. Ventas y pagos deberán definir además redondeo de totales, impuestos y condiciones históricas; no quedan resueltos por el catálogo. Hoy el filtro inicial de Caja usa la fecha local del navegador y cada movimiento manual exige una fecha explícita; al conectarlo a la API, la jornada debe seguir la zona horaria definida para la organización.

### Row-Level Security

RLS queda pospuesto hasta validar su interacción con Prisma, pooling y roles de PostgreSQL. La primera implementación no puede depender de RLS para corregir consultas sin tenant context.

## Herramientas pospuestas

### Graphify

No se instaló durante la inicialización. Se evaluará cuando el tamaño y las dependencias hagan repetitiva la exploración. Sus artefactos generados no serán fuente canónica.

### Prisma 8

La base utiliza Prisma 7. La siguiente versión mayor se evaluará por separado después de estabilizar el primer flujo con generación, adaptador PostgreSQL y migraciones.

## Riesgos a vigilar

- Documentación que no se actualice junto con el código.
- Reglas de negocio duplicadas entre frontend y API.
- Filtrado multi-tenant aplicado de manera inconsistente.
- Incorporación prematura de módulos fuera del flujo piloto.
- Dependencias externas añadidas antes de contar con un caso de uso aprobado.
