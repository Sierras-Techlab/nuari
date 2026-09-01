# Nuari

Nuari es un SaaS multi-tenant para pequeños comercios y negocios de servicios que hoy administran su operación con WhatsApp, planillas, agendas y herramientas separadas.

Repositorio: [Sierras-Techlab/nuari](https://github.com/Sierras-Techlab/nuari)

El producto combina un núcleo común de gestión con módulos opcionales para servicios y comercio. Cada negocio opera dentro de una `Organization`, que constituye el límite de aislamiento de sus datos.

## Estructura

```text
app/   Frontend Next.js
api/   API NestJS y acceso a PostgreSQL
docs/  Producto, arquitectura y desarrollo
.ai/   Estado operativo breve para personas y agentes
```

`app` y `api` son proyectos npm independientes. Cada uno contiene su propio `package.json`, `package-lock.json` y `node_modules`; la raíz no es un workspace JavaScript.

## Inicio rápido

Requiere Node.js 24 y npm 11.

Frontend:

```bash
cd app
npm ci
npm run dev
```

API, en otra terminal:

```powershell
cd api
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run start:dev
```

La web queda en `http://localhost:3000`; la API, en `http://localhost:3001/api`. El endpoint de estado es `GET /api/health`.

Los valores de conexión de `api/.env.example` son placeholders. Para consultar o migrar Neon se deben reemplazar localmente por credenciales reales que nunca se suben al repositorio.

## Documentación

El índice documental está en [`docs/README.md`](docs/README.md). Las instrucciones para agentes están en [`AGENTS.md`](AGENTS.md) y el estado operativo más reciente en [`.ai/context_snapshot.md`](.ai/context_snapshot.md).

## Próximo paso

Seleccionar el negocio piloto y diseñar el primer corte vertical del dominio antes de agregar autenticación, ecommerce, pagos o automatizaciones.
