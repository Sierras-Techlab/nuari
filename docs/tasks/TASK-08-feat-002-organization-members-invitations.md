# TASK-08 — FEAT-002: Administración de organizaciones, miembros, invitaciones y permisos

## Goal

Conectar la configuración de la organización en su ruta existente (`/app/configuracion`), administrar miembros y accesos desde `/app/equipo`, implementar la gestión de roles (`OWNER`, `ADMIN`, `EMPLOYEE`), el ciclo de vida de invitaciones por correo (`Resend` y `/invitacion/[token]`), y el registro de auditoría básica en NestJS y PostgreSQL.

## Context y Distinción Clave

- **FEAT-001** implementó la identidad global, sesiones seguras, creación de organización en onboarding con membresía `OWNER`, selección de organización activa (`/auth/active-organization`) y suscripción de prueba.
- **Rutas asignadas:**
  - Configuración de organización: `/app/configuracion` (reutiliza la pantalla existente [`OrganizationSettingsScreen`](../../app/src/features/workspace/organization-settings-screen.tsx)).
  - Miembros y accesos: `/app/equipo` (pantalla principal para administrar cuentas de usuario autorizadas y roles de organización).
  - Equipo operativo: dominio independiente para profesionales/empleados del negocio y sus turnos; no se administra desde la pantalla de miembros y queda fuera del catálogo operativo de esta tarea.
  - Aceptación de invitaciones: `/invitacion/[token]` (pantalla pública).
- **Distinción de dominio crítica**:
  - **Miembros y accesos (`OrganizationMember`)**: Representa las cuentas de usuario (`User`) autorizadas para autenticarse e interactuar en Nuari dentro del tenant, con roles de sistema (`OWNER`, `ADMIN`, `EMPLOYEE`).
  - **Equipo operativo (`StaffMember`)**: Representa el personal del negocio (profesionales de atención, horarios, comisión, etc.), que no necesariamente cuenta con usuario ni acceso al software.
- La pantalla existente en frontend [`/app/configuracion`](../../app/src/features/workspace/organization-settings-screen.tsx) ya contiene pestañas y formularios para Identidad, Contacto, Ubicación, Ajustes regionales (moneda, zona horaria) y Slug. FEAT-002 conecta esta vista con la persistencia real de la organización.
- Las invitaciones reutilizarán la infraestructura de Resend y `Clock` ya configuradas en `api/src/integrations` y `api/src/common/clock.ts`.


---

## Bloques de Ejecución Rápida (FEAT-002)

Para asegurar intervenciones controladas (10–20 min), bajo consumo de tokens y verificación independiente:

```
[Bloque 1: Modelo y Migración Prisma]
        ↓
[Bloque 2: API — Configuración de Organización y Auditoría Básica]
        ↓
[Bloque 3: API — Miembros, Roles y Ciclo de Invitaciones]
        ↓
[Bloque 4: Frontend — Conexión de Configuración y Miembros/Accesos]
        ↓
[Bloque 5: Frontend — Flujo de Aceptación de Invitación (/invitacion/[token])]
```

---

### Bloque 1: Modelo y Migración Prisma

**Estado:** COMPLETADO (Migración `20261013010618_org_settings_and_invitations` aplicada en Neon dev).

**Alcance ejecutado:**
1. **Campos en `Organization`**:
   - `description?`, `email?`, `phone?`, `website?`, `country?`, `state?`, `city?`, `zip?`, `address?`, `timezone` (default 'America/Argentina/Buenos_Aires'), `currency` (default 'ARS'), `logoUrl?`.
2. **Modelo `OrganizationInvitation`**:
   - `id` (UUID), `organizationId` (UUID, FK `Organization` `onDelete: Cascade`), `email` (String), `role` (`OrganizationRole`), `tokenHash` (Char 64, UNIQUE), `invitedByUserId` (UUID, FK `User`), `createdAt` (Timestamptz), `expiresAt` (Timestamptz), `acceptedAt?` (Timestamptz), `revokedAt?` (Timestamptz).
   - Índices: `(organizationId, email)`, `expiresAt`, `tokenHash`.
3. **Modelo `OrganizationAuditLog`**:
   - `id` (UUID), `organizationId` (UUID), `actorUserId` (UUID), `action` (String), `targetId?` (String), `metadata` (String?), `createdAt` (Timestamptz).
   - Índice: `(organizationId, createdAt)`.

**Verificaciones:**
- `npx prisma validate` — Aprobado.
- `npx prisma migrate dev` — Aprobado sin pérdida de datos en Neon PostgreSQL.
- `npx prisma generate` — Generado cliente Prisma 7.10.0 en `src/generated/prisma`.
- `npm run typecheck` en `api/` — Aprobado (0 errores).


---

### Bloque 2: API — Configuración de Organización y Auditoría Básica

**Estado:** COMPLETADO.

**Alcance ejecutado:**
1. `GET /api/organizations/:id`:
   - Protegido por `TenantGuard`. Retorna `organization` (con campos completos de identidad, contacto, ubicación, zona horaria y moneda) y `membership` del usuario autenticado.
