# TASK-01 — Guía de colaboración para agentes

## Goal

Actualizar las instrucciones compartidas para que cualquier IA, use o no OpenCode, entienda el objetivo de Nuari, el foco vigente y cómo coordinar análisis, implementación y revisión sin ampliar el alcance.

## Context

`AGENTS.md` ya define invariantes sólidas de producto, arquitectura y calidad, pero no explica el flujo de roles disponible en `.opencode/agents/` ni cómo debe actuar una IA externa. Nuari busca validar un SaaS multi-tenant para centralizar la operación de pequeños negocios mediante un único flujo vertical real; el piloto y su métrica aún deben definirse.

El nuevo prompt de coordinación aporta una síntesis útil del dominio, un roadmap por capas y requisitos concretos de autenticación. El equipo confirmó que se mantendrán Next.js y la API NestJS como desplegables independientes y que Nuari implementará autenticación propia. Estas decisiones deben quedar reflejadas en las fuentes canónicas antes de presentarlas como estado vigente para todos los agentes.

## Requirements

- Mantener `AGENTS.md` breve, neutral respecto del proveedor y válido para cualquier IA.
- Agregar una sección de orientación que enlace la visión, el MVP y el contexto operativo vigente, sin duplicar su contenido mutable.
- Explicar que el trabajo debe centrarse en el objetivo actual de `.ai/context_snapshot.md` y no anticipar módulos fuera del flujo piloto aprobado.
- Incorporar como orientación estable la simplicidad, modularidad, separación entre autenticación y autorización, desacoplamiento de proveedores y rechazo de sobrearquitectura.
- Documentar el flujo recomendado para cambios no triviales: arquitectura crea una especificación en `docs/tasks/`, implementación sigue ese contrato y revisión valida el diff contra él.
- Resumir cuándo usar los roles `architect`, `coder`, `fast` y `reviewer`, enlazando `.opencode/agents/` como configuración específica de OpenCode.
- Indicar a IAs sin esos roles que separen explícitamente planificación, implementación y revisión, respetando las mismas restricciones.
- Aclarar que instrucciones del entorno o del agente pueden restringir más el trabajo, pero no pueden relajar los invariantes del repositorio.
- Revisar las definiciones de `.opencode/agents/` y corregir únicamente contradicciones reales con el flujo compartido o la definición de terminado.
- Declarar como decisiones vigentes el uso de la API NestJS y de autenticación propia, enlazando sus fuentes canónicas sin reproducir detalles extensos en `AGENTS.md`.
- Reemplazar la referencia a Better Auth como candidato y registrar una decisión arquitectónica de autenticación propia antes de implementarla.
- Documentar en esa decisión el límite entre autenticación y autorización, el modelo mínimo, Argon2id, sesiones server-side, cookies seguras y almacenamiento exclusivo del hash del token, conforme al requisito aprobado.
- Mantener la API NestJS vigente y eliminar del material de coordinación cualquier sugerencia de volver a un monolito Next.js.
- No presentar el orden propuesto de módulos como roadmap cerrado mientras el flujo piloto continúe pendiente de selección.
- Presentar Bastardos como antecedente y posible fuente de aprendizaje, no como piloto oficialmente seleccionado salvo decisión de producto expresa.

## Architecture

- `AGENTS.md` seguirá siendo el punto de entrada estable, no la fuente canónica de producto ni un reemplazo de cada definición de rol.
- `docs/product/vision.md` y `docs/product/mvp.md` conservarán la definición del producto y su estrategia de validación.
- `.ai/context_snapshot.md` conservará el foco operativo cambiante.
- `docs/tasks/` será el contrato entre arquitectura, implementación y revisión para trabajo complejo; las tareas simples y mecánicas podrán omitirlo cuando no aporte valor.
- Las instrucciones específicas de herramientas permanecerán en `.opencode/agents/` y se referenciarán, no se copiarán completas en `AGENTS.md`.

## Affected Areas

- `AGENTS.md`
- `.opencode/agents/architect.md`
- `.opencode/agents/coder.md`
- `.opencode/agents/fast.md`
- `.opencode/agents/reviewer.md`
- `docs/README.md`, sólo si hace falta indexar `docs/tasks/` como parte del flujo documental.
- `.ai/context_snapshot.md`, al registrar la finalización de la tarea.
- `.ai/known_issues.md`, para retirar Better Auth como candidato, registrar los aspectos de autenticación propia que aún requieran diseño y conservar sólo decisiones realmente abiertas.
- `docs/product/vision.md` y `docs/product/mvp.md`, sólo para incorporar decisiones de producto que el equipo confirme expresamente; no para copiar el prompt completo.
- `docs/architecture/overview.md` y documentación relacionada con módulos y seguridad.
- `docs/architecture/decisions/`, mediante un ADR nuevo para la autenticación propia.

