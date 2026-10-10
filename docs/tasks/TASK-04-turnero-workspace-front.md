# TASK-04 — Secciones del espacio Turnero (frontend)

## Objetivo

Completar la navegación del espacio Turnero con Servicios, Clientes, Caja y Equipo, y retirar de la interfaz los rótulos de demostración. Las pantallas deben poder recorrerse y operar con estado local durante la sesión, con límites tipados para conectar una futura API.

## Alcance

- Navegación lateral y móvil con Inicio, Agenda, Servicios, Clientes, Caja y Equipo; estado activo por ruta.
- Portada interna con accesos a las secciones.
- Servicios: listado, búsqueda y alta local de nombre, duración y descripción.
- Clientes: listado, búsqueda, ficha simple y alta local de datos de contacto.
- Caja: vista de movimientos de entrada/salida, filtro por fecha y tipo, y alta local de movimiento manual con fecha explícita; no se registran ventas ni pagos.
- Equipo: listado, búsqueda y alta local de integrante operativo o administrador como configuración visual; no se envían invitaciones ni se otorgan permisos.
- Los servicios e integrantes incorporados durante la sesión se ofrecen en el formulario de turnos.
- Quitar de las páginas del espacio Turnero el texto “modo demostración”, “datos de ejemplo” y equivalentes. La documentación seguirá declarando los límites reales.
- Contratos async tipados entre pantallas y fuente local, sin acceso directo a base de datos desde Next.

## Límites

- Sin cambios en `api/`, Prisma, login ni autorización.
- Sin persistencia: el estado se reinicia al recargar y no representa operaciones reales.
- Caja no define apertura/cierre, conciliación, medios de pago o reglas monetarias definitivas.
- Equipo operativo no equivale a membresías o usuarios autenticados.
- El negocio piloto, métrica y flujo MVP siguen pendientes de validación.

## Criterios de aceptación

1. Las seis rutas son navegables desde sidebar y menú móvil; la activa se identifica visualmente y con `aria-current`.
2. Cada sección muestra datos, estado vacío/búsqueda y permite una acción local coherente con su propósito.
3. Las entradas inválidas se rechazan en la frontera de datos y la UI muestra errores sin perder lo escrito.
4. Servicios y equipo agregados aparecen al crear un turno sin recargar.
5. No hay rótulos visibles que presenten el espacio como demostración.
6. Tests relevantes, lint, typecheck y build web pasan; revisión visual en móvil y escritorio.

## Implementación

Status: IMPLEMENTED

- Navegación y portada actualizadas con las seis rutas.
- Cuatro secciones nuevas con filtros, formularios y errores; fuente local async tipada compartida durante la navegación.
- Caja inicia el filtro en la fecha local del navegador y exige elegir la fecha de cada movimiento; al guardarlo, muestra la jornada registrada.
- Servicios y profesionales incorporados aparecen en el formulario de turnos.
- Avisos visibles de demostración retirados del espacio interno.

## Verificación

Status: PASS

- `app/: npm test` — 44/44 pruebas.
- `app/: npm run lint` — aprobado.
- `app/: npm run typecheck` — aprobado.
- `app/: npm run build` — aprobado con la advertencia conocida del lockfile raíz.
- Revisión visual en navegador de Servicios, Clientes, Caja y Equipo en escritorio; Equipo en móvil.

## Revisión

Status: PASS

- La revisión independiente detectó que el alta de Caja usaba una fecha fija sin mostrarla. Se corrigió con una fecha de alta obligatoria, se añadió verificación en la prueba de interfaz y se repitieron las verificaciones.
- No se encontraron otros defectos concretos en rutas, navegación ni integración de Servicios y Equipo con Agenda.
