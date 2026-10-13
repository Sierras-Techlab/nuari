# Módulos

## Principio

Cada módulo debe tener una responsabilidad clara, una interfaz pública y dependencias explícitas. Que dos módulos vivan en el mismo proceso no autoriza accesos arbitrarios entre sus tablas o implementaciones.

## Núcleo

### Organizations

Responsable de organizaciones, configuración básica y ciclo de vida del tenant.

Posee `OrganizationMember`, roles por organización y resolución del tenant context. Depende de capacidades públicas de Identity para identificar al usuario y asociar membresías, sin apropiarse de la autenticación. Coordina la creación inicial de organización, propietario y suscripción mediante interfaces públicas y una transacción común.

### Identity and Access

Responsable de usuarios, credenciales, sesiones, tokens de verificación/recuperación y autenticación. Expone identidad y capacidades de sesión; no asigna organización ni rol global. La membresía y su rol son propiedad de Organizations, en línea con ADR-005.

Nuari implementa autenticación propia en NestJS conforme a [`ADR-005`](decisions/ADR-005-custom-authentication.md). La implementación actual de identidad, organizaciones y suscripciones sigue en validación y no equivale a una feature lista para publicación.

### Staff

Responsable de integrantes operativos del negocio y su posible vínculo con usuarios autenticables.

### Customers

Responsable de los clientes propios de cada organización, sus datos de contacto y su historial accesible mediante interfaces autorizadas.

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

Responsable de agenda, reservas, estados, cancelaciones y asociación opcional con una venta.

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