## Security / Invariants

- No debilitar el aislamiento por `Organization`, la validación de membresía ni la autoridad de la API sobre reglas de negocio.
- No presentar IA, WhatsApp, ecommerce completo o microservicios como alcance actual.
- No contradecir la estructura verificada `app/` + `api/`; autenticación propia es una decisión aprobada, aunque su implementación todavía no exista.
- No convertir archivos específicos de OpenCode en requisitos para colaboradores que usan otras herramientas.
- No duplicar información mutable entre `AGENTS.md`, producto y el snapshot.

## Edge Cases

- Una IA externa no dispone de los roles de `.opencode/agents/`.
- Una tarea pequeña no justifica crear un contrato formal.
- Una petición contradice el MVP, una decisión arquitectónica o una restricción de seguridad.
- Una decisión confirmada contradice documentación canónica anterior; se deben actualizar todas las referencias afectadas en el mismo cambio, sin dejar a Better Auth como alternativa vigente.
- El snapshot cambia después de actualizar `AGENTS.md`; los enlaces deben seguir siendo correctos sin reescribir el objetivo en varios lugares.

## Acceptance Criteria

- `AGENTS.md` permite a una IA nueva localizar el objetivo del producto, el foco actual y las fuentes canónicas en una primera lectura.
- El documento describe el flujo de roles y ofrece una alternativa equivalente para IAs externas.
- La responsabilidad de cada rol coincide con `.opencode/agents/` y no existen instrucciones contradictorias sobre edición, verificación o actualización documental.
- Queda explícito que el próximo desarrollo de dominio depende de elegir el piloto, el flujo y la métrica, sin inventar esa decisión.
- NestJS y autenticación propia aparecen como decisiones vigentes en las fuentes canónicas; Better Auth deja de figurar como candidato.
- Existe un ADR de autenticación propia que conserva la separación entre identidad global, membresía organizacional y permisos, sin afirmar que la funcionalidad ya está implementada.
- Los enlaces relativos mencionados existen y la documentación afectada queda actualizada sin contenido duplicado.

## Verification

- Revisar manualmente `AGENTS.md` desde la perspectiva de una IA sin acceso a OpenCode.
- Comparar sus reglas con los cuatro archivos de `.opencode/agents/` y confirmar que no haya contradicciones.
- Buscar referencias a `Better Auth`, autenticación propia y monolito Next.js, y reconciliarlas con las decisiones confirmadas.
- Comprobar los enlaces a visión, MVP, snapshot, problemas conocidos y tareas.
- Ejecutar `git diff --check`.

## Implementation

Status: IMPLEMENTED

### Changed Files

- `AGENTS.md`
- `docs/README.md`
- `docs/architecture/modules.md`
- `docs/architecture/decisions/ADR-005-custom-authentication.md`
- `.ai/context_snapshot.md`
- `.ai/known_issues.md`

### Notes

- Se agregó orientación neutral para IAs externas y referencias a los roles específicos de OpenCode.
- Se documentó autenticación propia como decisión aceptada, manteniendo NestJS y la separación entre autenticación, autorización y contexto tenant.
- No se modificaron los cuatro agentes de OpenCode porque sus instrucciones son compatibles con el flujo compartido; la tarea original continúa siendo su contrato.
- No se alteró el roadmap ni se seleccionó un piloto: ambas decisiones siguen abiertas según el MVP.

## Verification Results

- lint: PASS (no hubo cambios de código; no aplica ejecutar lint de `app/` o `api/`)
- typecheck: PASS (no hubo cambios de código; no aplica ejecutar typecheck)
- tests: PASS (no hubo cambios de código; no aplica ejecutar tests)
- enlaces documentales: PASS
- referencias obsoletas de Better Auth o monolito Next.js fuera del contrato histórico: PASS
- `git diff --check`: PASS

## Review

Status: APPROVED

### Findings

#### OPTIONAL

- `lint`, `typecheck` y `tests` figuran como `PASS` aunque no se ejecutaron. Al tratarse de cambios exclusivamente documentales no bloquea la tarea, pero en futuras tareas conviene distinguir explícitamente `NOT RUN`/`NOT APPLICABLE` de una verificación ejecutada.
