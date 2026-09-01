# ADR-003: Base compartida con aislamiento por organización

- Estado: Aceptada
- Fecha: 2026-08-27

## Contexto

Nuari alojará múltiples negocios. Se necesita impedir que una organización acceda a información de otra sin crear y operar una base independiente por cliente.

## Decisión

Utilizar una base PostgreSQL compartida. Las entidades operativas tendrán `organizationId` y todas las operaciones se ejecutarán con un tenant context derivado de una membresía autorizada.

Las restricciones, índices, consultas y pruebas serán tenant-aware. PostgreSQL Row-Level Security podrá agregarse más adelante como defensa en profundidad, no como sustituto de la autorización de aplicación.

## Motivos

- Simplifica migraciones y operación durante la etapa inicial.
- Permite transacciones entre módulos de una misma organización.
- Evita multiplicar infraestructura por cliente.
- Es suficiente para el mercado inicial si se implementan controles consistentes.

## Consecuencias

- Omitir un filtro de tenant es un riesgo de seguridad crítico.
- Los repositorios y casos de uso deben requerir contexto de organización.
- Las restricciones únicas normalmente incorporan `organizationId`.
- Las pruebas de aislamiento son obligatorias en cada módulo.
- Las herramientas de soporte global necesitan caminos explícitos y auditables.

## Alternativas descartadas

### Una base por organización

Ofrece aislamiento físico mayor, pero complica onboarding, migraciones, reportes globales, conexiones y operación sin una necesidad actual que lo justifique.

### Un schema PostgreSQL por organización

Reduce parte del riesgo de filas mezcladas, pero mantiene complejidad de migraciones y resolución dinámica sin aportar suficiente valor durante el MVP.
