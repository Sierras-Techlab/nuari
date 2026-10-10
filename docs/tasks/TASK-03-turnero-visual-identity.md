# TASK-03 — Identidad visual del módulo Turnero

## Objetivo

Hacer que la interfaz de turnos se reconozca como el módulo genérico **Turnero** de Nuari y comparta el lenguaje visual de la landing. El ajuste no define aún el alcance funcional del piloto ni implementa otros módulos.

## Alcance

- Refinar sidebar, cabecera interna, portada de `/app` y agenda `/app/agenda` con la paleta grafito, marfil y acentos suaves de la landing.
- Agrupar visualmente la navegación bajo el módulo activo Turnero y señalar la ruta actual.
- Eliminar iconos y textos que vinculan la interfaz exclusivamente con barberías.
- Usar servicios de ejemplo genéricos sin cambiar el contrato `AppointmentSource` ni las operaciones de la demo.
- Mantener una navegación móvil clara y accesible.
- Documentar una propuesta de capacidades del turnero, distinguiendo agenda, disponibilidad, clientes, caja y administración de usuarios. Los módulos futuros tendrán navegación y flujos propios.

## Límites

- Sin cambios en `api/`, autenticación, persistencia ni lógica monetaria.
- Sin pantallas operativas nuevas para caja, clientes o administración hasta validar su flujo y límites con el piloto.
- Los servicios y nombres de demostración no fijan el catálogo de ningún negocio.

## Criterios de aceptación

1. La sidebar muestra Nuari, el módulo Turnero y enlaces funcionales a Inicio y Agenda con estado activo distinguible.
2. La interfaz en móvil mantiene acceso a las mismas rutas.
3. Ninguna vista del módulo usa tijeras, barba o barbería como identidad visual o texto principal.
4. Agenda y portada conservan el recorrido demostrativo existente y sus estados.
5. Tests relevantes, lint, typecheck y build web pasan; revisión visual móvil y escritorio.

## Propuesta funcional para validar

- **Agenda y turnos:** registrar, consultar, reprogramar, cancelar y distinguir asistencia o ausencia cuando el piloto confirme esos estados.
- **Disponibilidad:** horarios por profesional, pausas, feriados y excepciones. Es la siguiente capacidad más necesaria para que la agenda deje de depender de horarios supuestos.
- **Clientes:** ficha mínima, contacto, observaciones e historial de turnos autorizado. Es una capacidad compartida de Nuari, aunque el Turnero la use intensivamente.
- **Servicios y equipo operativo:** catálogo, duración y profesionales asignados. Un profesional no equivale necesariamente a un usuario con acceso.
- **Caja:** apertura/cierre y movimientos, vinculados cuando corresponda con ventas y pagos, sin confundir turno con venta ni pago. Pertenece al núcleo compartido y requiere reglas monetarias y de permisos propias.
- **Usuarios y permisos:** invitaciones, membresías y roles para administradores. Pertenece a identidad y acceso, y siempre requiere validación en backend.
- **Lista de espera:** candidata para una fase posterior, sólo si el piloto tiene demanda de huecos liberados o reprogramaciones frecuentes.

La hotelería o reservas por recursos es un módulo futuro distinto: puede reutilizar identidad, clientes y caja, pero necesita calendario, disponibilidad, unidades y ciclo de reserva propios. No se modelará como un turno con otro nombre.

## Implementación

Status: IMPLEMENTED

- Sidebar, cabecera, portada y agenda actualizadas con la paleta de la landing.
- Estado activo en navegación de escritorio y móvil.
- Servicios ficticios renombrados a breve, estándar y extendido; iconos de tijeras retirados.

## Verificación

Status: PASS

- `app/: npm test` — 35/35 pruebas.
- `app/: npm run lint` — aprobado.
- `app/: npm run typecheck` — aprobado.
- `app/: npm run build` — aprobado con la advertencia ya conocida del lockfile raíz.
- Revisión visual en navegador de agenda y portada, menú móvil y escritorio.

## Revisión

Status: PASS

- El diff conserva las operaciones de la agenda, no agrega rutas inactivas y mantiene los límites de datos ficticios explícitos.
