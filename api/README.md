# Nuari API

API REST de Nuari construida con NestJS. Es un proyecto npm independiente ubicado en `api/` y la única aplicación autorizada a acceder a PostgreSQL.

## Desarrollo

```powershell
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run start:dev
```

La API escucha por defecto en `http://localhost:3001/api`. El navegador accede a través de `http://localhost:3000/api`, que Next.js reescribe al origen interno de la API.

## Variables

- `PORT`: puerto HTTP, por defecto `3001`.
- `WEB_ORIGIN`: origen permitido por CORS, por defecto `http://localhost:3000` fuera de producción.
- `DATABASE_URL`: conexión pooled utilizada por el runtime.
- `DIRECT_URL`: conexión directa utilizada por Prisma CLI.
- `CSRF_SECRET`, `RATE_LIMIT_SECRET`: secretos independientes de al menos 32 bytes, administrados fuera del repositorio.
- `RESEND_API_KEY`, `EMAIL_FROM`: credenciales server-side para correo de verificación y recuperación.
- `TRUSTED_PROXY_CIDRS`: proxies de confianza explícitos del despliegue, cuando apliquen.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:integration
npm run build
npm audit --omit=dev --omit=optional
```

Prisma conecta de forma diferida ante la primera consulta. El health check y sus pruebas base no requieren una base activa. La suite de integración requiere un PostgreSQL de prueba aislado; no usar Neon compartido ni datos productivos.

## Migraciones y pruebas aisladas

Las tres migraciones aditivas separan identidad/seguridad, organizaciones y suscripciones/idempotencia. Ejecutar `db:migrate:deploy` con **ambas** URLs apuntando explícitamente al ambiente autorizado. No usar `db push`, reset o borrados como rollback: conservar backup y aplicar una corrección aditiva; una versión anterior no debe publicar onboarding parcial.

`test:integration` y los contratos HTTP de `test:e2e` requieren `TEST_DATABASE_URL` y `TEST_DIRECT_URL`: sólo loopback, base con nombre `test` o `nuari_task07`, mismo destino y schema público. No hay fallback a `.env`. Desplegar primero las migraciones. Si faltan URL/base/migraciones, las suites fallan explícitamente.

`test/harness.ts` exporta `createApiHarness`, `MutableClock` y `CapturingEmailSender`. Arranca `AppModule` con `configureApp` real, reemplaza reloj/correo por DI y conserva PostgreSQL/rate limiter reales. Ofrece `app`, `db`, `identity`, `organizations`, `subscriptions`, `user`, `ownedUsers`, `ownedOrganizations`, `dispatcher`, `cleanupFixtures` y `close`. Registrar toda fixture adicional en los sets; `close` elimina sólo esas filas y buckets identificados de su ejecución. No hay endpoints públicos de fixtures/tokens/reloj.

`npm run start:e2e` compila un runner **fuera de `src/`** y escucha HTTP sólo en `127.0.0.1:$PORT`. Exige `NUARI_E2E_TEST_MODE=1`, ambiente test/development, ambas URLs aisladas y `NUARI_E2E_CONTROL_SOCKET`. No importa dotenv ni bootstrap productivo. Socket Unix 0600 o named pipe local `\\.\pipe\nuari-e2e-*`: JSON delimitado por newline, `{id:UUID,operation,...}` → `{id,ok:true,result}` o error saneado. Operaciones: `mailbox.take {email}` devuelve link de verificación sólo del namespace `e2e-UUID@example.test`; `fixture.employee {runId}` devuelve credenciales de test y membresía del negocio del OWNER de esa ejecución; `fixture.multi-organization {runId}` crea un tenant independiente y membresía ADMIN, devuelve `{id,organizationId,name,role}`; `clock.advance {milliseconds}` avanza tiempo **sin modificar sesiones**; `run.cleanup {runId}` elimina sólo fixtures de esa ejecución. Un salto de 14 días vence también inactividad; re-login para verificar el vencimiento comercial.

## Límites operativos

Sesiones en cookies HttpOnly host-only; los DTO no contienen token/hash. CSRF usa el hash sólo como contexto de firma. El dispatcher de correo es acotado y no duradero: persiste tokens antes de enviar, no espera al proveedor en HTTP y drena al cerrar con timeout. Fallos/saturación no revierten cuentas; reenvío disponible. Entrega garantizada/outbox queda fuera del corte.

Producción exige origen HTTPS, secretos distintos, Resend y `TRUSTED_PROXY_CIDRS` explícito (vacío = socket solamente). No configurar confianza global. Verificar trayecto Next/ingress, cookies HTTPS y correo real en staging antes de publicar. Los dominios operativos siguen siendo locales en frontend.
