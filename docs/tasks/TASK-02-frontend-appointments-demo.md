# TASK-02 — Agenda de turnos navegable (frontend)

## Objetivo

Crear una demostración navegable del registro manual de turnos para barberías y negocios de servicios similares. El objetivo es revisar el flujo de interfaz antes de implementar identidad, persistencia o reglas de disponibilidad en la API. Este prototipo no define por sí solo el negocio piloto ni la métrica del MVP.

## Alcance

- Incorporar `/app/agenda` a la navegación interna.
- Mostrar una jornada de ejemplo con turnos, profesionales y servicios ficticios.
- Permitir recorrer fechas, filtrar por profesional, abrir el detalle, registrar, reprogramar y cancelar turnos durante la sesión de demostración.
- Comunicar claramente que los datos son de ejemplo y se reinician al recargar.
- Diseñar estados de carga, vacío, error, confirmación y horario ocupado.
- Mantener un contrato tipado de fuente de datos separado de los componentes. El adaptador de demostración podrá reemplazarse por uno HTTP cuando exista el contrato de NestJS.
- Mantener `Appointment`, `Sale` y `Payment` como conceptos separados.

## Límites

- Sin cambios en `api/`, Prisma o autenticación.
- Sin garantía de disponibilidad desde el navegador: la API futura será autoridad sobre conflictos y permisos.
- Sin cobros, comisiones, inventario, ecommerce, WhatsApp ni IA.
- Los nombres, duraciones y horarios de ejemplo son datos de interfaz, no reglas aprobadas del producto.
- No se guarda información personal real ni se promete persistencia.

## Diseño de interfaz

La dirección visual conserva el lenguaje de Nuari: base marfil, tinta oscura y acentos verdes. La agenda concentra el foco en la jornada, con una barra de fechas, filtros y tarjetas de turno fáciles de escanear. En pantallas pequeñas el recorrido pasa a una lista vertical; el formulario aparece como panel superpuesto accesible.

## Contrato interno de datos

La interfaz de fuente de datos expone operaciones asíncronas para listar por fecha, crear, reprogramar y cancelar. Recibe y devuelve objetos tipados con identificadores, fecha/hora inequívocas, profesional, servicio, cliente y estado. Un error de horario ocupado se representa con un código reconocible para que la UI muestre una recuperación útil. El adaptador de demostración simula estas respuestas en memoria. El contrato HTTP definitivo y la autorización tenant-aware se diseñarán junto con la API.

## Criterios de aceptación

1. Desde `/app` se llega a una agenda funcional mediante navegación visible.
2. Una persona puede inspeccionar un turno, registrar uno nuevo, cambiarle fecha/hora y cancelarlo; la vista se actualiza durante la sesión.
3. La UI explica cuándo un horario está ocupado y conserva los datos del formulario para corregirlos.
4. Carga, vacío y error de lectura tienen estados visibles y recuperables.
5. Teclado y tecnologías asistivas pueden operar navegación, filtros, formularios y confirmación de cancelación.
6. El prototipo deja claro que no existe sesión ni persistencia real.
7. Tests de comportamiento, lint, typecheck y build web pasan. Las pruebas de navegador se ejecutan si existe infraestructura end-to-end.

## Etapas de trabajo

1. Definir tipos y adaptador de demostración con pruebas de sus operaciones y errores.
2. Implementar agenda, detalle y formularios con pruebas de los recorridos principales.
3. Integrar navegación y actualizar documentación operativa.
4. Ejecutar verificaciones y revisar el diff contra estos criterios.

## Implementación

Status: IMPLEMENTED

### Archivos

- `app/src/app/(app)/app/agenda/page.tsx` y `app/src/app/(app)/app/page.tsx`
- `app/src/components/layout/app-navigation.tsx` y `app/src/components/ui/input.tsx`
- `app/src/features/appointments/agenda-screen.tsx`, `appointment-panel.tsx`, `demo-source.ts`, `demo-provider.tsx`, `types.ts` y sus pruebas
- Documentación de producto, desarrollo y contexto operativo

### Notas

- El adaptador de demostración mantiene cambios sólo en memoria; el proveedor del layout conserva la misma fuente al navegar dentro del shell. `AppointmentSource` define la frontera que consumen las pantallas.
- El mensaje de horario ocupado representa la respuesta del adaptador. La API futura será la autoridad sobre disponibilidad, pertenencia y permisos.
- Se revisaron visualmente la agenda y el formulario en anchos móvil y escritorio.

## Verificación

Status: PASS

- `app/: npm test` — 35/35 pruebas.
- `app/: npm run lint` — sin errores ni advertencias.
- `app/: npm run typecheck` — aprobado.
- `app/: npm run build` — aprobado; Next mantiene una advertencia no bloqueante por el lockfile vacío de la raíz, registrada en problemas conocidos.
- `api/` no se modificó; las verificaciones de API de la inspección previa siguen documentadas en el snapshot.
- No existe infraestructura Playwright; el recorrido visual se inspeccionó en navegador y las acciones se probaron con Vitest/Testing Library.

## Revisión

Status: PASS

- La revisión detectó y se corrigieron tres casos: conservar cambios al navegar dentro del shell, retener el foco dentro del diálogo de detalle y rechazar fecha/hora inválidas en el adaptador. Cada corrección tiene prueba de comportamiento.
