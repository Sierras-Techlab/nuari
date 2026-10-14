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

El modelo exacto para turnos con múltiples servicios o recursos se definirá con el flujo piloto. Hasta entonces no se asumirá una cardinalidad que cierre prematuramente esa posibilidad.

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
