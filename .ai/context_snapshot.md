# Context snapshot

- Actualizado: 2026-10-14
- Estado del repositorio: FEAT-001 y FEAT-002 cerradas; unificada la administración de miembros en `/app/equipo` el 2026-10-14. Los flujos principales de autenticación, configuración, invitaciones, permisos y revocación fueron validados manualmente.
- Fase: identidad, organización y membresías principales completadas. Equipo administra cuentas reales por API usando la UI de tarjetas elegida; la ruta anterior redirige con guardia. FEAT-003 B1–B10 completados; Clientes, Servicios, Profesionales, categorías y habilitaciones consumen persistencia API. La Agenda continúa en demo local.

## Objetivo actual

FEAT-001 y FEAT-002 están completadas. FEAT-003 B1–B10 están completados y documentados en TASK-09. `/app/equipo` es el punto único de administración de miembros; `/app/profesionales` administra fichas laborales por separado. Próximo paso: revisión visual Canvas separada, y acordar piloto/métrica antes de considerar validado el MVP.

## Estado verificable

- `app/` y `api/` son proyectos npm independientes; el frontend usa Next.js y la API usa NestJS.
- La raíz de Turbopack está fijada explícitamente en `app/next.config.ts`.
- Registro, login, logout, recuperación/verificación de correo y onboarding usan el transporte same-origin `/api`; la creación inicial y los contextos de organización provienen de la API. `/onboarding` y cada página `/app/**` verifican contexto server-side.
- `/app/configuracion` está integrada con la API (`GET /api/organizations/:id` y `PATCH /api/organizations/:id`), validaciones regionales, guardado reactivo, restricción de slug solo a OWNER y aviso explicativo para carga de logos.
- `/app/equipo` conserva el diseño de tarjetas, búsqueda y filtros, y administra miembros activos e invitaciones reales por API, incluyendo roles, identificación de la cuenta actual, revocación confirmada y protección del último OWNER. `/app/configuracion/miembros` pasa por la misma guardia de negocio y redirige a `/app/equipo`; Configuración enlaza a la ruta principal.
- `/invitacion/[token]` está implementada fuera del dashboard con diseño fiel de Gemini Canvas: consulta pública del token, opciones de login/registro, sesión automática tras registro, verificación de identidad por correo, retorno seguro a la invitación y aceptación atómica con asignación directa a la organización.
- `DELETE /api/organizations/:id/members/:memberId` conserva la cuenta y su historial y marca la membresía `INACTIVE`; `GET /members` lista sólo `ACTIVE`. `/auth/me` reelige una organización activa válida o conserva la sesión sin tenant y reporta `ACCESS_REVOKED`; `/onboarding` explica la revocación y permite crear una organización sólo si el backend lo habilita. `TenantGuard` sigue resolviendo la membresía activa en cada petición.
- La verificación desde invitaciones conserva `returnTo` validado en el correo de verificación, por lo que funciona al abrirlo en otra pestaña; el reenvío no invalida el último token utilizable si la entrega falla y las confirmaciones repetidas de la misma cuenta verificada son idempotentes.
- `/verify-email` informa “Revisá tu correo” cuando todavía no hay token, requiere una acción explícita para confirmar y muestra un estado de éxito sin redirigir automáticamente. El email de registro se transfiere como dato efímero de `sessionStorage`, el token se limpia de la URL, y los enlaces de invitación conservan `returnTo` validado. Reenvíos comunican éxito, error y rate limit; un token inválido puede ofrecer continuar si `/auth/me` confirma que la cuenta ya está verificada.
- Limitaciones vigentes: el dispatcher en memoria no garantiza recepción, rebotes ni reintentos durables de correo; la carga de logos está deshabilitada hasta disponer de almacenamiento seguro; Caja y Agenda siguen en modo demo/local (Agenda usa su propio catálogo demo). Clientes, Servicios, Profesionales, categorías y habilitaciones usan API real. La política de retención sigue pendiente. La validación manual confirmada cubre los flujos principales, no todos los casos de producción/staging.
- FEAT-003 B1: el esquema inicial de Customer, ServiceCategory, Service, StaffMember y StaffService se aplicó con migración aditiva `20261014140000_operational_catalog` a la rama Neon `dev` (`ep-shiny-firefly-b6z1ay37`). Quedan pendientes tests directos de constraints en una DB desechable.
- FEAT-003 B10 (2026-10-14): Playwright build/start del catálogo 2/2 PASS; API HTTP E2E 1/1 PASS contra Neon dev autorizado. Build, lint y typecheck de `api/` y `app/` — PASS. Prisma informó cinco migraciones existentes y ninguna pendiente; B10 no creó ni aplicó migraciones. Flujos cubiertos: SSR privado, alta de cliente/servicio/profesional, asociación, persistencia tras recarga/relogin, cambio de tenant, EMPLOYEE, permisos, revocación y vencimiento de suscripción.
- FEAT-003 B2: API base con matriz de permisos cerrada por rol, denegación de permisos desconocidos, TenantContext explícito, permisos conjuntos, parseo de If-Match y capacidad pública acotada para auditoría operacional sin valores PII.
- FEAT-003 B3: módulo NestJS de clientes con endpoints tenant-aware de listado/ficha/alta/PATCH y candidatos de duplicados. Usa permisos, CSRF, sesión y suscripción; oculta notes a EMPLOYEE y registra mutaciones/auditoría en una transacción. Sin migración ni integración frontend.
- FEAT-003 B4: `ServiceCatalogModule` ofrece CRUD versionado de categorías y servicios, precios exactos `Decimal(12,2)`, filtros/paginación, auditoría y `requireService(ctx,id,tx?)`. Cambio de moneda/country bloqueado por `Organization FOR UPDATE`; requiere confirmación si cambia efectivamente, responde 409 ante cualquier precio persistido y sincroniza moneda/versiones de servicios sin precio dentro de una transacción. No cambió esquema ni creó migración. Sin integración frontend.
- FEAT-003 B5: `StaffModule` ofrece directorio básico paginado y CRUD de fichas laborales tenant-aware; email/teléfono sólo aparecen en ficha `staff:manage`, `userId` queda null y no se crean cuentas, membresías, invitaciones ni sesiones. PATCH versionado, auditoría sin valores de contacto; sin cambio de esquema ni migración.
- FEAT-003 B6: API bidireccional de habilitaciones con permisos conjuntos. PUT/DELETE usan If-Match de Service; locks en orden Service → StaffMember, estado activo validado tras lock y no-op idempotentes que preservan versión. Archivar conserva la relación.
- FEAT-003 B7: `/app/clientes` usa la API para páginas/búsqueda/estado, alta/edición/archivo/reactivación y candidatos duplicados no bloqueantes. EMPLOYEE puede alta/edición, no ve notas ni controles de archivo. Las solicitudes tardías de un tenant anterior se descartan. Clientes salió de `WorkspaceSource`; Caja/Agenda permanecen locales.
- FEAT-003 B8: `/app/servicios` gestiona servicios, categorías y habilitaciones desde API; conserva precios como strings decimales, requiere modo de asignación explícito y muestra profesionales al abrir el detalle. Configuración confirma cambios monetarios y explica el bloqueo por importes existentes. Agenda conserva su catálogo demo local.
- FEAT-003 B9: `/app/profesionales` administra fichas laborales con API paginada, búsqueda/estado, alta, edición, archivo/reactivación y contactos opcionales para OWNER/ADMIN. EMPLOYEE sólo ve directorio mínimo; el detalle administrativo carga contactos y servicios habilitados. No crea cuentas, membresías ni invitaciones. Navegación separa Profesionales de Equipo, que sigue administrando accesos; la ruta legado conserva su redirect protegido.
- Verificación B9 (2026-10-14, `app/`): pruebas focalizadas de ProfessionalsScreen, transporte API, navegación móvil, TeamScreen y rutas privadas — 44/44 PASS en 5 archivos; typecheck y lint focalizado — PASS. Integración `test/staff.integration-spec.ts` contra Neon dev autorizada `ep-shiny-firefly-b6z1ay37` — 1/1 PASS. Sin esquema ni migración.
- Verificación B1 (2026-10-14, `api/`): `npx prisma validate`, `npm run db:generate`, `npm run typecheck` — PASS; migración aplicada y `npx prisma migrate status` — esquema al día.
- Verificación B2 (2026-10-14, `api/`): suites focalizadas de permisos, guards, If-Match y OrganizationsService — 43/43 PASS en 4 archivos; `npm run typecheck` y `npm run lint` — PASS. No se ejecutaron suites completas ni Playwright.
- Verificación B3 (2026-10-14, `api/`): integración `test/customers.integration-spec.ts` contra Neon dev — 5/5 PASS; DTO/normalización focalizada — 6/6 PASS; `npm run typecheck` y `npm run lint` — PASS. Harness limpia sus fixtures. No se ejecutaron suites completas ni Playwright.
- Verificación B4 (2026-10-14, `api/`): Prisma validate/generate, typecheck y lint — PASS; pruebas unitarias focalizadas de Organizations, DTOs y ServiceCatalog — 57/57 PASS en 4 archivos; `test/service-catalog.integration-spec.ts` contra Neon dev `ep-shiny-firefly-b6z1ay37` — 3/3 PASS, incluida carrera de primer precio/cambio de moneda. `npx prisma migrate status` confirmó 5 migraciones aplicadas y esquema al día; no se creó migración en B4. Sin suites completas ni Playwright.
- Verificación B5 (2026-10-14, `api/`): `test/staff.integration-spec.ts` contra Neon dev autorizado `ep-shiny-firefly-b6z1ay37` — 1/1 PASS; typecheck y lint — PASS. No se creó migración. No se ejecutaron suites completas ni Playwright.
- Verificación B6 (2026-10-14, `api/`): `test/staff-services.integration-spec.ts` contra Neon dev autorizado `ep-shiny-firefly-b6z1ay37` — 2/2 PASS; typecheck y lint — PASS. No se creó migración. No se ejecutaron suites completas ni Playwright.
- Verificación B7 (2026-10-14, `app/`): pruebas focalizadas de ClientsScreen, transporte API/CSRF, fuentes Workspace y guardas — 29/29 PASS en 5 archivos; `npm run typecheck` y lint focalizado — PASS. No se ejecutaron suites completas ni Playwright.
- Verificación B8 (2026-10-14, `app/`): pruebas focalizadas de Servicios, Settings, transporte de versiones, Agenda y Clientes — 35/35 PASS en 5 archivos; `npm run typecheck` y lint focalizado — PASS. No se ejecutaron suites completas ni Playwright.
- Verificaciones focalizadas de revocación (ejecutadas antes de la unificación):
  - API unitarias (`npx vitest run src/organizations/organizations.service.spec.ts src/organizations/tenant.guard.spec.ts`): 21/21 PASS.
  - API integración (caso `persists member revocation` en `test/auth.integration-spec.ts`): 1/1 PASS contra PostgreSQL de pruebas aislado; sin migraciones.
  - `npm run lint` y `npm run typecheck` en `api/` y `app/`: PASS.
