# Nuari API

API REST de Nuari construida con NestJS. Es un proyecto npm independiente ubicado en `api/` y la única aplicación autorizada a acceder a PostgreSQL.

## Desarrollo

```powershell
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run start:dev
```

La API escucha por defecto en `http://localhost:3001/api` y expone `GET /api/health`.

## Variables

- `PORT`: puerto HTTP, por defecto `3001`.
- `WEB_ORIGIN`: origen permitido por CORS, por defecto `http://localhost:3000` fuera de producción.
- `DATABASE_URL`: conexión pooled utilizada por el runtime.
- `DIRECT_URL`: conexión directa utilizada por Prisma CLI.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev --omit=optional
```

Prisma conecta de forma diferida ante la primera consulta. El health check y las pruebas base no requieren una base activa. Todavía no existen modelos de dominio ni migraciones.
