# Documentación de Nuari

Este directorio contiene la fuente de verdad legible para producto, arquitectura y desarrollo. La documentación debe representar el estado vigente del sistema y actualizarse junto con los cambios que describe.

## Producto

- [`product/vision.md`](product/vision.md): problema, propuesta de valor, usuarios y alcance general.
- [`product/mvp.md`](product/mvp.md): objetivo de validación, límites y decisiones pendientes del MVP.
- [`product/glossary.md`](product/glossary.md): vocabulario común del dominio.

## Arquitectura

- [`architecture/overview.md`](architecture/overview.md): arquitectura general y límites desplegables.
- [`architecture/modules.md`](architecture/modules.md): responsabilidades y dependencias de los módulos.
- [`architecture/data-model.md`](architecture/data-model.md): modelo conceptual e invariantes.
- [`architecture/multi-tenancy.md`](architecture/multi-tenancy.md): aislamiento de organizaciones y autorización.
- [`architecture/deployment.md`](architecture/deployment.md): topología y estrategia de despliegue.

### Decisiones arquitectónicas

- [`architecture/decisions/ADR-001-modular-monolith.md`](architecture/decisions/ADR-001-modular-monolith.md)
- [`architecture/decisions/ADR-002-managed-postgresql.md`](architecture/decisions/ADR-002-managed-postgresql.md)
- [`architecture/decisions/ADR-003-tenant-isolation.md`](architecture/decisions/ADR-003-tenant-isolation.md)
- [`architecture/decisions/ADR-004-living-documentation.md`](architecture/decisions/ADR-004-living-documentation.md)

## Desarrollo

- [`development/setup.md`](development/setup.md): prerrequisitos y puesta en marcha local.
- [`development/testing.md`](development/testing.md): estrategia y comandos de verificación.
- [`development/conventions.md`](development/conventions.md): convenciones de código y colaboración.

## Planes de implementación

- [`superpowers/plans/2026-08-31-npm-root-layout.md`](superpowers/plans/2026-08-31-npm-root-layout.md): migración vigente a `app/` y `api/` como proyectos npm independientes.
- [`superpowers/plans/2026-08-27-project-initialization.md`](superpowers/plans/2026-08-27-project-initialization.md): plan histórico de la inicialización original, reemplazado en su estructura de paquetes.

## Especificaciones

- [`superpowers/specs/2026-08-31-npm-root-layout-design.md`](superpowers/specs/2026-08-31-npm-root-layout-design.md): estructura raíz aprobada y límites de cada proyecto npm.

## Contexto operativo

Los archivos de `.ai/` no sustituyen esta documentación:

- [`.ai/context_snapshot.md`](../.ai/context_snapshot.md): estado breve de la tarea y próximos pasos.
- [`.ai/known_issues.md`](../.ai/known_issues.md): problemas y decisiones abiertas.

## Política de actualización

- Cambios funcionales: actualizar producto, módulos o modelo conceptual según corresponda.
- Cambios estructurales: actualizar arquitectura y registrar un ADR si modifican una decisión relevante.
- Cambios de herramientas o comandos: actualizar desarrollo.
- Finalización de cualquier tarea: actualizar el snapshot y revisar problemas conocidos.
- Si dos documentos se contradicen, se debe resolver la contradicción dentro de la misma tarea que la detectó.
