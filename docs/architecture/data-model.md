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

## Servicios

```text
Organization --< Service
Organization --< StaffMember
StaffMember --< AvailabilityRule
Customer --< Appointment
Appointment >-- Service
Appointment >-- StaffMember
```

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
- La política concreta de precisión monetaria y almacenamiento temporal se fijará antes del primer esquema financiero.

## Restricciones tenant-aware

- Las entidades operativas incluyen `organizationId`.
- Las claves únicas de negocio normalmente incluyen `organizationId`.
- Las relaciones entre entidades operativas deben impedir asociaciones entre organizaciones diferentes.
- La API obtiene el tenant context de una membresía autorizada, no de un identificador confiado del request.
