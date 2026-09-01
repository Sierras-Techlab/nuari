# Context snapshot

- Actualizado: 2026-08-31
- Estado del repositorio: frontend y API verificados como proyectos npm independientes
- Fase: preparado para elegir y diseñar el primer corte vertical de negocio

## Objetivo actual

Seleccionar el negocio piloto del MVP y definir el primer flujo vertical que reemplace un registro manual real.

## Completado

- Frontend ubicado en `app/` y API ubicada en `api/`.
- Raíz limitada a aplicaciones, documentación y archivos de coordinación; sin dependencias JavaScript generadas.
- Cada proyecto declara Node.js 24, npm 11 y posee su propio `package-lock.json`.
- `npm ci` aprobado en ambos proyectos.
- Cliente Prisma 7 regenerado desde `api/`.
- Dependencia no utilizada `@nestjs/mau` eliminada junto con su script de deploy.
- Documentación canónica migrada a rutas y comandos npm.
- Guía compartida para agentes actualizada; roles de OpenCode, flujo de tareas y fuentes canónicas documentados en `AGENTS.md`.

## Decisiones vigentes

- `Organization` es el tenant boundary.
- Frontend y API son desplegables y proyectos npm independientes.
- La API es la única capa con acceso directo a PostgreSQL.
- La comunicación inicial web/API es REST mediante Axios.
- El backend inicia como monolito modular, no como microservicios.
- La API se implementará con NestJS y la autenticación será propia; sus requisitos base están en `docs/architecture/decisions/ADR-005-custom-authentication.md`.
- Prisma permanece en la versión mayor 7 hasta evaluar explícitamente otra versión mayor.

## Verificación de la migración

- `npm ci` aprobado en ambos proyectos.
- Lint y typecheck aprobados en frontend y API.
- 5 pruebas unitarias del frontend y 11 de la API aprobadas.
- Prueba HTTP end-to-end de la API aprobada.
- Builds de producción aprobados en ambos proyectos.
- Web respondió HTTP 200 y la API devolvió `{ "status": "ok" }`.
- Auditoría del frontend y del árbol productivo de la API: 0 vulnerabilidades.
- Dos lockfiles, uno por proyecto, y ningún manifiesto, lockfile o directorio de dependencias en la raíz.

## Próxima tarea

1. Elegir el tipo de negocio piloto.
2. Describir su flujo manual actual y la métrica de validación.
3. Diseñar el primer corte vertical, incluyendo modelo, contrato API e interfaz mínima.

## Contexto que debe leerse para la próxima tarea

- `docs/product/mvp.md`
- `docs/product/glossary.md`
- `docs/architecture/modules.md`
- `docs/architecture/data-model.md`
- `docs/architecture/multi-tenancy.md`
- `.ai/known_issues.md`

## Nota operativa

El repositorio usa la rama `main` y el remoto `origin` apunta a `https://github.com/Sierras-Techlab/nuari.git`.
