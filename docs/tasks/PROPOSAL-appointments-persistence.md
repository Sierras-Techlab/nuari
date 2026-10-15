# Borrador histórico sustituido — Persistencia del Turnero

**No ejecutar este borrador.** Su denominación anterior TASK-08/FEAT-002 colisionaba con la tarea vigente de organizaciones y miembros. El catálogo persistente se completó en [TASK-09 — FEAT-003](TASK-09-feat-003-operational-catalog.md); la propuesta vigente de agenda y disponibilidad está en [TASK-10 — FEAT-004](TASK-10-feat-004-scheduling-availability-appointments.md), pendiente de aprobación. El contenido siguiente conserva el antecedente, no contratos actuales ni autorización de migrar o implementar Caja.

## Goal

Conectar el espacio Turnero a PostgreSQL a través de la API NestJS, reemplazando el estado local volátil de frontend por entidades persistentes y aisladas por organización (`Organization`), con suscripción activa/trialing requerida.

## Context

- FEAT-001 (TASK-07) dejó operativas la identidad, sesiones, organizaciones, membresías y suscripción de prueba.
- Frontend cuenta con UI funcional para Turnero (`/app/agenda`, `/app/servicios`, `/app/clientes`, `/app/caja`, `/app/equipo`) que consume adapters locales en memoria (`DemoAppointmentProvider`, `LocalWorkspaceSource`).
- Requisitos no negociables: `Organization` es el límite de tenant; todas las entidades operativas pertenecen a una organización; las consultas backend son tenant-aware y exigen validación de membresía y acceso comercial (`BusinessAccessGuard`).
- Sin dependencias externas innecesarias, sin RLS todavía, sin pagos ni microservicios.

---

## Bloques de Ejecución Rápida (FEAT-002)

Para respetar los límites operativos (10–20 min por bloque, validaciones acotadas, consumo controlado de tokens), la feature se divide en 4 bloques independientes:

```
[Bloque 1: Modelo y Migración DB] 
        ↓
[Bloque 2: API Módulo Appointments & Catálogo (Servicios/Staff/Clientes)]
        ↓
[Bloque 3: Integración Frontend Agenda y Catálogos con API]
        ↓
[Bloque 4: Persistencia Operativa Adicional (Caja/Movimientos) y Verificación Final]
```

---

### Bloque 1: Modelo de Datos y Migración Prisma

**Objetivo:** Extender `schema.prisma` con las entidades del Turnero aisladas por tenant y aplicar migración en Neon dev.

**Entidades a modelar:**
1. `Customer`: `id` (UUID), `organizationId` (UUID), `name`, `phone`, `email?`, `notes?`, `createdAt`, `updatedAt`.
   - Constraints: `(organizationId, phone)` o `organizationId` indexado; FK a `Organization` con `onDelete: Restrict`.
2. `Service`: `id` (UUID), `organizationId` (UUID), `name`, `durationMinutes` (Int), `price` (Decimal/Int centavos), `description?`, `isActive` (Boolean default true), `createdAt`, `updatedAt`.
   - FK a `Organization`.
3. `StaffMember`: `id` (UUID), `organizationId` (UUID), `name`, `initials`, `role` (String / enum operativo), `color?`, `isActive` (Boolean default true), `createdAt`, `updatedAt`.
   - FK a `Organization`. Nota: independiente de `OrganizationMember` (ADR-005).
4. `Appointment`: `id` (UUID), `organizationId` (UUID), `customerId?`, `customerName`, `customerPhone`, `serviceId` (UUID), `staffId` (UUID), `scheduledDate` (VarChar/Date 'YYYY-MM-DD'), `scheduledTime` (VarChar 'HH:mm'), `durationMinutes` (Int), `status` (`SCHEDULED` | `COMPLETED` | `CANCELLED`), `notes?`, `createdAt`, `updatedAt`.
   - Constraints: Índices `(organizationId, scheduledDate)`, `(organizationId, staffId, scheduledDate)`.
   - Regla de conflicto de slot: un profesional no puede tener dos turnos superpuestos activos (`status != CANCELLED`).

