# Nuari Project Initialization Implementation Plan

> **Estado histórico:** completado el 2026-08-28 y reemplazado en estructura y package manager por [`2026-08-31-npm-root-layout.md`](2026-08-31-npm-root-layout.md). Las rutas y comandos de este documento describen la inicialización original, no el estado vigente.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a runnable Next.js frontend and NestJS API, prepare Prisma 7 for Neon PostgreSQL, and expose a tested Axios client configuration from the frontend.

**Architecture:** Use a plain pnpm workspace with independent `apps/web` and `apps/api` packages. The web application calls the REST API through a lazy Axios singleton; only the API owns database access through a Nest database module and Prisma adapter. No business module, authentication, live database mutation, or deployment configuration is introduced in this foundation task.

**Tech Stack:** Node.js 24, pnpm 11, Next.js App Router, React, Tailwind CSS, NestJS, Prisma ORM 7, PostgreSQL/Neon, Axios, Vitest, Nest test utilities.

**Spec:** `docs/architecture/overview.md`, `docs/architecture/deployment.md`, `docs/development/setup.md`, and `docs/architecture/decisions/ADR-001-modular-monolith.md` through `ADR-004-living-documentation.md`.

## Global Constraints

- `Organization` remains the tenant boundary; this task does not yet add tenant entities.
- Business logic belongs in `apps/api`, not in React components or the Axios client.
- The browser never receives PostgreSQL credentials.
- `DATABASE_URL` is the pooled runtime connection and `DIRECT_URL` is the direct CLI/migration connection.
- Secrets are never committed; example environment files contain only descriptive placeholders.
- Use pnpm workspaces without Turborepo until a concrete orchestration need appears.
- Pin Prisma to major version 7 for its supported schema-and-migration workflow; evaluate Prisma 8 separately instead of adopting a new major implicitly.
- The directory is not currently a Git repository, so this execution cannot create task commits. Git initialization is outside this plan.
- Update living documentation and `.ai/context_snapshot.md` before declaring the task complete.

---

### Task 1: Root pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.nvmrc`
- Create: `.gitignore`

**Interfaces:**
- Produces: workspace packages `@nuari/web` and `@nuari/api`, root scripts for development and verification.

- [x] **Step 1: Create the root workspace manifest**

```json
{
  "name": "nuari",
  "private": true,
  "packageManager": "pnpm@11.19.0",
  "engines": { "node": ">=24.0.0", "pnpm": ">=11.0.0" },
  "scripts": {
    "dev:web": "pnpm --filter @nuari/web dev",
    "dev:api": "pnpm --filter @nuari/api start:dev",
    "build": "pnpm -r --if-present build",
    "lint": "pnpm -r --if-present lint",
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck"
  }
}
```

- [x] **Step 2: Configure package discovery and deterministic installs**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Set `.npmrc` to use an exact lockfile and add Node 24 to `.nvmrc`.

- [x] **Step 3: Protect local secrets and generated artifacts**

Create `.gitignore` entries for `node_modules`, Next/Nest build output, coverage, real `.env` files, generated Prisma client output, local logs, and `graphify-out/`, while preserving `.env.example` files.

- [x] **Step 4: Verify workspace metadata**

Run `pnpm list -r --depth -1` after both applications exist. Expected: root, `@nuari/web`, and `@nuari/api` are listed.

### Task 2: Next.js web application and Axios boundary

**Files:**
- Create through official scaffold: `apps/web/**`
- Create: `apps/web/src/lib/api/api-client.ts`
- Create: `apps/web/src/lib/api/api-client.test.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/.env.example`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Produces: `getApiBaseUrl(env?)`, `createApiClient(baseURL?)`, and `getApiClient()`.
- Consumes: `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001/api` outside production.

- [x] **Step 1: Scaffold the web app without installing independently**

Run the current official `create-next-app` with TypeScript, ESLint, Tailwind, App Router, `src/`, pnpm, `@/*`, and `--skip-install` into `apps/web`. Rename the package to `@nuari/web`.

- [x] **Step 2: Write failing Axios configuration tests**

```ts
expect(getApiBaseUrl({ NODE_ENV: "development" })).toBe(
  "http://localhost:3001/api",
);
expect(
  getApiBaseUrl({
    NODE_ENV: "production",
    NEXT_PUBLIC_API_URL: "https://api.nuari.app/api/",
  }),
).toBe("https://api.nuari.app/api");
expect(() => getApiBaseUrl({ NODE_ENV: "production" })).toThrow(
  "NEXT_PUBLIC_API_URL",
);
expect(createApiClient("https://api.nuari.app/api").defaults.timeout).toBe(
  10_000,
);
```

- [x] **Step 3: Run the focused test and confirm red state**

Run `pnpm --filter @nuari/web test -- src/lib/api/api-client.test.ts`. Expected: failure because the API client module is not implemented.

- [x] **Step 4: Implement lazy Axios configuration**

