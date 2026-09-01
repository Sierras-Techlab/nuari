# Visión de producto

## Problema

Muchos pequeños comercios y negocios de servicios argentinos administran clientes, agenda, ventas, pagos, gastos, stock y pedidos mediante una combinación de WhatsApp, Excel, agendas, Mercado Pago y registros manuales.

La fragmentación produce información duplicada, poca trazabilidad, errores operativos y dificultad para entender el estado real del negocio.

## Propuesta

Nuari será un SaaS por suscripción que centralice la operación diaria de estos negocios en una plataforma modular. Cada negocio tendrá una organización y habilitará las capacidades que necesita.

Nuari no se define únicamente como turnero ni como ecommerce. Su núcleo es una plataforma de gestión que puede combinar servicios y comercio.

## Usuarios objetivo iniciales

- Pequeños negocios de servicios, como barberías y centros de estética.
- Pequeños comercios que necesitan productos, stock y pedidos.
- Negocios híbridos que prestan servicios y venden productos.

El primer tipo de negocio piloto todavía debe seleccionarse antes de cerrar el alcance funcional del MVP.

## Capacidades del producto

### Núcleo común

- Organizaciones.
- Usuarios, membresías y equipo.
- Clientes.
- Ventas.
- Pagos.
- Gastos.
- Reportes.

### Servicios

- Servicios ofrecidos.
- Profesionales.
- Disponibilidad.
- Agenda y turnos.
- Comisiones.
- Señas, cuando formen parte del alcance aprobado.

### Comercio

- Productos y variantes.
- Inventario.
- Pedidos.
- Catálogo público.
- Carrito y checkout.
- Ecommerce sencillo.

## Integraciones

Mercado Pago permitirá cobrar, entre otros casos futuros, señas de servicios y pedidos de comercio. Nuari no considerará confirmado un pago únicamente por una respuesta del navegador: los webhooks del proveedor confirmarán el estado real de la operación mediante procesamiento idempotente.

Cloudflare R2 y Resend forman parte del stack propuesto para archivos y correo respectivamente, cuando una funcionalidad aprobada los necesite.

## Automatización futura

WhatsApp e IA serán una capa posterior sobre las operaciones existentes. La IA no inventará disponibilidad, precios ni stock y no consultará libremente la base de datos. Ejecutará herramientas explícitas de Nuari que apliquen las mismas reglas de autorización y negocio que cualquier otro cliente.

El producto debe ser completamente utilizable sin WhatsApp ni IA.

## Principios

- Validar el problema antes de ampliar el alcance.
- Priorizar trazabilidad y corrección operativa.
- Mantener separados los conceptos del dominio aunque compartan un flujo de usuario.
- Permitir que una organización utilice Servicios, Comercio o ambos.
- Diseñar el aislamiento multi-tenant desde el comienzo.
