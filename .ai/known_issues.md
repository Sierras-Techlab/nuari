# Problemas conocidos y decisiones abiertas

- Actualizado: 2026-08-31

## Decisiones de producto abiertas

### Negocio piloto del MVP

Todavía no se seleccionó si el primer flujo real estará dirigido a una barbería/estética, un comercio de productos u otro negocio. Esta decisión debe tomarse antes de diseñar el primer módulo funcional de dominio.

### Flujo y métrica de validación

El objetivo general es reemplazar un registro manual o Excel, pero todavía no se definieron el flujo exacto, el período de prueba ni la métrica cuantitativa de éxito.

## Decisiones técnicas abiertas

### Credenciales y ambiente Neon

La configuración pooled/direct y la generación del cliente fueron verificadas, pero todavía no se proporcionó un proyecto Neon ni credenciales. Falta validar una conexión real, la región elegida y el primer flujo de migración antes de crear modelos de dominio.

### Advisory de Prisma CLI

El lockfile de `api/` reporta 3 vulnerabilidades altas a través de `prisma -> @prisma/config -> deepmerge-ts`. Afectan tooling/configuración y npm sólo propone bajar a Prisma 6.12 como corrección automática, incompatible con la decisión vigente de Prisma 7. El árbol productivo excluyendo desarrollo y peers opcionales devuelve 0 vulnerabilidades con `npm audit --omit=dev --omit=optional`.

Revisar este advisory al actualizar Prisma. No usar `npm audit fix --force` sin evaluar la migración de versión mayor.

### Runtime de la API

Se acordó desplegar NestJS como proceso o contenedor, pero no se eligió entre VPS y plataforma administrada.

### Autenticación

Better Auth es el candidato actual. Falta validar el modelo de integración con NestJS, sesiones, cookies entre dominios y membresías multi-organización antes de adoptarlo.

### Política monetaria y temporal

Antes de implementar ventas o pagos se debe decidir precisión de importes, estrategia de redondeo, moneda y manejo de zona horaria de la organización.

### Row-Level Security

RLS queda pospuesto hasta validar su interacción con Prisma, pooling y roles de PostgreSQL. La primera implementación no puede depender de RLS para corregir consultas sin tenant context.

## Herramientas pospuestas

### Graphify

No se instaló durante la inicialización. Se evaluará cuando el tamaño y las dependencias hagan repetitiva la exploración. Sus artefactos generados no serán fuente canónica.

### Prisma 8

La base utiliza Prisma 7. La siguiente versión mayor se evaluará por separado después de estabilizar el primer flujo con generación, adaptador PostgreSQL y migraciones.

## Riesgos a vigilar

- Documentación que no se actualice junto con el código.
- Reglas de negocio duplicadas entre frontend y API.
- Filtrado multi-tenant aplicado de manera inconsistente.
- Incorporación prematura de módulos fuera del flujo piloto.
- Dependencias externas añadidas antes de contar con un caso de uso aprobado.