- Verificación UX de correo (2026-10-14): `npx vitest run src/components/auth/recovery-form.test.tsx src/components/auth/auth-form.test.tsx` en `app/` — 28/28 PASS; `npm run lint` — PASS; `npm run typecheck` — PASS.
- Verificación de unificación de Equipo (2026-10-14, `app/`): `npm run lint` y `npm run typecheck` — PASS; pruebas focalizadas de Equipo, guardas, configuración/enlace, workspace y navegación móvil — 30/30 PASS en 5 archivos. No se ejecutaron Playwright ni suites completas.

## Decisiones vigentes

- `Organization` es el límite de tenant; las operaciones requieren membresía y autorización verificadas por la API.
- Frontend y API son desplegables separados; la API es la única capa con acceso directo a PostgreSQL.
- La comunicación web/API inicial utiliza el transporte same-origin `/api` con proxy al backend.
- El backend es un monolito modular NestJS con autenticación propia según [`ADR-005`](../docs/architecture/decisions/ADR-005-custom-authentication.md).
- Prisma permanece en la versión mayor 7.

## Decisiones de producto de FEAT-003 — aprobadas; funcionalidad operativa pendiente

- EMPLOYEE consulta clientes, servicios y profesionales y crea/edita clientes, sin administrar servicios, precios ni personal. Sin acceso por defecto a gastos, cierres de caja o reportes financieros generales.
- StaffMember separado de OrganizationMember, con vínculo opcional y explícito a cuenta Nuari; sin acceso automático.
- Preparar funciones futuras opcionales por organización de ventas/servicios desde móvil, fichaje y estadísticas por empleado; capacidades configurables sin promover a ADMIN y profesional ejecutante distinto del usuario que registra. No implementarlas ahora.
- Cierre adicional aprobado: notas internas OWNER/ADMIN, archivo lógico sin perder historial, datos básicos del personal visibles y sensibles sólo OWNER/ADMIN, duplicados no bloqueantes, decimal exacto sin conversión automática, selección por servicio, duración 5–720 y sección independiente para profesionales conservando rutas de Clientes/Servicios.
- Cierre técnico: Decimal(12,2); cambio monetario confirmado y bloqueado con importes existentes; CUSTOMER_CHOICE/AUTO_ASSIGN/NO_ASSIGNMENT con sugerencia CUSTOMER_CHOICE sólo si hay habilitados, sin default DB ni omisión del modo en el alta actual; IN_PERSON inicial y remoto futuro; archivo OWNER/ADMIN; /app/profesionales, etiqueta Profesionales, y /app/equipo para accesos.
- Contrato canónico: TASK-09 secciones 1.4 y 10 y ADR-007. B1–B10 completados. La autorización no convirtió propuestas técnicas restantes en decisiones aprobadas. Siguen pendientes piloto/métrica, revisión visual Canvas, retención y definiciones de features futuras. Pruebas directas de constraints en DB desechable y despliegue desde cero también siguen pendientes.

## Próximo paso

FEAT-003 B1–B10 están cerrados dentro del alcance aprobado. Ventas, asistencia, reportes y configuración de capacidades siguen fuera de FEAT-003. [TASK-09](../docs/tasks/TASK-09-feat-003-operational-catalog.md) y [ADR-007](../docs/architecture/decisions/ADR-007-operational-core.md) conservan propuestas técnicas, piloto/métrica y retención como pendientes.

## Contexto para la próxima tarea

- [`TASK-09 — propuesta FEAT-003`](../docs/tasks/TASK-09-feat-003-operational-catalog.md)
- [`TASK-08`](../docs/tasks/TASK-08-feat-002-organization-members-invitations.md)
- [`TASK-07`](../docs/tasks/TASK-07-feat-001-authentication-onboarding.md)
- [`docs/architecture/decisions/ADR-005-custom-authentication.md`](../docs/architecture/decisions/ADR-005-custom-authentication.md)
- [`docs/architecture/multi-tenancy.md`](../docs/architecture/multi-tenancy.md)
