# ADR-007: Núcleo operativo de clientes, servicios y personal

- Estado: Decisiones seleccionadas de producto y técnicas cerradas; FEAT-003 B1–B10 completados con autorización del usuario. Las propuestas fuera de ese alcance conservan sus pendientes.
- Fecha: 2026-10-14.
- Contrato detallado: [TASK-09 — FEAT-003](../../tasks/TASK-09-feat-003-operational-catalog.md).
- Implementación: B1 aplicado en Neon dev mediante `20261014140000_operational_catalog`; B2 agrega permisos/helpers; B3–B6 implementan APIs de clientes, catálogo, profesionales y habilitaciones; B7–B9 integran sus pantallas; B10 verifica el flujo cruzado. Verificaciones y límites de FEAT-003 constan en TASK-09. La Agenda administrativa ahora está integrada con FEAT-004 B1–B8a; su diseño y contratos vigentes constan en ADR-008/009 y la revisión visual está pendiente.

## Contexto

FEAT-001 y FEAT-002 implementan identidad, organizaciones, membresías y suscripción. Clientes, Servicios y Profesionales consumen persistencia API desde FEAT-003. `/app/equipo` administra cuentas con acceso y no debe convertirse en el directorio de trabajadores.

Servicios/Turnero es la primera vertical funcional prevista. Comercio y Hotelería necesitan reutilizar clientes y personal básico sin heredar reglas de agenda ni un catálogo universal de entidades incompatibles. Agenda y Caja conservan demostraciones locales.

## Decisiones de producto aprobadas — 2026-10-14

- EMPLOYEE consulta clientes, servicios y profesionales y puede crear/editar clientes. No administra servicios, precios ni profesionales.
- StaffMember permanece separado de OrganizationMember; su vinculación a una cuenta Nuari es opcional y explícita, sin crear acceso automáticamente. Implementar el vínculo sigue fuera de FEAT-003.
- Preparar límites para funciones futuras opcionales por organización: registro móvil de ventas y servicios realizados, fichaje de entrada/salida y estadísticas de ventas, actividad y asistencia por empleado. Las capacidades serán configurables sin promover EMPLOYEE a ADMIN; no se construye ese sistema ahora.
- Diferenciar profesional ejecutante (StaffMember del tenant) y usuario que registra la operación (User autenticado, con contexto de membresía). No inferir uno del otro; una venta con varios servicios puede necesitar atribución por línea, a definir en su feature.
- EMPLOYEE no accede por defecto a gastos, cierres de caja ni reportes financieros generales. Habilitar una función al negocio no concede automáticamente sus permisos a cada empleado.
- Documentar ventas, asistencia y reportes como dependencias futuras; no implementar esas funciones.

Producto también cerró las siguientes decisiones:

- Notas internas de clientes visibles para OWNER/ADMIN; EMPLOYEE sin acceso por defecto a notas sensibles. En este corte todo notes es interno.
- Archivo de clientes por desactivación lógica, conservando historial. Archivo/reactivación está aprobado sólo para OWNER/ADMIN; EMPLOYEE no modifica el estado.
- Datos básicos del personal visibles e información sensible restringida a OWNER/ADMIN; contactos y vínculo a usuario quedan en la ficha administrativa.
- Duplicados advertidos por correo o teléfono del tenant, sin bloqueo automático ni fusión.
- Importes decimales exactos y sin conversión automática al cambiar moneda. Precisión y mecanismo de cambio quedan cerrados en la sección técnica siguiente.
- Selección configurable por servicio, con modos y default condicional definidos en el cierre técnico siguiente.
- Duración entera de 5 a 720 minutos inclusive.
- Clientes y Servicios conservan rutas actuales; profesionales operativos se gestionan en sección independiente de miembros. URL /app/profesionales y etiqueta Profesionales aprobadas; /app/equipo sigue para miembros con acceso.

Estas decisiones de producto están aprobadas, sin aceptar por ello todas las recomendaciones técnicas ni autorizar bloques fuera del alcance expresamente indicado. La fuente canónica está en TASK-09, secciones 1.4, 4.5, 5 y 10.

## Decisiones técnicas cerradas