2. `PATCH /api/organizations/:id`:
   - Protegido por `TenantGuard`. Valida reglas por rol y validaciones regionales:
     - `OWNER`: Modifica todos los campos, incluyendo `slug` (con chequeo de unicidad).
     - `ADMIN`: Modifica datos comerciales y de contacto. Rechaza con `403 PERMISSION_DENIED` si intenta cambiar el `slug`.
     - `EMPLOYEE`: Rechazado con `403 PERMISSION_DENIED` para cualquier modificación.
   - **Validaciones regionales (7 países)**: `AR`, `UY`, `CL`, `BR`, `MX`, `CO`, `PE`. Exige correspondencia estricta de la moneda y que la zona horaria pertenezca a las admitidas para el país seleccionado.
   - **Auditoría**: Registra evento en `OrganizationAuditLog` dentro de la transacción de actualización en PostgreSQL (actor, organización, acción `ORGANIZATION_SETTINGS_UPDATED` y cambios sensibles en metadata).
   - **LogoUrl**: Preparado en DTO y schema, pero bloqueado con `400 VALIDATION_ERROR` informado hasta contar con almacenamiento seguro de archivos.

**Verificaciones:**
- `api/: npm run typecheck` — PASS (0 errores).
- `api/: npm run lint` — PASS (0 errores, 0 warnings).
- `api/: npx vitest run src/organizations/organizations.service.spec.ts` — 9/9 PASS.
- `api/: npm test` — 68/68 PASS.


---

### Bloque 3: API — Miembros, Roles y Ciclo de Invitaciones

**Estado:** COMPLETADO.

**Alcance ejecutado:**
1. **Gestión de Miembros**:
   - `GET /api/organizations/:id/members`: Lista miembros activos con usuario (nombre, email), rol y fechas.
   - `PATCH /api/organizations/:id/members/:memberId`: Cambio de rol. Protegido por matriz de permisos:
     - `OWNER` puede modificar roles `OWNER`, `ADMIN` y `EMPLOYEE`, garantizando que la organización conserve siempre al menos un `OWNER` activo (`400 CANNOT_REMOVE_LAST_OWNER`).
     - `ADMIN` solo puede gestionar miembros con rol `EMPLOYEE` (`403 PERMISSION_DENIED` si intenta modificar o asignar roles superiores).
     - `EMPLOYEE` no tiene acceso (`403 PERMISSION_DENIED`).
   - `DELETE /api/organizations/:id/members/:memberId`: Revocación de membresía (`status: INACTIVE`). Impide revocar al último `OWNER` activo.
2. **Ciclo de Invitaciones**:
   - `GET /api/organizations/:id/invitations`: Lista invitaciones pendientes vigentes.
   - `POST /api/organizations/:id/invitations`: Emite invitación `{email, role}`. Genera token criptográfico de 32 bytes base64url, almacena su hash SHA-256 (`tokenHash`), fija vencimiento a 7 días, revoca invitaciones previas pendientes hacia el mismo correo, despacha correo mediante `EmailDispatcher` (Resend) y registra auditoría. Rechaza si el correo ya es miembro activo (`409 ALREADY_MEMBER`).
   - `DELETE /api/organizations/:id/invitations/:invitationId`: Revoca invitación pendiente.
3. **Consulta y Aceptación de Invitaciones**:
   - `GET /api/invitations/:token`: Consulta pública de metadata de la invitación (nombre de organización, slug, email invitado, rol, vencimiento).
   - `POST /api/invitations/:token/accept`: Aceptación transaccional:
     - Requiere usuario autenticado con email verificado (`403 EMAIL_UNVERIFIED`).
     - Comprueba coincidencia estricta entre el correo verificado del usuario y el correo invitado (`403 EMAIL_MISMATCH`).
     - Crea o reactiva `OrganizationMember` con `status: ACTIVE` y el rol asignado.
     - Marca `acceptedAt: now()`, actualiza `activeOrganizationId` en sesión y registra evento en `OrganizationAuditLog`.

**Verificaciones:**
- `api/: npm run typecheck` — PASS (0 errores).
- `api/: npm run lint` — PASS (0 errores, 0 warnings).
- `api/: npx vitest run src/organizations/organizations.service.spec.ts` — 14/14 PASS.
- `api/: npm test` — 73/73 PASS.


---

### Bloque 4: Frontend — Configuración y administración de miembros en Equipo [COMPLETADO]

**Objetivo:** Conectar la vista existente `/app/configuracion` con la API y administrar las cuentas de la organización en `/app/equipo`, conservando su interfaz de tarjetas y filtros.

1. **Configuración de organización (`/app/configuracion`)**:
   - Conectada a los endpoints `GET /api/organizations/:id` y `PATCH /api/organizations/:id`.
   - Reemplazado el estado local en memoria por los datos de la API.
   - Manejo de feedback al guardar, errores de validación de slug/contacto y control de campos según rol (`OWNER` vs `ADMIN`).

