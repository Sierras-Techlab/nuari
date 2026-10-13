# Problemas conocidos y decisiones abiertas

- Actualizado: 2026-10-12

## Decisiones de producto abiertas

### Negocio piloto del MVP

Se eligieron barberías y negocios de servicios similares como segmento inicial de exploración. Todavía falta seleccionar un negocio piloto concreto y confirmar con él si la agenda de turnos es el registro manual que conviene reemplazar primero.

### Flujo y métrica de validación

El objetivo general es reemplazar un registro manual o Excel, pero todavía no se definieron el flujo exacto, el período de prueba ni la métrica cuantitativa de éxito.

### Frontend sin persistencia

Las rutas internas de Turnero permiten gestionar datos durante la sesión del navegador. Sus cambios se reinician al recargar y no representan turnos, movimientos de caja, clientes ni usuarios reales. A pedido de producto se quitaron los rótulos visibles de demostración; antes de usar el espacio con terceros se necesitan identidad, membresía, persistencia, autorización y validación de disponibilidad en la API.

El flujo de [`TASK-05`](../docs/tasks/TASK-05-onboarding-front.md) añade navegación visual desde registro al onboarding y luego a `/app`. No crea cuenta, organización ni membresía; las selecciones del onboarding se pierden al salir/recargar y no modifican Turnero. El enlace mostrado no se reserva ni tiene ruta pública. Todas estas rutas siguen sin protección por sesión.

### Alcance funcional del Turnero

La interfaz ya muestra Servicios, Clientes, Caja y Equipo con operaciones locales, pero sus modelos, permisos y flujos definitivos no están aprobados para el primer corte. Caja no equivale a ventas o pagos, y los integrantes de Equipo no tienen acceso real. Confirmar prioridad y reglas con el piloto según [`TASK-04`](../docs/tasks/TASK-04-turnero-workspace-front.md). La lista de espera sigue como candidata posterior. Un módulo futuro de hotelería o reservas por recursos requerirá una definición separada.

Las fichas de Clientes todavía no están vinculadas por identificador a los turnos: el formulario actual toma nombre y teléfono como datos del turno. Definir esa relación con el modelo de dominio y la API antes de usar historial de clientes real.

### Promesas de la landing antes del piloto

La landing muestra capacidades, planes con importes concretos y un selector mensual/anual sin comportamiento. Registro, login y onboarding son sólo visuales; los tipos de negocio, prestaciones y prueba de 14 días del onboarding no activan suscripciones ni aprueban nuevos módulos. Antes de publicar la página como oferta comercial, alinear el mensaje, precios y llamadas a la acción con el alcance aprobado y el estado real del producto. Los textos de Términos y Política de Privacidad del formulario de registro tampoco enlazan documentos.

## Decisiones técnicas abiertas

### Credenciales y ambiente Neon

La configuración pooled/direct y la generación del cliente fueron verificadas, pero todavía no se proporcionó un proyecto Neon ni credenciales. Falta validar una conexión real, la región elegida y el primer flujo de migración antes de crear modelos de dominio.

### Advisory de Prisma CLI

El lockfile de `api/` reporta 4 vulnerabilidades altas de tooling (`deepmerge-ts` y `mysql2` transitivas de Prisma CLI). Afectan desarrollo/configuración y npm sólo propone bajar a Prisma 6.19.3 como corrección automática, incompatible con la decisión vigente de Prisma 7. El árbol productivo excluyendo desarrollo y peers opcionales devuelve 0 vulnerabilidades con `npm audit --omit=dev --omit=optional`.

Revisar este advisory al actualizar Prisma. No usar `npm audit fix --force` sin evaluar la migración de versión mayor.

### Runtime de la API

Se acordó desplegar NestJS como proceso o contenedor, pero no se eligió entre VPS y plataforma administrada.

### Autenticación

El backend y el frontend de [`TASK-07`](../docs/tasks/TASK-07-feat-001-authentication-onboarding.md) implementan las fases A–D en código, pero el comportamiento persistente no está validado: migraciones, constraints, rollback y concurrencia requieren PostgreSQL aislado. También faltan Playwright E2E, revisión final de races/rate limits, correo real y validación de cookies/proxies/transporte en staging. La feature no está lista para publicación; seguir TASK-07 y no declarar FEAT-001 terminada.

### Auditoría de dependencias TASK-07

El 2026-10-12 `npm audit` de `app/` reportó seis vulnerabilidades, incluida una crítica en Next.js 16.3.3 (fix indicado por npm fuera de la versión fijada) y advisories altas transitivas; la actualización a Next 16.4.0 no pudo instalarse porque Windows devolvió `EBUSY` al copiar el binario SWC. `npm audit` de `api/` mantiene cuatro advisories altas en tooling Prisma 7 (`deepmerge-ts`/`mysql2`); `npm audit --omit=dev --omit=optional` sí reporta cero vulnerabilidades. No usar `npm audit fix --force` ni bajar Prisma: resolver con versiones compatibles, instalador desbloqueado y verificación de builds antes de publicar.

### Política monetaria y temporal

Antes de implementar ventas o pagos se debe decidir precisión de importes, estrategia de redondeo, moneda y manejo de zona horaria de la organización. Hoy el filtro inicial de Caja usa la fecha local del navegador y cada movimiento manual exige una fecha explícita; al conectarlo a la API, la jornada debe seguir la zona horaria definida para la organización.

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
