# Modelo conceptual de datos

Este documento describe conceptos e invariantes. No reemplaza el esquema de Prisma ni una migración. Cuando exista código, ambos deberán permanecer alineados con este modelo.

## Identidad y tenancy

```text
User --< Membership >-- Organization
Organization --< StaffMember
Organization --< Customer
```

- Un usuario puede tener membresías en varias organizaciones.
- Una membresía pertenece a un único usuario y una única organización.
- El rol y estado de acceso pertenecen a la membresía, no al usuario global.
- Un integrante del equipo puede existir sin credenciales de acceso.
- La membresía autenticable (`OrganizationMember`) no es el integrante operativo (`StaffMember`). Un empleado invitado puede tener acceso sin que se cree automáticamente una ficha de personal, turno u horario.
- La sesión puede recordar una organización seleccionada, pero esa preferencia no autoriza el acceso: la API valida su membresía activa en cada operación.

## Suscripción

```text
Organization --|| Subscription
User --o| TrialGrant --|| Organization
User --< OrganizationMember >-- Organization
```

- La suscripción pertenece a la organización y es compartida por sus miembros. El plan es `BASIC`, `PRO`, `BUSINESS` o `TOURISM`; no implica que cada prestación presentada esté implementada.
- La primera organización creada por una persona puede recibir una única concesión de prueba de 14 días, registrada independientemente para impedir repetirla aunque una membresía se desactive.
- `trialStartedAt` y `trialEndsAt` los establece la API al confirmar la creación. El intervalo habilitado es `[trialStartedAt, trialEndsAt)`; al instante de vencimiento exacto se deniega el acceso comercial sin eliminar datos.
- La evaluación de plan y vigencia pertenece al backend. El cliente no puede escribir plan, estado de pago ni fechas. Identidad, sesión y consulta de regularización permanecen separadas del acceso a operaciones de negocio.

Las entidades y restricciones persistentes detalladas se documentan en el esquema de Prisma y las migraciones; este modelo conceptual no reemplaza esos contratos.

## Servicios

```text
Organization --< ServiceCategory --o< Service
Organization --< Service
Organization --< StaffMember --< StaffService >-- Service
Organization --< Customer
Customer --< Appointment
Appointment >-- Service
Appointment >-- StaffMember
```

El esquema inicial de `Customer`, `ServiceCategory`, `Service`, `StaffMember` y `StaffService` está persistido desde FEAT-003 B1. La categoría de un servicio es opcional. StaffMember es una ficha operativa distinta de OrganizationMember; su `userId` nullable sólo referencia una cuenta global y no crea membresía ni acceso. `StaffService` habilita una combinación profesional–servicio y conserva ambas FK compuestas con `organizationId`.

El catálogo usa selección `CUSTOMER_CHOICE`, `AUTO_ASSIGN` o `NO_ASSIGNMENT`; no calcula disponibilidad ni ejecuta asignación. La modalidad actual es `IN_PERSON`. Los precios usan `Decimal(12,2)` y moneda explícita. Las APIs de categorías, servicios, personal y habilitaciones usan tenant context; las interfaces Clientes, Servicios y Profesionales consumen esas APIs. FK compuestas con `organizationId` impiden asociar categorías, servicios y personal de distintas organizaciones incluso si la escritura no proviene de la API. Un cambio monetario confirmado no convierte importes: se bloquea si existe un precio y, si no existen precios, actualiza atómicamente la moneda de servicios sin precio.

El alcance inicial aprobado es una reserva por cliente y servicio, con cero o un profesional. No incluye reservas con múltiples servicios, recursos compartidos ni capacidad configurable.

### FEAT-004 — B1 aplicado en PostgreSQL aislado