2. **Miembros y accesos (`/app/equipo`)**:
   - Listado real de miembros activos con roles (`OWNER`, `ADMIN`, `EMPLOYEE`), identificación de la cuenta actual, búsqueda y filtros.
   - Formulario por correo y rol que usa el endpoint de invitaciones; nunca crea cuentas o membresías directamente.
   - Acciones de cambio de rol y revocación con confirmación y protección del último OWNER.
   - Invitaciones pendientes con rol, vencimiento y opción de revocación.
   - La antigua ruta `/app/configuracion/miembros` conserva su guardia de negocio y redirige a `/app/equipo`. El acceso desde Configuración apunta a la ruta principal.

**Verificación:**
- Pruebas focalizadas de Equipo, guardas y navegación registradas en `team-screen.test.tsx`, `private-pages.test.tsx` y `organization-settings-screen.test.tsx`.
- Typecheck y lint en `app/` (PASS).

---

### Bloque 5: Frontend — Flujo de Aceptación de Invitación (`/invitacion/[token]`) [COMPLETADO]

**Objetivo:** Pantalla pública e interactiva para procesar invitaciones.

1. Ruta `/invitacion/[token]`:
   - Consulta estado de la invitación con `GET /api/invitations/:token`.
   - Si no está autenticado: ofrece iniciar sesión o registrarse preservando el token y redirigiendo de vuelta.
   - Si está autenticado con correo distinto: muestra advertencia explícita y botón de cambio de cuenta.
   - Si el correo no está verificado: ofrece completar la verificación con regreso a la invitación.
   - Si está autenticado con el email correspondiente: botón "Aceptar invitación", ejecuta `POST /api/invitations/:token/accept`.
   - Al aceptar: muestra confirmación y acceso directo a `/app` con la organización activa asignada por el backend.
   - Manejo de estados de error: invitación expirada, revocada, ya utilizada o token inválido.

**Verificación:**
- Tests unitarios en `invitation-screen.test.tsx` (5/5 PASS).
- Typecheck y lint en `app/` (PASS).

---

## Criterios de Aceptación de TASK-08

1. **Aislamiento Multi-tenant:** Los datos de configuración, miembros e invitaciones pertenecen estrictamente a la organización del contexto activo.
2. **Jerarquía de Permisos:**
   - `OWNER`: Control total, cambio de slug, gestión de admins y miembros, cancelación.
   - `ADMIN`: Modificar datos de contacto/ubicación, invitar sólo `EMPLOYEE`, ver miembros y administrar miembros `EMPLOYEE`.
   - `EMPLOYEE`: Sólo lectura de miembros, sin acceso a editar configuración ni emitir invitaciones.
3. **Flujo de Invitación Robusto:** Token firmado/hasheado en base de datos; aceptación atómica sin permitir suplantación de identidad.
4. **Separación Conceptual Estricta:** No confundir miembros del sistema con el equipo operativo de turnos.
5. **Calidad y Verificación:** `npm run typecheck` y `npm run lint` aprobados en `api/` y `app/`. Pruebas unitarias/integración de los módulos afectados aprobadas.
6. **Revocación y seguridad de sesión:** Revocar conserva el registro y persiste `OrganizationMember.status = INACTIVE`; el listado devuelve sólo miembros `ACTIVE`, la pantalla los quita tras refrescar y `TenantGuard` rechaza cualquier petición posterior del usuario revocado a ese tenant.
7. **Navegación tras revocación:** `/auth/me` conserva la sesión global, selecciona otra membresía activa si existe y, si no queda ninguna, `/onboarding` muestra un estado explícito de acceso revocado. La creación de otra organización aparece sólo cuando la elegibilidad del backend lo permite.

## Cierre de TASK-08 — 2026-10-14

**Estado: COMPLETADA.** Los flujos principales de configuración de organización, miembros, roles, invitaciones, aceptación, permisos y revocación fueron validados manualmente. La membresía revocada queda inactiva y conserva la cuenta e historial; el servidor exige una membresía activa para cada acceso al tenant. El listado muestra miembros activos y la sesión mantiene la posibilidad de elegir otra organización o informa que el acceso fue revocado.

### Limitaciones conocidas al cierre

- La entrega final de correo depende del adaptador/infraestructura configurada; el dispatcher en memoria no garantiza recepción, rebotes ni reintentos durables.
- La carga de logos continúa deshabilitada hasta contar con almacenamiento seguro de archivos.
- La validación manual cubrió los flujos principales. No implica validación de entrega de correo en producción ni de todos los escenarios de staging.

### Unificación visual de Equipo y miembros — 2026-10-14

`/app/equipo` es la única interfaz administrativa de miembros y accesos, con el diseño de tarjetas, búsqueda y filtros de la maqueta original. Reutiliza los contratos y clientes API existentes para miembros/invitaciones; la pantalla duplicada se retiró y `/app/configuracion/miembros` permanece como redirect protegido. Los trabajadores operativos sin cuenta siguen separados de las membresías de Nuari.

**Verificación frontend:** `npm run lint` y `npm run typecheck` — PASS. Pruebas focalizadas de `team-screen.test.tsx`, `private-pages.test.tsx`, `organization-settings-screen.test.tsx`, `workspace-screens.test.tsx` y `mobile-navigation.test.tsx` — 30/30 PASS. No se ejecutaron Playwright ni suites completas.
