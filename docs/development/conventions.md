# Convenciones de desarrollo

## Código

- Utilizar TypeScript estricto.
- Preferir nombres del dominio en inglés dentro del código y mantener su significado alineado con el glosario.
- Mantener funciones y archivos enfocados en una responsabilidad.
- Evitar abstracciones creadas para posibilidades sin un caso actual.
- Validar entradas en los límites del sistema.
- Representar errores esperables mediante tipos o excepciones de aplicación consistentes.

## Backend

- Organizar por módulo de dominio, no únicamente por tipo técnico global.
- Separar controladores, casos de uso, dominio e infraestructura.
- No exponer entidades de persistencia como contrato HTTP por defecto.
- No consultar datos operativos sin tenant context.
- Mantener transacciones en el límite del caso de uso que necesita atomicidad.
- Encapsular SDKs de proveedores externos detrás de adaptadores.

## Frontend

- Centralizar la comunicación con la API.
- Mantener las reglas de negocio autoritativas en el backend.
- Validar formularios para experiencia de usuario sin asumir que esa validación reemplaza la de la API.
- Diferenciar estados de carga, vacío, error y éxito.
- Reutilizar componentes cuando exista repetición real, no anticipada.

## API

- Mantener contratos explícitos y versionables.
- Devolver errores con una forma consistente y sin filtrar detalles internos.
- Diseñar mutaciones reintentables o idempotentes cuando interactúen con redes y proveedores.
- No introducir GraphQL mientras REST cubra los casos del producto.

## Base de datos

- Toda modificación de esquema se realiza mediante migración versionada.
- No editar manualmente producción para sustituir una migración.
- Incluir `organizationId` en entidades operativas y restricciones tenant-aware.
- Evitar punto flotante para importes.
- Nombrar índices y restricciones de forma comprensible cuando la herramienta lo permita.

## Git y revisiones

- Mantener cambios pequeños y coherentes.
- No mezclar refactors no relacionados con una funcionalidad.
- Incluir tests y documentación afectados en el mismo cambio.
- Explicar decisiones no obvias en el código o en un ADR según su alcance.
- No versionar secretos, archivos `.env` reales ni artefactos generados pesados.

## Documentación

- Escribir para personas y agentes.
- Mantener una fuente canónica por tema.
- Usar enlaces en lugar de copiar secciones completas.
- Actualizar el estado vigente; registrar historia y motivos en ADRs.
- No dejar ejemplos que ya no coincidan con los comandos o contratos reales.
