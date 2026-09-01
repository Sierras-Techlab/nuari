# Nuari — instrucciones para agentes

## Propósito

Este archivo contiene reglas estables para trabajar en Nuari. Debe mantenerse breve. No reemplaza la documentación de producto o arquitectura: dirige al agente hacia la fuente correcta según la tarea.

## Lectura inicial

Antes de modificar archivos:

1. Leer [`.ai/context_snapshot.md`](.ai/context_snapshot.md).
2. Leer sólo los documentos de `docs/` relacionados con la tarea.
3. Consultar [`docs/README.md`](docs/README.md) cuando no esté claro dónde vive una decisión.
4. Revisar [`.ai/known_issues.md`](.ai/known_issues.md) si la tarea toca una decisión todavía abierta.

No cargar toda la documentación por defecto. Obtener contexto de manera progresiva y bajo demanda.

## Reglas de producto no negociables

- `Organization` es el límite de tenant.
- Toda información operativa pertenece a una organización.
- Nunca confiar en un `organizationId` enviado por el cliente sin validar la membresía del usuario.
- Turno, pedido, venta y pago son conceptos diferentes.
- Un turno puede existir sin venta; un pedido puede existir sin pago; una venta puede existir sin turno ni pedido; una venta puede tener uno o varios pagos.
- La IA y WhatsApp serán capas futuras de automatización. No son requisitos para que el producto principal funcione.
- Una futura IA no tendrá acceso libre a la base: utilizará operaciones explícitas y autorizadas de Nuari.

## Reglas de arquitectura

- Mantener un monolito modular en la API hasta que exista una razón observable para extraer un servicio.
- La lógica de negocio vive en la API NestJS, no en componentes React ni en el cliente HTTP.
- Los módulos se comunican mediante interfaces públicas; no deben acceder arbitrariamente a los detalles internos de otro módulo.
- Mantener frontend, API y procesos asíncronos como límites desplegables separados cuando corresponda.
- Mantener las consultas tenant-aware y probar el aislamiento entre organizaciones.
- No agregar una dependencia de producción sin justificar su necesidad, mantenimiento y efecto sobre el stack.
- No incorporar una decisión arquitectónica importante sin registrarla o actualizarla en `docs/architecture/decisions/`.

## Documentación viva y definición de terminado

Una tarea no está terminada si deja documentación relevante desactualizada.

Al finalizar cada tarea:

1. Actualizar los documentos afectados por cambios de comportamiento, arquitectura, modelo de datos, configuración, comandos o decisiones.
2. Actualizar [`.ai/context_snapshot.md`](.ai/context_snapshot.md) con lo completado, el estado verificable y el siguiente paso.
3. Actualizar [`.ai/known_issues.md`](.ai/known_issues.md) cuando se resuelva, descubra o cambie un problema o una decisión pendiente.
4. Evitar duplicar información: enlazar la fuente canónica cuando el detalle ya exista en otro documento.
5. Eliminar instrucciones obsoletas en lugar de acumular contradicciones.
6. Incluir los cambios documentales en la misma revisión o commit que el cambio que describen.

Los documentos estables describen el estado vigente, no una cronología. Las decisiones y sus motivos históricos viven en ADRs. El snapshot describe solamente el estado operativo actual.

## Calidad y verificación

- Trabajar con TypeScript estricto.
- Validar datos en los límites de entrada.
- Agregar o modificar tests junto con el comportamiento.
- Ejecutar los tests relevantes, typecheck y lint antes de afirmar que una tarea está completa.
- Para cambios visibles al usuario, ejecutar las pruebas end-to-end relacionadas cuando existan.
- No afirmar que una verificación pasó sin haber ejecutado el comando correspondiente.

Los comandos concretos y vigentes se documentan en [`docs/development/setup.md`](docs/development/setup.md) y [`docs/development/testing.md`](docs/development/testing.md).
