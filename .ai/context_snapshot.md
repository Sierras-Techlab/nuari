# Context snapshot

- Actualizado: 2026-10-10
- Estado del repositorio: landing y autenticación visuales; Turnero con Agenda, Servicios, Clientes, Caja y Equipo navegables en frontend; API sin identidad ni dominio
- Fase: validar los flujos del Turnero con un piloto antes de integrar identidad y datos reales

## Objetivo actual

Validar los flujos de turnos y secciones relacionadas con un negocio de servicios concreto, confirmar el registro manual a reemplazar y definir la métrica observable del primer flujo vertical.

## Estado verificable

- `app/` y `api/` son proyectos npm independientes; el frontend usa Next.js y la API usa NestJS.
- La raíz de Turbopack está fijada explícitamente en `app/next.config.ts`. Se retiró un directorio generado `app/app/.next` que ocultaba `app/src/app` y provocaba 404/PageNotFoundError en todas las rutas; el servidor de desarrollo volvió a servir Servicios, Clientes y Caja con HTTP 200.
- La landing y las rutas `/login` y `/register` están implementadas como interfaz. Los formularios no envían datos ni crean sesiones.
- `/app` presenta el módulo Turnero; `/app/agenda`, `/app/servicios`, `/app/clientes`, `/app/caja` y `/app/equipo` permiten recorrer y registrar datos locales durante la sesión. Los servicios y profesionales agregados aparecen en el formulario de turnos. Las fuentes de datos están tipadas y separadas de React; los cambios sobreviven a la navegación interna y se reinician al recargar. Los rótulos visibles de demostración se retiraron a pedido del usuario, pero no hay persistencia, acceso real ni protección por sesión.
- La API sólo expone `GET /api/health`. El esquema Prisma no tiene modelos ni migraciones de dominio.
- Existe un cliente HTTP Axios y una integración inicial de Prisma con PostgreSQL, pero no se verificó una conexión real a Neon.
- El 2026-10-10 pasaron lint, typecheck, 44 pruebas y build web; el build incluye las nueve rutas públicas e internas. Se abrieron las nueve rutas en el navegador sin 404 ni errores de página. La API conserva la última verificación del 2026-10-06: 11 pruebas unitarias y la prueba HTTP end-to-end de `health`.
- Los hallazgos pendientes están en [`.ai/known_issues.md`](known_issues.md).

## Decisiones vigentes

- `Organization` es el límite de tenant; las operaciones requieren membresía y autorización verificadas por la API.
- Frontend y API son desplegables separados; la API es la única capa con acceso directo a PostgreSQL.
- La comunicación inicial web/API será REST mediante Axios.
- El backend es un monolito modular NestJS con autenticación propia según [`ADR-005`](../docs/architecture/decisions/ADR-005-custom-authentication.md).
- Prisma permanece en la versión mayor 7 hasta evaluar explícitamente otra versión mayor.

## Próxima tarea

1. Revisar las rutas de [`TASK-04`](../docs/tasks/TASK-04-turnero-workspace-front.md) con un negocio de servicios concreto; observar su registro manual actual.
2. Fijar usuario, inicio, fin, datos mínimos, reglas reales de disponibilidad y métrica de validación. Decidir qué capacidades compartidas necesita el primer corte.
3. Diseñar en `docs/tasks/` la siguiente fase: login/registro reales, organización y membresía, persistencia y API tenant-aware de turnos; implementar sólo el corte aprobado.

## Contexto para la próxima tarea

- [`docs/product/mvp.md`](../docs/product/mvp.md)
- [`docs/product/glossary.md`](../docs/product/glossary.md)
- [`docs/architecture/modules.md`](../docs/architecture/modules.md)
- [`docs/architecture/data-model.md`](../docs/architecture/data-model.md)
- [`docs/architecture/multi-tenancy.md`](../docs/architecture/multi-tenancy.md)
- [`.ai/known_issues.md`](known_issues.md)
- [`TASK-02`](../docs/tasks/TASK-02-frontend-appointments-demo.md)
- [`TASK-03`](../docs/tasks/TASK-03-turnero-visual-identity.md)
- [`TASK-04`](../docs/tasks/TASK-04-turnero-workspace-front.md)
