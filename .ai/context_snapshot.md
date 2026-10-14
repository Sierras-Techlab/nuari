# Context snapshot

- Actualizado: 2026-10-14
- Estado del repositorio: FEAT-001 y FEAT-002 cerradas; unificada la administración de miembros en `/app/equipo` el 2026-10-14. Los flujos principales de autenticación, configuración, invitaciones, permisos y revocación fueron validados manualmente.
- Fase: identidad, organización y membresías principales completadas. Equipo administra cuentas reales por API usando la UI de tarjetas elegida; la ruta anterior redirige con guardia. No hay una feature nueva iniciada.

## Objetivo actual

FEAT-001 y FEAT-002 están completadas. `/app/equipo` es el punto único de administración de miembros; los profesionales operativos siguen siendo un dominio separado.

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
- Limitaciones vigentes: el dispatcher en memoria no garantiza recepción, rebotes ni reintentos durables de correo; la carga de logos está deshabilitada hasta disponer de almacenamiento seguro; los módulos operativos Turnero mantienen estado local y no son persistencia de negocio real. La validación manual confirmada cubre los flujos principales, no todos los casos de producción/staging.
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

## Próximo paso

No hay una tarea funcional activa. Consultar `.ai/known_issues.md` y definir el próximo alcance con producto antes de iniciar trabajo nuevo.

## Contexto para la próxima tarea

- [`TASK-08`](../docs/tasks/TASK-08-feat-002-organization-members-invitations.md)
- [`TASK-07`](../docs/tasks/TASK-07-feat-001-authentication-onboarding.md)
- [`docs/architecture/decisions/ADR-005-custom-authentication.md`](../docs/architecture/decisions/ADR-005-custom-authentication.md)
- [`docs/architecture/multi-tenancy.md`](../docs/architecture/multi-tenancy.md)
