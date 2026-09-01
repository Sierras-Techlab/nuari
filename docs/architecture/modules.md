# Módulos

## Principio

Cada módulo debe tener una responsabilidad clara, una interfaz pública y dependencias explícitas. Que dos módulos vivan en el mismo proceso no autoriza accesos arbitrarios entre sus tablas o implementaciones.

## Núcleo

### Organizations

Responsable de organizaciones, configuración básica y ciclo de vida del tenant.

Depende de identidad para asociar membresías, sin apropiarse de la autenticación.

### Identity and Access

Responsable de usuarios, sesiones, membresías, roles y autorización.

Nuari implementará autenticación propia en NestJS. La decisión, sus límites y sus requisitos de seguridad están documentados en [`ADR-005`](decisions/ADR-005-custom-authentication.md); esta funcionalidad todavía no está implementada.

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

Encapsula adaptadores para proveedores externos como Mercado Pago, Resend y Cloudflare R2. Los módulos de negocio no deben depender directamente de SDKs externos; deben depender de capacidades definidas por Nuari.

## Reglas de dependencia

- Los controladores llaman casos de uso, no implementaciones de persistencia directamente.
- Los módulos no exportan repositorios como atajo para que otros consulten sus tablas.
- Las operaciones que cruzan módulos se coordinan mediante casos de uso explícitos y, cuando corresponda, eventos internos.
- No se incorpora mensajería distribuida mientras la comunicación en proceso y las transacciones locales sean suficientes.
- Un reporte puede consultar proyecciones autorizadas, pero no modificar el dominio que observa.