Implement normalized base URL resolution, a 10-second timeout, JSON headers, and a lazy singleton. Do not create the singleton at module evaluation time so production builds can complete without runtime environment access.

- [x] **Step 5: Run the focused test and confirm green state**

Run `pnpm --filter @nuari/web test -- src/lib/api/api-client.test.ts`. Expected: all Axios configuration tests pass.

- [x] **Step 6: Replace starter content and document the variable**

Use a minimal Spanish Nuari foundation page and metadata. Add `NEXT_PUBLIC_API_URL=http://localhost:3001/api` to `.env.example` without real credentials.

### Task 3: NestJS API foundation and health contract

**Files:**
- Create through official scaffold: `apps/api/**`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.controller.ts`
- Modify: `apps/api/src/app.controller.spec.ts`
- Create: `apps/api/.env.example`

**Interfaces:**
- Produces: `GET /api/health` returning `{ "status": "ok" }`.
- Consumes: `PORT` with default `3001`, and `WEB_ORIGIN` with default `http://localhost:3000` outside production.

- [x] **Step 1: Scaffold the strict Nest application**

Run the current official Nest CLI into `apps/api` with strict TypeScript, pnpm, and no nested Git repository. Rename the package to `@nuari/api` and keep the scaffold's supported test runner.

- [x] **Step 2: Write the failing health-controller test**

```ts
expect(controller.getHealth()).toEqual({ status: "ok" });
```

- [x] **Step 3: Run the focused API test and confirm red state**

Run the package's focused controller test. Expected: failure because `getHealth` is not implemented.

- [x] **Step 4: Implement the REST foundation**

Add the global `/api` prefix, port 3001 default, CORS for the configured web origin, and `GET /health` on the controller.

- [x] **Step 5: Run the focused API test and confirm green state**

Run the focused controller test. Expected: the health contract test passes.

### Task 4: Prisma 7 and Neon-ready database module

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma.config.ts`
- Create: `apps/api/src/database/database.config.ts`
- Create: `apps/api/src/database/database.config.spec.ts`
- Create: `apps/api/src/database/prisma.service.ts`
- Create: `apps/api/src/database/database.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces: global `DatabaseModule`, injectable `PrismaService`, and `getDatabaseUrl(env)`.
- Consumes: pooled `DATABASE_URL` at runtime and direct `DIRECT_URL` in Prisma CLI config.

- [x] **Step 1: Install pinned Prisma 7 PostgreSQL dependencies**

Install `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg@7`, `pg`, `dotenv`, and the required development types in `@nuari/api`.

- [x] **Step 2: Write failing database configuration tests**

```ts
expect(
  getDatabaseUrl({ DATABASE_URL: "postgresql://pooled.example/nuari" }),
).toBe("postgresql://pooled.example/nuari");
expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL");
```

- [x] **Step 3: Run the focused test and confirm red state**

Run the database configuration spec. Expected: failure because the configuration module does not exist.

- [x] **Step 4: Configure schema, CLI, and runtime**

Use PostgreSQL in `schema.prisma`, emit the generated client under `src/generated/prisma`, read `DIRECT_URL` from `prisma.config.ts`, and create `PrismaService` with `PrismaPg` using the validated pooled runtime URL. Do not create domain models or a migration in this task.

- [x] **Step 5: Register the database module**

Mark `DatabaseModule` global, export `PrismaService`, and import the module from `AppModule`. Avoid connecting during module initialization so health tests do not require a live database; Prisma will connect lazily on the first query.

- [x] **Step 6: Generate the client and run the focused test**

Run Prisma generation with a non-secret temporary `DIRECT_URL`, then execute the configuration spec. Expected: generation succeeds and all configuration tests pass.

### Task 5: Workspace verification and living documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture/decisions/ADR-002-managed-postgresql.md`
- Modify: `docs/development/setup.md`
- Modify: `docs/development/testing.md`
- Modify: `.ai/context_snapshot.md`
- Modify: `.ai/known_issues.md`

**Interfaces:**
- Produces: verified commands and an accurate handoff for the first domain task.

- [x] **Step 1: Install once from the workspace root**

Run `pnpm install` and retain the root `pnpm-lock.yaml`. No app-local lockfiles may remain.

- [x] **Step 2: Run full static and automated verification**

Run root `lint`, `typecheck`, `test`, and `build`. Run both development servers long enough to request the API health endpoint and load the web root.

- [x] **Step 3: Check configuration safety**

Confirm `.env.example` files are present, real `.env` files are ignored, the frontend contains no database URL, and generated Prisma output is not committed as a source-of-truth artifact.

- [x] **Step 4: Update canonical documentation**

Record exact versions, commands, environment variables, ports, Prisma 7 pin rationale, and verification results. Remove the resolved package-manager decision from `.ai/known_issues.md`.

- [x] **Step 5: Refresh the context snapshot**

Set the next objective to selecting the first business pilot and designing the first vertical domain slice. Record any verification that could not run because Neon credentials were not supplied.