- Precios de la primera vertical en Decimal(12,2), representados por strings HTTP de dos decimales. Rechazar exceso de escala antes de persistir, sin floats ni redondeo silencioso.
- No convertir moneda automáticamente. Todo cambio efectivo, incluso derivado de country, requiere confirmCurrencyChange=true. Con datos monetarios existentes se bloquea hasta una migración explícita, aunque haya confirmación; Service.price no nulo cuenta incluso si es cero o el servicio está inactivo. Sin importes, actualizar sólo metadata monetaria y versiones de servicios sin precio dentro de la transacción.
- Modos CUSTOMER_CHOICE, AUTO_ASSIGN y NO_ASSIGNMENT por servicio. Sugerir CUSTOMER_CHOICE sólo con profesionales habilitados y activos; sin ellos exigir configuración explícita. No establecer default Prisma incondicional. Como las asociaciones se crean después del servicio, el alta actual exige staffSelectionMode; una edición conserva el modo guardado.
- Modalidad inicial IN_PERSON. Remoto es una ampliación futura por migración/contrato; no habilitarlo ni ofrecerlo en FEAT-003.
- OWNER y ADMIN archivan/reactivan clientes mediante desactivación lógica. EMPLOYEE sólo consulta, crea y edita datos autorizados.
- /app/profesionales con etiqueta Profesionales; /app/equipo conserva su función de miembros con acceso. Mantener rutas de Clientes/Servicios.

## Implementación B1

- El esquema aditivo `20261014140000_operational_catalog` crea Customer, ServiceCategory, Service, StaffMember y StaffService con UUID, índices, estados, timestamps y las constraints registradas en TASK-09. Prisma 7.10 valida y genera el cliente; la migración está aplicada en Neon dev.
- Las FK compuestas de categoría-servicio y profesional-servicio incluyen `organizationId`. StaffMember mantiene `userId` opcional hacia User y no crea membresías. Esta implementación cubre el alcance B1 autorizado; no aprueba ni inicia los bloques siguientes.
- La prueba de despliegue desde cero y los casos negativos directos de constraints en DB desechable siguen pendientes.

## Implementación B2

- Se agregó una matriz exhaustiva de permisos para OWNER, ADMIN y EMPLOYEE; `business:access` conserva su política vigente y los permisos desconocidos se deniegan. El guard admite requisitos conjuntos y `TenantContext` expone sólo userId, organizationId, membershipId y role.
- `parseIfMatch` devuelve una versión positiva y segura; ausente produce 428 y formato inválido 400. La comparación con una versión persistida y el 412 por conflicto corresponden al trabajo de endpoints posterior.
- `OrganizationsService.recordOperationalAudit` expone una capacidad acotada a una transacción y metadatos permitidos con nombres de campos, sin valores PII. B2 no creó endpoints; la API de clientes de B3 consume estos mecanismos y los restantes controladores operativos deberán hacerlo también.
- La implementación sigue el contrato y la matriz aprobados en TASK-09; no aprueba capacidades configurables ni otras propuestas técnicas.

## Implementación B3

- Se implementó el módulo NestJS de clientes con listados/ficha, alta, PATCH versionado y candidatos de duplicado limitados a la organización del `TenantContext`.
- Las rutas aplican sesión, membresía, permiso y acceso comercial; notes se proyecta/escribe sólo con permiso. Las mutaciones y su auditoría transaccional no guardan valores de contacto o notas en metadata.
- B3 reutiliza el modelo Customer de B1: no agregó ni aplicó migraciones. Categorías, servicios, personal y frontend se completaron en los bloques posteriores de TASK-09.
- La implementación sigue las decisiones y el contrato ya escritos en TASK-09; no resuelve retención, piloto ni otros mecanismos pendientes.

## Implementación B4

- `ServiceCatalogModule` ofrece CRUD tenant-aware de categorías y servicios, paginación/filtros, ETag/If-Match, desactivación lógica y auditoría acotada. Exporta `ServiceCatalogService.requireService(ctx,id,tx?)` para validaciones futuras dentro del mismo tenant.
- Precios se reciben como strings decimales canónicos, se validan antes de persistir y se serializan con dos decimales; CLP no admite fracción monetaria. `Service.currency` se deriva de la organización; `Organization FOR UPDATE` protege tanto el cambio regional como alta/edición de servicios.
- El PATCH de organización incluye el campo de confirmación `confirmCurrencyChange` ya definido en TASK-09. Con cambio efectivo requiere confirmación; si existe cualquier precio persistido responde 409 aun si está en cero o el servicio inactivo. Sin precios, actualiza atómicamente moneda y versiones de servicios sin precio. No se modificó el frontend ni se creó/aplicó migración en B4.
- Las pruebas de comportamiento B4 y el estado de migraciones se registran en TASK-09. No se ejecutaron suites completas ni Playwright.

## Implementación B5–B10

- B5 implementa fichas laborales con directorio mínimo y ficha administrativa; B6 implementa habilitaciones bidireccionales con permisos conjuntos, versiones y locks Service → StaffMember. No se crean cuentas, membresías ni vínculos automáticos.
- B7–B9 conectan Clientes, Servicios y Profesionales a las APIs reales; Equipo conserva miembros con acceso. Agenda mantiene su catálogo demo local.
- B10 valida persistencia, recarga/relogin, dos tenants, permisos, revocación y vencimiento por HTTP y Playwright build/start; evidencia y límites en TASK-09. No creó ni aplicó migraciones. Revisión visual Canvas, constraints directos en DB desechable y despliegue desde cero siguen pendientes.

