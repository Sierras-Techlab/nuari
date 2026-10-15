# Módulos

## Principio

Cada módulo debe tener una responsabilidad clara, una interfaz pública y dependencias explícitas. Que dos módulos vivan en el mismo proceso no autoriza accesos arbitrarios entre sus tablas o implementaciones.

## Núcleo

### Organizations

Responsable de organizaciones, configuración básica y ciclo de vida del tenant.

Posee `OrganizationMember`, roles por organización y resolución del tenant context. Depende de capacidades públicas de Identity para identificar al usuario y asociar membresías, sin apropiarse de la autenticación. Coordina la creación inicial de organización, propietario y suscripción mediante interfaces públicas y una transacción común.

### Identity and Access

Responsable de usuarios, credenciales, sesiones, tokens de verificación/recuperación y autenticación. Expone identidad y capacidades de sesión; no asigna organización ni rol global. La membresía y su rol son propiedad de Organizations, en línea con ADR-005.

Nuari implementa autenticación propia en NestJS conforme a [`ADR-005`](decisions/ADR-005-custom-authentication.md). FEAT-001 y FEAT-002 están cerradas tras validación manual de sus flujos principales; las limitaciones de correo y staging siguen documentadas en el snapshot y los problemas conocidos. FEAT-003 B1–B10 implementaron el esquema inicial, permisos base, APIs tenant-aware de clientes/categorías/servicios/personal, habilitaciones profesional–servicio y las pantallas persistentes de Clientes, Servicios y Profesionales, según TASK-09. La Agenda administrativa está integrada con FEAT-004; Caja conserva su demostración local.

### Staff

Responsable de las fichas laborales del negocio y las habilitaciones de los servicios que puede prestar cada profesional. `StaffMember` es distinto de `OrganizationMember`; su vínculo `userId` nullable es sólo una referencia opcional a una identidad global y no crea cuenta, sesión ni membresía. `StaffModule` entrega directorio básico y ficha administrativa con permisos diferenciados; cambios de habilitaciones coordinan Staff y ServiceCatalog mediante interfaces explícitas, transacción y tenant context.

### Customers

Responsable de los clientes propios de cada organización, sus datos de contacto y su historial accesible mediante interfaces autorizadas.

El módulo NestJS `CustomersModule` implementa listado paginado, ficha, alta, edición versionada y candidatos no bloqueantes; aplica tenant, permisos y acceso comercial, y proyecta notes según rol. No exporta consultas globales por contacto.

### ServiceCatalogModule API

El módulo NestJS `ServiceCatalogModule` administra categorías y servicios con tenant context, filtros/paginación, precios exactos, ETag/If-Match, archivo lógico y auditoría acotada. `ServiceCatalogService.requireService(ctx,id,tx?)` ofrece una consulta pública tenant-aware para módulos que necesiten validar el servicio. La coordinación de moneda permanece en Organizations: ambos casos de uso bloquean Organization y comparten la misma transacción, sin dependencia circular.

### Sales

Responsable de ventas y líneas de venta, independientemente de si se originan en una operación manual, un turno o un pedido.

### Payments

Responsable de pagos, estados, métodos, referencias externas y conciliación. Debe soportar múltiples pagos para una venta y procesamiento idempotente de confirmaciones externas.

### Expenses

Responsable de egresos operativos registrados por la organización.

### Reporting

Responsable de consultas y proyecciones derivadas. Inicialmente leerá datos del sistema sin convertirse en una fuente de verdad paralela.

## Servicios

### Service Catalog

Responsable de servicios ofrecidos, duración y configuración comercial.

### Professionals and Availability

Responsable de profesionales, reglas de disponibilidad y excepciones.

### Appointments

Responsable de agenda, reservas, estados, cancelaciones y asociación opcional con una venta. La pantalla `/app/agenda` consume los endpoints existentes de appointments/availability y catálogos; `GET /organizations/:id/scheduling/calendars` devuelve horarios, excepciones y ausencias del tenant para dibujar el calendario.

FEAT-004 B1–B7 están implementados: el esquema está aplicado en Neon `Feat10` aislado; `TimeZoneAdapter` concentra conversión IANA/DST y política de tiempo; `AvailabilityModule` ofrece configuración, calendarios y disponibilidad privada/pública para SPECIFIC/ANY/NONE. `AppointmentsModule` crea citas internas con cliente activo y ciclo de vida versionado: cancelación, cierre administrativo, corrección auditada e reprogramación transaccional. La asignación ANY se coordina por organización/día local, cuenta CONFIRMED/COMPLETED y desempata por UUID. `PublicBookingModule` publica sólo catálogo opt-in y disponibilidad pública con política vigente; crea Guest Customer y Appointment atómicamente; gestiona, cancela y reprograma una única reserva con bearer HMAC revocable persistido como hash. CSRF, rate limits y proyecciones acotadas se aplican también al público. `SchedulingReadModule` sólo depende de DatabaseModule, proyecta intervalos y bloquea cambios de zona mientras haya reservas futuras/en curso o reglas locales definidas. [ADR-008](decisions/ADR-008-scheduling-personalization.md) y [ADR-009](decisions/ADR-009-scheduling-core-decisions.md) registran las reglas aprobadas. Duración pertenece a Service y determina ocupación; intervalo sólo genera candidatos. Cambiar configuración no modifica reservas confirmadas ni sus condiciones de cancelación. El detalle contractual de los bloques está en [TASK-10](../tasks/TASK-10-feat-004-scheduling-availability-appointments.md).

Las reglas de dominio y precisiones de TASK-10 sección 1.6 están aprobadas. B3 habilita lectura de configuración a roles con acceso al negocio y gestión de settings/calendarios sólo OWNER/ADMIN; `SchedulingRead` consulta ocupaciones sin importar Appointments. Calendar/Availability calcula slots UTC sobre calendarios locales, duración real y capacidad tenant-aware. B5 crea CONFIRMED y su evento CREATED atómicamente. B6 implementa historial y transiciones controladas; B7 implementa las capacidades públicas. B8a integra Agenda diaria/semanal con reservas, disponibilidad y calendarios reales, y espera revisión; B8b/B9 siguen pendientes.

### Commissions

Responsable de reglas y resultados de comisiones. Se incorporará cuando el flujo seleccionado lo necesite.

## Comercio

### Catalog

Responsable de productos, variantes, precios y publicación.

### Inventory

Responsable de existencias y movimientos de inventario.

### Orders

Responsable de pedidos y su ciclo de vida previo a una venta o cancelación.

### Storefront

Responsable de catálogo público, carrito y checkout. No forma parte automática del primer MVP.

## Integrations

Encapsula adaptadores para proveedores externos como Mercado Pago, Resend y Cloudflare R2. Identity consume el puerto de correo definido por Nuari; el adaptador Resend sólo entrega mensajes y no valida credenciales ni tokens. Los módulos de negocio no deben depender directamente de SDKs externos; deben depender de capacidades definidas por Nuari.

## Reglas de dependencia

- Los controladores llaman casos de uso, no implementaciones de persistencia directamente.
- Los módulos no exportan repositorios como atajo para que otros consulten sus tablas.
- Las operaciones que cruzan módulos se coordinan mediante casos de uso explícitos y, cuando corresponda, eventos internos.
- No se incorpora mensajería distribuida mientras la comunicación en proceso y las transacciones locales sean suficientes.
- Un reporte puede consultar proyecciones autorizadas, pero no modificar el dominio que observa.
