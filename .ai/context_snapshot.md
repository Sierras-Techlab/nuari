# Context snapshot

- Actualizado: 2026-10-14
- Estado del repositorio: corregida la revocación FEAT-002: el listado filtra membresías activas, el estado revocado se informa al usuario, y el contexto de autenticación conserva/fallbackea la sesión. Se mantienen los cambios previos de TASK-08 en el árbol de trabajo.
- Fase: recuperación del registro → verificación → retorno a invitación completada; revocación de miembros y navegación posterior corregidas. Fase 2 de endurecimiento general de invitaciones no iniciada.

## Objetivo actual

La corrección acotada de revocación de FEAT-002 está implementada; no iniciar la Fase 2 de endurecimiento general de invitaciones sin autorización explícita.

## Estado verificable

- `app/` y `api/` son proyectos npm independientes; el frontend usa Next.js y la API usa NestJS.
- La raíz de Turbopack está fijada explícitamente en `app/next.config.ts`.
- Registro, login, logout, recuperación/verificación de correo y onboarding usan el transporte same-origin `/api`; la creación inicial y los contextos de organización provienen de la API. `/onboarding` y cada página `/app/**` verifican contexto server-side.
- `/app/configuracion` está integrada con la API (`GET /api/organizations/:id` y `PATCH /api/organizations/:id`), validaciones regionales, guardado reactivo, restricción de slug solo a OWNER y aviso explicativo para carga de logos.
- `/app/configuracion/miembros` está creada y protegida por `guardPage("business")`, integrando el diseño definitivo de Gemini Canvas con React, TypeScript y Tailwind: gestión de roles, listado de miembros activos, emisión de invitaciones por correo, revocación de accesos e invitaciones, restricciones para el último OWNER y control según rol de la sesión.
- `/invitacion/[token]` está implementada fuera del dashboard con diseño fiel de Gemini Canvas: consulta pública del token, opciones de login/registro, sesión automática tras registro, verificación de identidad por correo, retorno seguro a la invitación y aceptación atómica con asignación directa a la organización.
- `DELETE /api/organizations/:id/members/:memberId` conserva la cuenta y su historial y marca la membresía `INACTIVE`; `GET /members` lista sólo `ACTIVE`. `/auth/me` reelige una organización activa válida o conserva la sesión sin tenant y reporta `ACCESS_REVOKED`; `/onboarding` explica la revocación y permite crear una organización sólo si el backend lo habilita. `TenantGuard` sigue resolviendo la membresía activa en cada petición.
- La verificación desde invitaciones conserva `returnTo` validado en el correo de verificación, por lo que funciona al abrirlo en otra pestaña; el reenvío no invalida el último token utilizable si la entrega falla y las confirmaciones repetidas de la misma cuenta verificada son idempotentes.
- No se agregaron migraciones ni se enviaron correos reales durante esta fase; el dispatcher de memoria informa éxito/fallo del adaptador, pero no garantiza entrega final en la bandeja sin una infraestructura posterior.
- Verificaciones focalizadas de esta corrección:
  - API unitarias (`npx vitest run src/organizations/organizations.service.spec.ts src/organizations/tenant.guard.spec.ts`): 21/21 PASS.
  - API integración (caso `persists member revocation` en `test/auth.integration-spec.ts`): 1/1 PASS contra PostgreSQL de pruebas aislado; sin migraciones.
  - Frontend (`members-screen`, `onboarding-screen` y `browser.test.ts`): 29/29 PASS.
  - `npm run lint` y `npm run typecheck` en `api/` y `app/`: PASS.

## Decisiones vigentes

- `Organization` es el límite de tenant; las operaciones requieren membresía y autorización verificadas por la API.
- Frontend y API son desplegables separados; la API es la única capa con acceso directo a PostgreSQL.
- La comunicación web/API inicial utiliza el transporte same-origin `/api` con proxy al backend.
- El backend es un monolito modular NestJS con autenticación propia según [`ADR-005`](../docs/architecture/decisions/ADR-005-custom-authentication.md).
- Prisma permanece en la versión mayor 7.

## Próxima tarea

Esperar autorización del usuario para Fase 2; no comenzar endurecimiento general de invitaciones.

## Contexto para la próxima tarea

- [`TASK-08`](../docs/tasks/TASK-08-feat-002-organization-members-invitations.md)
- [`TASK-07`](../docs/tasks/TASK-07-feat-001-authentication-onboarding.md)
- [`docs/architecture/decisions/ADR-005-custom-authentication.md`](../docs/architecture/decisions/ADR-005-custom-authentication.md)
- [`docs/architecture/multi-tenancy.md`](../docs/architecture/multi-tenancy.md)
