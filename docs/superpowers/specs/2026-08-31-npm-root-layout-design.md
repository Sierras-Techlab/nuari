# Diseño de estructura raíz con npm

- Estado: aprobado
- Fecha: 2026-08-31

## Objetivo

Simplificar el repositorio para que el frontend y la API sean proyectos npm independientes ubicados directamente como `app/` y `api/` en la raíz.

## Estructura resultante

```text
nuari-app/
  app/
    package.json
    package-lock.json
    node_modules/
  api/
    package.json
    package-lock.json
    node_modules/
  docs/
  .ai/
  AGENTS.md
  README.md
  .gitignore
```

Cada aplicación conserva sus scripts, dependencias y lockfile. No habrá workspace ni scripts npm en la raíz.

## Decisiones

- Mover `apps/web` a `app` y `apps/api` a `api`.
- Reemplazar pnpm por npm en instalación, ejecución y verificación.
- Eliminar `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `.pnpm-store` y `node_modules` de la raíz.
- Generar un `package-lock.json` independiente en cada aplicación.
- Mantener Node.js 24 como requisito documentado y declarado en ambos `package.json`.
- Conservar los nombres de paquete `@nuari/web` y `@nuari/api`; son identificadores internos y no determinan las rutas.
- Actualizar rutas de Prisma, variables de ambiente, documentación y reglas de ignore.

## Comandos resultantes

Frontend:

```bash
cd app
npm install
npm run dev
```

API:

```bash
cd api
npm install
npm run start:dev
```

Las verificaciones se ejecutarán dentro de cada proyecto. La API mantendrá sus comandos de Prisma y prueba end-to-end.

## Verificación

- Instalación reproducible con `npm ci` en `app` y `api`.
- Lint, typecheck, tests y build en ambos proyectos.
- Prueba end-to-end y generación Prisma en `api`.
- Smoke test HTTP de web y health de API.
- Ausencia de pnpm, `apps/web` y `apps/api` en configuración/documentación vigente.
- Ausencia de dependencias generadas en la raíz.
