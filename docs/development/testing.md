# Estrategia de pruebas

## Objetivo

Las pruebas deben demostrar reglas de negocio, contratos y aislamiento entre organizaciones. Los flujos financieros y multi-tenant requerirán mayor profundidad que la base técnica.

## Capas

### Unitarias

- Casos de uso y reglas de dominio.
- Validadores y transformaciones.
- Componentes o hooks con comportamiento relevante.
- Adaptadores externos mediante dobles de prueba.

Las pruebas unitarias cubren reglas de dominio, DTOs, adaptadores y presentación sin servicios externos. Los flujos de autenticación usan `Clock` y `EmailSender` inyectables: los tests pueden fijar el tiempo y capturar mensajes sin exponer tokens mediante endpoints ni depender de un proveedor real. No usar esperas reales para expiraciones.

### Integración

- Repositorios contra PostgreSQL de prueba.
- Restricciones e índices.
- Resolución de tenant context.
- Endpoints NestJS y manejo de errores.
- Idempotencia de webhooks cuando se implementen.

La integración de identidad y organizaciones usa PostgreSQL real y aislado, con URLs de prueba explícitas. Comprueba constraints, transacciones, concurrencia e aislamiento; no sustituir estas propiedades por mocks de Prisma. El harness debe rechazar URLs compartidas/productivas y limpiar sólo registros que creó.

### End-to-end

La API conserva un smoke test HTTP de `GET /api/health`, independiente de una conexión DB. FEAT-001 incorpora E2E HTTP con PostgreSQL y navegador Playwright para autenticación, onboarding, rutas SSR, membresías multi-organización y expiración de suscripción. El navegador se ejecuta contra `build`/`start` además de desarrollo para comprobar rewrite y cookies. El estado y resultados se registran en [TASK-07](../tasks/TASK-07-feat-001-authentication-onboarding.md).

## Multi-tenancy

Cada módulo con información operativa debe probar al menos dos organizaciones en el mismo escenario para demostrar que lecturas, escrituras, búsquedas y reportes no mezclan datos.

## Comandos

Frontend, desde `app/`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

API, desde `api/`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Pruebas enfocadas:

```bash
# app/
npm test -- src/lib/api/api-client.test.ts

# api/
npm test -- src/app.controller.spec.ts
npm test -- src/database/database.config.spec.ts
```

Auditoría de dependencias:

```bash
# app/
npm audit

# api/, árbol usado en producción
npm audit --omit=dev --omit=optional
```

## Estado actual

- Frontend (2026-10-12): lint, typecheck, 126 pruebas en 24 archivos y build pasaron. Playwright no inició porque falta `TEST_DATABASE_URL`/`TEST_DIRECT_URL` aisladas.
- API (2026-10-12): lint, typecheck, build y 57 pruebas unitarias en 11 archivos pasaron. Cuatro pruebas HTTP con servicios aislados pasaron; el resto de `test:e2e` requiere DB.
- API `test:integration` y `test:e2e` no pudieron completar: el harness rechazó correctamente la ausencia de URLs de PostgreSQL explícitas. No se aplicaron migraciones ni se probaron garantías DB.
- `npm audit --omit=dev --omit=optional` de API pasó sin vulnerabilidades. `npm audit` web y auditoría completa de API reportan advisories pendientes; detalle en [problemas conocidos](../../.ai/known_issues.md).

Las pruebas contra PostgreSQL temporal/aislado no requieren credenciales Neon. La entrega real de correo y la validación de HTTPS, cookies productivas, proxies y despliegue requieren un ambiente staging configurado; no son PASS por completar los tests locales.

## Regla de finalización

Se debe informar qué verificaciones se ejecutaron y su resultado. Una prueba no ejecutada no puede presentarse como aprobada.
