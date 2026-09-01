# Npm Root Layout Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the frontend and API to root-level directories and replace the pnpm workspace with two independent npm projects.

**Architecture:** `app/` and `api/` each own their dependencies, npm lockfile, scripts, and generated artifacts. The repository root remains documentation and coordination only, without a JavaScript package or dependency directory.

**Tech Stack:** Node.js 24, npm, Next.js, NestJS, Prisma 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-npm-root-layout-design.md`

## Global Constraints

- Preserve all application behavior and package names.
- Keep database credentials out of the frontend and repository.
- Do not initialize Git.
- Remove only generated dependency/build directories and the explicitly approved pnpm root files.
- Update living documentation in the same task.

---

### Task 1: Move the application directories

**Files:**
- Move: `apps/web/**` to `app/**`
- Move: `apps/api/**` to `api/**`
- Modify: `.gitignore`

**Interfaces:**
- Produces: root-level `app/` and `api/` directories used by all later commands and documentation.

- [x] **Step 1: Resolve and validate the exact source and destination paths inside the workspace.**
- [x] **Step 2: Remove generated dependency and build output from the two source applications.**
- [x] **Step 3: Move both application directories with native PowerShell operations.**
- [x] **Step 4: Update generated-client and tool ignore paths from `apps/...` to `api/...` and `app/...`.**
- [x] **Step 5: Verify `apps/` is empty and remove that empty directory.**

### Task 2: Replace pnpm with independent npm installs

**Files:**
- Modify: `app/package.json`
- Modify: `api/package.json`
- Create: `app/package-lock.json`
- Create: `api/package-lock.json`
- Delete: root pnpm and package-manager files listed in the approved spec

**Interfaces:**
- Produces: `npm install`, `npm run ...`, and `npm ci` workflows local to each application.

- [x] **Step 1: Add the Node.js 24 engine requirement to both application manifests.**
- [x] **Step 2: Delete the approved root pnpm files, root dependency directory, and root pnpm store after validating their absolute paths.**
- [x] **Step 3: Run `npm install` in `app` and `api` to generate independent lockfiles and dependencies.**
- [x] **Step 4: Generate the Prisma client using the API-local npm script and a non-secret temporary direct URL.**
- [x] **Step 5: Run `npm ci` in both projects to confirm reproducible clean installs.**

### Task 3: Update documentation and verify behavior

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/architecture/decisions/ADR-002-managed-postgresql.md`
- Modify: `docs/development/setup.md`
- Modify: `docs/development/testing.md`
- Modify: `.ai/context_snapshot.md`
- Modify: `.ai/known_issues.md`
- Modify: `app/README.md`
- Modify: `api/README.md`

**Interfaces:**
- Produces: accurate setup, verification, and handoff instructions for the npm layout.

- [x] **Step 1: Replace active pnpm commands and old application paths in canonical documentation.**
- [x] **Step 2: Record the npm migration in the context snapshot and remove resolved package-manager concerns.**
- [x] **Step 3: Run lint, typecheck, unit tests, builds, API e2e, and Prisma generation in their owning projects.**
- [x] **Step 4: Start both servers, request the web root and API health endpoint, then stop them.**
- [x] **Step 5: Scan for stale pnpm and `apps/web` or `apps/api` references, allowing only historical migration plans where explicitly labeled.**
- [x] **Step 6: Verify no `node_modules`, pnpm store, pnpm configuration, or JavaScript package manifest remains at the root.**