[ADR-008](decisions/ADR-008-scheduling-personalization.md) establece configuración por Organization desde el lanzamiento. Duración en Service y paso de inicios son distintos: la ocupación usa la duración completa, sin exigir igualdad/divisibilidad con la grilla. Defaults, unidades y límites viven en [TASK-10, sección 5.1](../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#51-política-configurable-aprobada-y-límites-técnicos).

`SchedulingSettings` versionado y snapshots temporales por `Appointment` conservan la política aplicada, especialmente el plazo de cancelación. PATCH de configuración sólo cambia esa configuración del tenant: no recalcula fechas/horas, duración, profesional, estado ni condiciones de turnos confirmados. La disponibilidad nueva sigue descontando intervalos UTC reales aunque los turnos anteriores queden fuera de la nueva grilla/horizonte. Reprogramar es una acción explícita con sus propias validaciones, nunca un efecto secundario de settings.

La política y sus snapshots deben ser íntegros ante cambios concurrentes; límites en entradas y constraints DB no sustituyen aislamiento ni exclusión de reservas superpuestas. [ADR-009](decisions/ADR-009-scheduling-core-decisions.md) registra capacidad uno por servicio sin profesional y los estados CONFIRMED/COMPLETED/CANCELLED/NO_SHOW, sin PENDING. Las reglas complementarias aprobadas precisan correcciones finales por OWNER/ADMIN con motivo y auditoría, conteo equilibrado de CONFIRMED/COMPLETED en el día local del negocio, acceso EMPLOYEE limitado a datos operativos, enlaces públicos con token hasheado y revocable, y desambiguación DST explícita.

`Appointment`, `AppointmentEvent`, `BookingSubmission`, `BookingCalendar`, sus ventanas/overrides/ausencias y `SchedulingSettings` ya están representados en `api/prisma/schema.prisma`. Cada relación operativa incluye `organizationId`; la migración agrega checks, FK compuestas, exclusiones para solapamientos e índices GiST con `btree_gist`. El token de gestión se persiste como hash; su expiración máxima propuesta es 30 días después del turno y está sujeta a retención.

B4 ofrece una lectura privada de disponibilidad con ventanas locales convertidas a instantes UTC, elegibilidad por servicio/profesional, ocupaciones tenant-aware consultadas por lote y cursores ligados a los filtros. Es sólo una proyección: no crea holds ni reservas. La prueba HTTP corre contra PostgreSQL aislado Feat10.

B5 crea `Appointment`, `AppointmentEvent(CREATED)` y `BookingSubmission` en la misma transacción. Las solicitudes internas usan sólo un Customer activo del mismo tenant; los snapshots retienen datos mínimos del cliente/servicio/profesional y la respuesta omite contactos y notas sensibles. El Idempotency-Key se almacena como SHA-256 y el cuerpo canónico se firma con un secreto independiente. No agrega migración.

B6 añade lecturas y mutaciones versionadas de citas: filtros/rango local, detalle e historial con proyecciones por rol, cancelación con cutoff congelado, cierre administrativo, corrección terminal con motivo y reprogramación que valida el nuevo horario sin liberar el original al fallar. Cada cambio de estado escribe evento inmutable en la misma transacción.

B7 añade catálogo y disponibilidad públicos por slug con opt-in/suscripción; staff público se pagina y sólo se muestra para CUSTOMER_CHOICE. La reserva crea un Guest Customer nuevo junto con Appointment/Event/Submission, sin búsqueda ni fusión por contacto. El enlace se deriva con secreto dedicado y versión de clave; sólo se persisten hash/versión/expiración. Cancelar/consultar siguen disponibles al despublicar o vencer la suscripción si token/cutoff lo permiten; reprogramar exige publicación y suscripción actuales. Replays recuperan el mismo token sólo mientras siga activo. El TTL termina 30 días después del fin del turno, sujeto a retención. No se envía correo ni se añade migración.

La migración `20261014211225_scheduling_appointments` se aplicó en la rama Neon aislada `Feat10` (PostgreSQL 18.6); `btree_gist` estaba disponible y la migración quedó al día. Las seis migraciones se aplicaron y verificaron desde cero en una base temporal dentro de `Feat10`, luego eliminada. Las pruebas focalizadas de solapamientos, intervalos adyacentes, relaciones tenant-aware, calendarios y límites de configuración pasaron 2/2. Neon dev y producción no se usaron. La retención de snapshots/eventos, el piloto y la métrica siguen pendientes antes de usar datos de terceros.

B2 añade `api/src/availability/time-zone-adapter.ts` y `scheduling-time-policy.ts`: conversión civil/UTC, validación estricta de offset para horas repetidas, rechazo de horas inexistentes, límites de día local y políticas puras con Clock inyectado. El runtime Node 24.16 no expone Temporal; la API fija `@js-temporal/polyfill` 0.5.1 (ISC), aislado detrás del adaptador para evitar implementar reglas DST propias. El horizonte se compara por fecha civil local inclusiva; anticipación y cutoff se comparan como minutos transcurridos. Estos helpers aún no están conectados a endpoints ni a calendario persistido.

B3 expone `GET/PATCH /organizations/:id/scheduling/settings`, lectura y gestión versionada de calendarios, ventanas semanales, overrides y ausencias. Los permisos se validan en backend: EMPLOYEE consulta datos operativos; sólo OWNER/ADMIN modifica políticas o calendarios. `SchedulingReadModule` importa únicamente DatabaseModule; todas sus proyecciones requieren organización explícita y filtran tenant/status/ventana. Las mutaciones toman lock de Organization y calendario, incrementan version con If-Match y rechazan con `SCHEDULE_HAS_BOOKINGS` una regla que quite cobertura o una ausencia que se cruce con una reserva futura. Cambios efectivos de timezone, incluidos los derivados de country, se bloquean transaccionalmente con reservas CONFIRMED futuras/en curso o reglas locales persistidas. B3 no agrega migración.

## Comercio

```text
Organization --< Product --< Variant
Variant --< InventoryMovement
Customer --< Order --< OrderItem >-- Variant
```

El inventario debe poder explicarse mediante movimientos cuando se implemente el módulo completo. El stock disponible no debe depender únicamente de una modificación opaca de un contador.

## Operación financiera

```text
Organization --< Sale --< SaleItem
Sale --< Payment
Organization --< Expense
```

Relaciones de origen posibles:

- Un turno puede originar una venta, pero no es una venta.
- Un pedido puede originar una venta, pero no es una venta.
- Una venta puede ser manual y no tener turno ni pedido.
- Una venta puede existir antes de estar completamente pagada.
- Una venta puede tener uno o varios pagos.

Si aparece la necesidad de aplicar un mismo pago a varias ventas, se introducirá una entidad explícita de asignación. No se generalizará antes de contar con ese caso real.

## Pagos externos

Un pago integrado deberá conservar como mínimo:

- Organización propietaria.
- Proveedor y referencia externa.
- Importe y moneda.
- Estado interno.
- Estado o evidencia recibida del proveedor.
- Fechas relevantes.
- Clave de idempotencia o restricción equivalente.

La confirmación de Mercado Pago será procesada desde webhooks verificados. Repetir el mismo webhook no debe duplicar un pago ni sus efectos.

## Importes y tiempo

- Los importes no se representarán con punto flotante binario.
- La moneda debe ser explícita aun cuando el mercado inicial opere principalmente en ARS.
- Las marcas temporales persistidas usarán una representación inequívoca y las reglas de negocio deberán considerar la zona horaria de la organización.
- El precio del catálogo de servicios usa `Decimal(12,2)` y la moneda de la organización; esto no define redondeo, impuestos, FX ni snapshots de ventas/pagos futuros.

## Restricciones tenant-aware

- Las entidades operativas incluyen `organizationId`.
- Las claves únicas de negocio normalmente incluyen `organizationId`.
- Las FK compuestas de categoría-servicio y profesional-servicio impiden asociar entidades de organizaciones diferentes en el esquema inicial.
- La API obtiene el tenant context de una membresía autorizada, no de un identificador confiado del request.
