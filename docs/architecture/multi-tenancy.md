# Multi-tenancy

## Modelo

Nuari utilizará una sola plataforma y una base PostgreSQL compartida para múltiples organizaciones. No se creará una base independiente por cliente durante la etapa inicial.

`Organization` es el límite de aislamiento. Toda operación debe ejecutarse dentro de un tenant context autorizado.

## Resolución del contexto

Una petición autenticada identifica a un usuario. Para operar sobre una organización, la API debe resolver una membresía activa y construir un contexto que incluya, al menos:

- `userId`.
- `organizationId`.
- `membershipId`.
- Rol o permisos efectivos.

Un `organizationId` enviado por ruta, cabecera o body sólo selecciona una organización candidata. Nunca prueba que el usuario pueda acceder a ella.

## Persistencia

- Toda tabla operativa incluye `organizationId` no nulo cuando el concepto pertenece a un tenant.
- Los repositorios y casos de uso reciben el tenant context de forma explícita.
- Las consultas por identificador también filtran por organización.
- Las restricciones únicas de negocio incluyen la organización cuando la unicidad no es global.
- Las relaciones deben evitar referencias cruzadas entre tenants, utilizando restricciones compuestas cuando sea práctico.

## Autorización

El aislamiento de datos y la autorización funcional son controles distintos:

- Aislamiento: impide leer o modificar datos de otra organización.
- Autorización: determina qué acciones puede ejecutar el miembro dentro de su organización.

Ambos deben verificarse. Conocer el identificador de un registro no concede acceso.

## Row-Level Security

PostgreSQL Row-Level Security podrá agregarse como defensa en profundidad después de validar su interacción con Prisma, pooling, migraciones y tareas administrativas.

RLS no reemplazará los filtros tenant-aware ni las verificaciones de membresía de la aplicación. Si se adopta, deberá contar con pruebas que demuestren su comportamiento usando los mismos roles y conexiones que producción.

## Pruebas obligatorias

Para cada módulo tenant-aware se deben cubrir casos como:

- Miembro autorizado accede a un registro de su organización.
- Usuario autenticado sin membresía recibe rechazo.
- Miembro de una organización no puede leer un identificador perteneciente a otra.
- Una escritura no puede relacionar entidades de organizaciones diferentes.
- Una búsqueda, reporte o exportación no mezcla tenants.

## Operaciones globales

Las operaciones de soporte o administración global requieren un camino explícito, auditable y separado de las operaciones normales. No se implementarán mediante la omisión accidental del filtro de organización.
