# Configuración de desarrollo

## Requisitos

- Node.js 24.
- npm 11.
- Una cuenta y proyecto de Neon sólo cuando se necesite ejecutar consultas o migraciones reales.

El frontend y la API son proyectos npm independientes. No existe un workspace ni un `package.json` en la raíz.

## Instalación

Frontend:

```bash
cd app
npm ci
```

API:

```bash
cd api
npm ci
```

Cada aplicación tiene su propio `package-lock.json`. Usar `npm install` al agregar o actualizar dependencias y `npm ci` para reproducir el lockfile sin modificarlo.

## Variables de ambiente

### API

Copiar `api/.env.example` a `api/.env` y reemplazar los placeholders cuando corresponda:

```text
PORT=3001
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://...        conexión pooled para el runtime
DIRECT_URL=postgresql://...          conexión directa para Prisma CLI
```

La API puede iniciar y responder el health check sin consultar PostgreSQL porque Prisma conecta de forma diferida. Las operaciones de datos sí requieren un `DATABASE_URL` válido.

### Frontend

Copiar `app/.env.example` a `app/.env.local` sólo si se necesita modificar:

```text
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

En desarrollo y tests esa URL es también el valor predeterminado. Ninguna variable pública puede contener credenciales de PostgreSQL.

## Ejecución local

En `app/`:

```bash
npm run dev
```

En `api/`:

```bash
npm run start:dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Health: `http://localhost:3001/api/health`

## Prisma

Prisma 7 genera el cliente en `api/src/generated/prisma`, directorio ignorado y regenerable.

Desde `api/`:

```bash
npm run db:generate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:studio
```

Los comandos leen `DIRECT_URL` mediante `api/prisma.config.ts`. No hay modelos de dominio ni migraciones en la base inicial.

## Instalación productiva

La API no necesita Prisma CLI en ejecución. Para excluir dependencias de desarrollo y peers opcionales:

```bash
npm ci --omit=dev --omit=optional
```

Ese árbol productivo se verifica con `npm audit --omit=dev --omit=optional`.

## Versiones iniciales relevantes

- Next.js 16.3.3 y React 19.2.8.
- NestJS 12.0.1.
- Prisma y adaptador PostgreSQL 7.10.0.
- Axios 1.20.0.
- Vitest 4.1.x.
- TypeScript 5.9.x en el frontend y 6.0.x en la API.

## Resolución de problemas

- Si falta el cliente Prisma generado, ejecutar `npm run db:generate` desde `api/` con `DIRECT_URL` definido.
- Si Next informa que no existe `LayoutProps`, ejecutar `npm run typecheck` desde `app/`; el script genera los tipos antes de invocar TypeScript.
- Si Prisma no puede conectarse, comprobar que el runtime usa la URL pooled en `DATABASE_URL` y Prisma CLI la directa en `DIRECT_URL`.
- Si el puerto está ocupado, cambiar `PORT` en la API y mantener `NEXT_PUBLIC_API_URL` sincronizada.
