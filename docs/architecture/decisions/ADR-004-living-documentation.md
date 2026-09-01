# ADR-004: Documentación viva como parte de la definición de terminado

- Estado: Aceptada
- Fecha: 2026-08-27

## Contexto

Nuari será desarrollado por personas con asistencia intensiva de agentes de código. Tanto los desarrolladores como los agentes necesitan comprender el producto, sus decisiones y el estado actual sin reconstruir todo el contexto desde el código o conversaciones anteriores.

La documentación desactualizada es más dañina que la ausencia de documentación porque genera decisiones basadas en premisas falsas.

## Decisión

Mantener documentación versionada de producto, arquitectura y desarrollo. Cada tarea deberá actualizar, en el mismo cambio, los documentos que hayan quedado afectados.

`AGENTS.md` será un archivo breve de reglas y navegación. Los documentos detallados se leerán bajo demanda. `.ai/context_snapshot.md` mantendrá el estado operativo actual y `.ai/known_issues.md` registrará problemas y decisiones abiertas.

## Motivos

- Mejora la incorporación y colaboración de personas.
- Reduce exploración repetida por parte de agentes.
- Hace explícitas las decisiones y sus motivos.
- Facilita detectar contradicciones entre intención, código y operación.

## Consecuencias

- Las tareas incluyen tiempo de mantenimiento documental.
- Una revisión debe considerar desactualización de documentación como defecto.
- Se debe evitar duplicar detalles para no multiplicar fuentes contradictorias.
- Los snapshots deben ser breves y actualizarse al cerrar una tarea.
- Los ADRs conservan la historia de decisiones; los documentos normales muestran el estado vigente.

## Graphify

Graphify no será una dependencia inicial. Podrá evaluarse cuando el repositorio alcance una complejidad en la que un grafo consultable reduzca exploración repetida.

Si se adopta, sus resultados serán artefactos derivados y no reemplazarán código, tests, documentación ni ADRs como fuentes canónicas.
