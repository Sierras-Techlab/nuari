# Estrategia de pruebas

## Objetivo

Las pruebas deben demostrar reglas de negocio, contratos y aislamiento entre organizaciones. Los flujos financieros y multi-tenant requerirán mayor profundidad que la base técnica.

## Capas

### Unitarias

- Casos de uso y reglas de dominio.
- Validadores y transformaciones.
- Componentes o hooks con comportamiento relevante.
- Adaptadores externos mediante dobles de prueba.

La suite actual prueba la resolución de configuración, el cliente Axios, el contrato de health, el registro del módulo de base y el comportamiento de las pantallas web, incluida la agenda demostrativa, sin servicios externos.

### Integración

- Repositorios contra PostgreSQL de prueba.
- Restricciones e índices.
- Resolución de tenant context.
- Endpoints NestJS y manejo de errores.
- Idempotencia de webhooks cuando se implementen.

Se incorporarán con el primer módulo de dominio usando una base aislada de desarrollo o CI.

### End-to-end

Actualmente existe un smoke test HTTP de `GET /api/health`. La agenda demostrativa se prueba con Vitest y Testing Library; aún no existe Playwright. La prueba de navegador del flujo completo se incorporará cuando la agenda se conecte a identidad y datos reales de la API.

## Multi-tenancy

Cada módulo con información operativa debe probar al menos dos organizaciones en el mismo escenario para demostrar que lecturas, escrituras, búsquedas y reportes no mezclan datos.

## Comandos

Frontend, desde `app/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

API, desde `api/`:

```bash
npm run lint
npm run typecheck
npm test
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

- Frontend: 44 pruebas unitarias distribuidas en 13 archivos.
- API: 11 pruebas unitarias distribuidas en 4 archivos.
- API end-to-end: 1 prueba HTTP.
- No se ejecutó una consulta real a Neon porque no se proporcionaron credenciales.

## Regla de finalización

Se debe informar qué verificaciones se ejecutaron y su resultado. Una prueba no ejecutada no puede presentarse como aprobada.
