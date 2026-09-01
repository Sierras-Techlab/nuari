# ADR-002: PostgreSQL administrado en Neon

- Estado: Aceptada para la etapa inicial
- Fecha: 2026-08-27

## Contexto

Nuari necesita una base relacional que soporte integridad, transacciones y multi-tenancy. Se evaluó autohospedar PostgreSQL en un VPS frente a utilizar PostgreSQL administrado.

El equipo quiere mantener control sobre el modelo y evitar depender de una base propietaria, pero también debe minimizar la carga operativa de backups, actualizaciones y recuperación.

## Decisión

Utilizar PostgreSQL administrado en Neon, región São Paulo.

La aplicación utilizará conexión pooled para tráfico normal y conexión directa para migraciones y tareas administrativas. El acceso se implementa exclusivamente desde la API NestJS mediante Prisma.

La base técnica fija Prisma en la versión mayor 7. Una actualización a una nueva versión mayor deberá tratarse como una decisión explícita y verificarse contra el flujo de schema, generación, migraciones y el adaptador PostgreSQL.

## Motivos

- Continúa siendo PostgreSQL y conserva una ruta estándar de exportación y migración.
- Reduce la operación manual de la base durante el MVP.
- Ofrece una región próxima al mercado argentino.
- Proporciona pooling compatible con despliegues de distinta naturaleza.
- Permite separar ambientes mediante proyectos o branches.

## Consecuencias

- Se depende operativamente de Neon, aunque el formato de datos siga siendo PostgreSQL.
- Deben administrarse correctamente conexiones pooled y directas.
- `DATABASE_URL` queda reservada para el runtime pooled y `DIRECT_URL` para Prisma CLI y migraciones.
- El cliente generado no es código fuente canónico: se regenera durante instalación o build.
- El plan gratuito puede utilizarse durante desarrollo, pero no se asumirá adecuado para datos productivos sin revisar límites, restauración y soporte.
- Se mantendrá al menos una estrategia adicional de exportación lógica y restauración probada.

## Alternativas descartadas

### PostgreSQL en el VPS de la API

Reduce proveedores, pero concentra fallas y traslada al equipo backups, restauración, parches, monitoreo y capacidad.

### Supabase

Incluye capacidades valiosas, pero auth, storage y APIs se superponen con componentes ya previstos. Además, la arquitectura elegida utiliza NestJS como dueño de la lógica y acceso a datos.

### AWS RDS

Es una alternativa válida para una etapa con requisitos operativos más exigentes, pero introduce mayor costo y configuración inicial que la necesaria para validar.
