# Glosario de dominio

El propósito de este glosario es evitar que nombres parecidos representen conceptos diferentes en producto, código y base de datos.

## Organization

Negocio o cuenta operativa dentro de Nuari. Es el límite de tenant y propietario lógico de la información operativa.

## User

Identidad autenticable de una persona. Un usuario puede pertenecer a más de una organización.

## Membership

Relación entre un usuario y una organización. Define el estado y rol del usuario dentro de esa organización.

## Staff member

Persona que trabaja para una organización. Puede estar vinculada a un usuario autenticable, pero ambos conceptos no son necesariamente equivalentes.

## Customer

Cliente administrado por una organización. Dos organizaciones pueden registrar a la misma persona sin compartir su información operativa.

## Service

Prestación ofrecida por una organización, con sus reglas comerciales y operativas.

## Availability

Reglas y excepciones que determinan cuándo un profesional o recurso puede recibir turnos. No es una lista inventada de horarios libres: la disponibilidad resultante debe calcularse considerando agenda y restricciones reales.

## Appointment

Reserva de tiempo para prestar uno o más servicios. Puede cancelarse o completarse sin que eso lo convierta automáticamente en una venta.

## Product

Bien comercial ofrecido por una organización.

## Variant

Versión vendible de un producto, por ejemplo una combinación de tamaño y color. Es normalmente la unidad sobre la que se controla precio o inventario.

## Inventory

Estado y movimientos de existencias de una variante. No debe reducirse a un número sin trazabilidad cuando se implemente el módulo completo.

## Order

Intención o solicitud de compra. Puede existir antes de ser pagada, cancelarse o convertirse posteriormente en una venta según las reglas aprobadas.

## Sale

Hecho comercial que registra bienes o servicios vendidos por una organización. Puede originarse manualmente, en un turno o en un pedido, pero existe como concepto independiente.

## Payment

Movimiento de dinero recibido o registrado contra una obligación comercial. Una venta puede tener cero, uno o varios pagos. El estado de una operación externa debe confirmarse por una fuente confiable, como un webhook del proveedor.

## Deposit

Pago anticipado asociado al objetivo de reservar o garantizar una operación. No reemplaza el turno, pedido, venta o pago: representa un uso específico de un pago.

## Expense

Egreso registrado por una organización para representar costos operativos.

## Commission

Importe o regla de liquidación atribuible a un miembro del equipo por una operación. No equivale al pago del cliente.

## Report

Vista derivada de datos operativos. No debe convertirse en una fuente de datos independiente salvo que exista una decisión técnica explícita de materialización.

## Tenant context

Contexto autorizado que identifica la organización activa y la membresía usada para ejecutar una operación.