**Verificación del Bloque 1:**
- `npx prisma validate` / `prisma generate`.
- `npx prisma migrate dev --name appointments_core`.
- Typecheck en `api/`.

---

### Bloque 2: API — Appointments, Services, Staff y Customers

**Objetivo:** Implementar endpoints REST en NestJS bajo el módulo `AppointmentsModule` (o `OperationsModule`), protegidos por `SessionGuard`, `TenantGuard` y `BusinessAccessGuard`.

**Contratos HTTP (prefijo `/api/organizations/:id`):**
1. `GET /api/organizations/:id/appointments/setup`: Devuelve servicios activos y staff activo de la organización, más la zona horaria del negocio.
2. `GET /api/organizations/:id/appointments?date=YYYY-MM-DD`: Lista de turnos para una fecha dada.
3. `POST /api/organizations/:id/appointments`: Crea un turno con validación de:
   - Pertenencia de servicio y profesional a la organización.
   - Disponibilidad del horario (no solapamiento de horario para el mismo `staffId`).
   - Creación/asociación automática o manual de `Customer`.
4. `PATCH /api/organizations/:id/appointments/:appointmentId/reschedule`: Reprograma fecha/hora validando conflicto.
5. `PATCH /api/organizations/:id/appointments/:appointmentId/cancel`: Cancela el turno (`status = CANCELLED`).
6. CRUD liviano para Servicios y Staff (`GET/POST` en `/services` y `/staff`).

**Verificación del Bloque 2:**
- Tests unitarios de servicios y controladores (`npm test` enfocado).
- Test de integración básico verificando aislamiento multi-tenant (un tenant no ve turnos de otro).
- Typecheck y lint en `api/`.

---

### Bloque 3: Integración Frontend — Agenda y Catálogos

**Objetivo:** Conectar las pantallas `/app/agenda`, `/app/servicios` y `/app/equipo` al cliente HTTP del backend (`/api/organizations/:id/...`), sustituyendo `DemoAppointmentProvider` y datos en memoria por llamadas a la API persistente.

**Alcance en Frontend:**
1. Crear cliente/source API para citas: `ApiAppointmentSource` que implemente la interfaz `AppointmentSource`.
2. Adaptar `WorkspaceProvider` para sincronizar servicios y equipo con los endpoints de la API tenant.
3. Manejo de estados de carga, errores de conflicto de horario (`SLOT_TAKEN`) y feedback al usuario.

**Verificación del Bloque 3:**
- `app/: npm test` en suites afectadas de appointments y workspace.
- `app/: npm run typecheck` y `app/: npm run lint`.

---

### Bloque 4: Persistencia Operativa de Caja/Clientes y Verificación Manual

**Objetivo:** Completar persistencia de movimientos de caja y fichas de clientes para el piloto.

**Alcance:**
1. Entidad `CashMovement`: `id`, `organizationId`, `type` (`INCOME` | `EXPENSE`), `amount`, `category`, `description`, `movementDate`, `createdAt`.
2. Endpoints: `GET /api/organizations/:id/cash` y `POST /api/organizations/:id/cash`.
3. Conexión de `CashScreen` y `ClientsScreen` con la API.
4. Documentación viva actualizada (`context_snapshot.md`, `known_issues.md`).

**Verificación del Bloque 4:**
- Tests específicos del módulo de caja.
- Typecheck y lint en `api/` y `app/`.
- Documentar pasos de prueba manual en el navegador para el usuario.

---

## Criterios de Aceptación de TASK-08

1. **Aislamiento Estricto:** Toda consulta y mutación requiere `organizationId` validado contra la sesión; es imposible leer o modificar turnos de otra organización.
2. **Conflicto de Horarios:** El backend rechaza turnos solapados para el mismo profesional en la misma fecha/rango horario.
3. **Persistencia Real:** Los turnos, servicios y profesionales creados persisten en Neon PostgreSQL y sobreviven a recargas del navegador.
4. **Protección Comercial:** Si el trial de la organización vence, `BusinessAccessGuard` deniega el acceso a la agenda devolviendo `403 SUBSCRIPTION_REQUIRED`.
5. **Calidad y No Regresiones:** Typecheck y lint pasan limpios en `api/` y `app/`. Tests puntuales aprueban.