## Diseño técnico vigente y límites

- Mantener el monolito modular y la API como única autoridad de negocio y PostgreSQL.
- Customers, ServiceCatalog y Staff están implementados sobre los modelos persistidos en B1. Posponer Contact/Party genérico hasta que exista un caso validado.
- Staff implementa habilitaciones profesional–servicio; duración, precio y selección de profesional no pertenecen a productos ni habitaciones.
- Mantener `organizationId` en el scope explícito de todas las consultas y no depender de RLS. Las FK compuestas de categoría-servicio y profesional-servicio ya están aplicadas.
- Los modos aprobados se persisten sin herencia inicial; FEAT-003 no calcula disponibilidad ni asigna. Quitar/desactivar habilitaciones no modifica automáticamente el modo guardado.
- B4 aplica Decimal(12,2), moneda derivada de Organization y el protocolo transaccional de TASK-09. Bloquea Organization al cambiar moneda y al crear/editar servicios, de modo que fijar el primer precio concurrentemente no escape a la comprobación. Futuras ventas/pagos/caja persistidos deberán extender la detección de importes.
- Las mutaciones del catálogo aplican permisos de dominio explícitos y versiones optimistas. FEAT-003 no incorpora un sistema ACL configurable.
- El catálogo usa archivo/reactivación; futuras reservas y ventas conservarán sus propias condiciones históricas y referencias tenant-aware.

Límites, permisos, DTOs y bloques verificables están definidos en TASK-09. Notas internas, archivo lógico, privacidad del personal, duplicados, decimal exacto sin conversión, selección por servicio, duración y separación de navegación ya son decisiones de producto cerradas. Las decisiones técnicas enumeradas arriba también están cerradas; piloto/métrica/retención y features futuras mantienen sus pendientes. B1–B10 están completados; su cierre no autoriza FEAT-004 ni propuestas fuera de alcance.

## Alternativas

Contact/Party genérico se pospone porque introduce roles y abstracciones sin consumidores actuales. Un catálogo universal servicio/producto/habitación mezcla duración, stock y recursos. Microservicios y componentes distribuidos no resuelven una necesidad observada y contradicen el alcance vigente.

## Consecuencias

La primera vertical obtiene catálogo persistente sin acoplar cuentas a trabajadores ni compartir PII entre negocios. B4 incorporó la protección del cambio regional de FEAT-002 para preservar el significado de los precios. Prisma 7.10 valida las relaciones compuestas y PostgreSQL recibió las restricciones B1; las verificaciones de comportamiento están registradas en TASK-09. Faltan pruebas negativas directas de constraints en DB desechable y despliegue desde cero.

La gestión de personal usa /app/profesionales con etiqueta Profesionales. Clientes y Servicios conservan rutas; /app/equipo y su etiqueta Equipo permanecen para miembros con acceso. Agenda, ventas, inventario, comisiones y disponibilidad permanecen fuera.

## Dependencias futuras y alcance

Ventas/servicios realizados dependerán de catálogo, clientes y personal, con ejecutante separado del actor de carga y permisos operativos específicos para móvil. Asistencia dependerá de Staff, identidad cuando corresponda, sujeto/actor, marcas temporales y correcciones trazables. Reportes dependerán de fuentes operativas autorizadas, diferenciando productividad, auditoría y asistencia. Servicio realizado, venta y pago siguen siendo conceptos distintos.

La habilitación opcional por Organization será independiente de las capacidades por OrganizationMember. Acceso propio/equipo, configuración, atribución por línea, registro por terceros, métricas, privacidad y correcciones se diseñarán en esas features. No agregar ahora tablas, campos, flags, grants, endpoints o dashboards para resolverlas. Tampoco asumir sincronización offline por requerir uso móvil.

## Aprobación y evolución

Conservar los puntos aprobados sin reabrir notas, mecanismo de archivo, privacidad del personal, duplicados, decimal sin conversión, configuración por servicio, duración 5–720 ni separación de navegación. El cierre técnico incorpora Decimal(12,2), confirmación y bloqueo monetario, modos/default condicional, presencial inicial, archivo OWNER/ADMIN y ruta/etiqueta Profesionales. B1–B10 están completados según TASK-09; sus autorizaciones no convierten otras propuestas en decisiones aprobadas. [TASK-10](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md) conserva pendientes acotados de FEAT-004; personalización aprobada en [ADR-008](ADR-008-scheduling-personalization.md) y seis decisiones seleccionadas en [ADR-009](ADR-009-scheduling-core-decisions.md), sin modificar decisiones de este ADR ni iniciar implementación. Los detalles de capacidades futuras, ventas, asistencia y reportes se aprobarán en sus propias features. Actualizar tarea y ADR juntos si cambia el contrato; los ADR-001, ADR-003, ADR-005 y ADR-006 siguen vigentes.
