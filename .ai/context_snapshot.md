# Context snapshot

- Actualizado: 2026-10-12
- Estado del repositorio: FEAT-001 (TASK-07) completada y verificada de punta a punta. Migraciones aplicadas en Neon dev (`ep-shiny-firefly-b6z1ay37`). Pruebas unitarias, de integración, HTTP e2e y Playwright en navegador aprobadas. Teardown y limpieza de fixtures validado sin errores.
- Fase: FEAT-001 terminada y verificada. Listo para planificar e implementar FEAT-002 (persistencia y lógica de negocio del flujo vertical / Turnero).

## Objetivo actual

Preparar la especificación e inicio de FEAT-002, integrando los flujos del Turnero con el contexto de autenticación, organización y persistencia de PostgreSQL establecido por FEAT-001.

## Estado verificable

- `app/` y `api/` son proyectos npm independientes; el frontend usa Next.js y la API usa NestJS.
- La raíz de Turbopack está fijada explícitamente en `app/next.config.ts`.
- Registro, login, logout, recuperación/verificación de correo y onboarding usan el transporte same-origin `/api`; la creación inicial y los contextos de organización provienen de la API. `/onboarding` y cada página `/app/**` verifican contexto server-side.
- `/app` presenta el módulo Turnero; `/app/agenda`, `/app/servicios`, `/app/clientes`, `/app/caja` y `/app/equipo` permiten recorrer y registrar datos locales durante la sesión.
- La base de datos Neon PostgreSQL (`ep-shiny-firefly-b6z1ay37`, rama `dev`) tiene las 3 migraciones aplicadas (`202610120001_identity_security`, `202610120002_organizations`, `202610120003_subscriptions_onboarding`).
- Verificaciones aprobadas en API:
  - Unit tests (`npm test`): 64/64 PASS.
  - Integration tests (`npm run test:integration` contra Neon dev): 26/26 PASS (concurrencia, idempotencia, unicidad, rollback).
  - HTTP E2E (`npm run test:e2e` Supertest): 25/25 PASS.
  - Typecheck y Lint: PASS.
- Verificaciones aprobadas en Frontend:
  - Unit tests (`npm test`): 126/126 PASS.
  - Typecheck y Lint: PASS.
  - Playwright E2E (`app/e2e/authentication.spec.ts`): PASS con código de salida 0. Registro, verificación de token, onboarding de 4 pasos, redirección a `/app`, multi-organización, contexto de empleado, reloj simulado, expiración de prueba (14 días), restricción de rutas privadas y teardown/limpieza en PostgreSQL sin fallos de clave foránea.
- Los procesos de prueba fueron cerrados y los puertos de prueba liberados sin afectar los servicios activos de desarrollo (`3000` y `3001`).

## Decisiones vigentes

- `Organization` es el límite de tenant; las operaciones requieren membresía y autorización verificadas por la API.
- Frontend y API son desplegables separados; la API es la única capa con acceso directo a PostgreSQL.
- La comunicación web/API inicial utiliza el transporte same-origin `/api` con proxy al backend.
- El backend es un monolito modular NestJS con autenticación propia según [`ADR-005`](../docs/architecture/decisions/ADR-005-custom-authentication.md).
- Prisma permanece en la versión mayor 7.

## Próxima tarea

1. Definir la especificación y criterios de aceptación para FEAT-002 (persistencia y backend del módulo operativo / Turnero para el piloto).
2. Modelar las entidades operativas (turnos, servicios, profesionales) asegurando aislamiento multi-tenant por `Organization`.

## Contexto para la próxima tarea

- [`docs/product/mvp.md`](../docs/product/mvp.md)
- [`docs/product/glossary.md`](../docs/product/glossary.md)
- [`docs/architecture/modules.md`](../docs/architecture/modules.md)
- [`docs/architecture/data-model.md`](../docs/architecture/data-model.md)
- [`docs/architecture/multi-tenancy.md`](../docs/architecture/multi-tenancy.md)
- [`.ai/known_issues.md`](known_issues.md)
- [`TASK-07`](../docs/tasks/TASK-07-feat-001-authentication-onboarding.md)
