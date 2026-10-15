# ADR-008: Personalización del turnero por organización

- Estado: **Aceptada para el alcance descrito abajo. B1–B7 aplicados/implementados y verificados; B8a implementada y pendiente de revisión visual del usuario.**
- Fecha: 2026-10-14.
- Aprobación: el usuario confirmó personalización desde el lanzamiento y solicitó actualizar sólo documentación.
- Contrato técnico: [aprobación en TASK-10, sección 1.4](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#14-personalización-aprobada--2026-10-14) y [límites/semántica, sección 5.1](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#51-política-configurable-aprobada-y-límites-técnicos).

## Contexto

Servicios/Turnero necesita reglas distintas según el negocio. El catálogo FEAT-003 ya separa duración y modo de selección por servicio. FEAT-004 B1–B7 están implementados en API; B8a integra Agenda con los contratos reales. Los valores iniciales de una organización no deben convertirse en constantes globales ni modificar turnos que ya fueron confirmados.

## Decisión aprobada

Las siguientes reglas serán configurables por Organization **desde el lanzamiento**, validadas y aplicadas en API:

| Regla | Default | Valores técnicos admitidos |
| --- | --- | --- |
| Intervalo entre inicios candidatos | 15 minutos | Sólo 5, 10, 15 y 30 minutos. |
| Anticipación mínima | 120 minutos | Entero 0–43.200 minutos. |
| Plazo de cancelación antes del inicio | 120 minutos | Entero 0–43.200 minutos. |
| Horizonte de inicio de reservas | 60 días | Entero 1–365 días de calendario local, última fecha inclusiva. |

Selección de profesional según la modalidad configurada en **Service**, sin sustituirla por un modo global. Reservas públicas sin cuenta Nuari obligatoria: no exigir User, credenciales o membresía al cliente para reservar. Esto no resuelve por sí solo publicación, verificación de contacto ni gestión posterior.

La duración del servicio (5–720 minutos, aprobada en FEAT-003) determina la ocupación completa; el intervalo sólo genera inicios. No deben ser iguales ni múltiplos entre sí. Un servicio de 25 minutos en grilla 15 ocupa sus 25 minutos; se descartan candidatos incompatibles por solapamiento.

Los límites son inclusivos; entradas fuera de rango/tipo se rechazan sin coerción, redondeo ni recorte. Un conjunto numéricamente válido puede dar disponibilidad vacía al combinar anticipación, horizonte y jornadas; advertir sin ampliar cupos ni cambiar reglas. El máximo del horizonte no amplía el rango máximo de una consulta de disponibilidad.

## Conservación de reservas y límites de seguridad

Cambiar configuración afecta nuevas reservas y destinos de reprogramaciones explícitas, sin redondear, reasignar, cancelar ni recalcular turnos confirmados. Conservar inicio/fin UTC, duración, zona, referencias y condiciones de cancelación originales. Cada reserva guarda snapshots de los cuatro valores temporales y la versión aplicada; al cancelar se usa su plazo congelado. Una reprogramación exitosa aplica la política actual al destino con condiciones visibles y evento; un fallo/replay no reinterpreta el original.

Configuración es tenant-aware, versionada y transaccional; validarla en backend y reforzar límites en PostgreSQL durante implementación autorizada. La carrera entre cambio de política y confirmación debe producir un snapshot íntegro de una versión, nunca una mezcla. No rebajar protecciones contra superposición ni permitir excepciones de seguridad por elegir otro intervalo.

Mantener Organization como tenant; UTC para instantes, IANA para reglas locales y DST explícito. Rechazar horas locales inexistentes y resolver horas repetidas con offset explícito. Minutos de anticipación/cancelación son tiempo transcurrido; horizonte son fechas locales, sin multiplicar días por 24 horas. Bloquear cambios de zona con reservas futuras hasta resolver su impacto. La selección y validación de runtime/adapter temporal siguen siendo técnicas.

## Alternativas descartadas en este alcance

- Constantes globales: impiden personalización por negocio.
- Posponer personalización: contradice el requisito de configuración desde el lanzamiento.
- Usar duración como paso de grilla: confunde ocupación e inicios y rompe servicios con distinta duración.
- Recalcular turnos confirmados al cambiar settings: altera compromisos existentes y puede generar solapamientos.

## Decisiones complementarias y límites técnicos

La confirmación posterior del usuario aprobó las once reglas de dominio de [TASK-10, sección 1.6](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#16-cierre-de-dominio--once-propuestas-para-aprobación-final) y las precisiones E1–E5, compatibles con esta personalización y con [ADR-009](ADR-009-scheduling-core-decisions.md). La corrección de estados finales es administrativa, auditada y separada de cambios de configuración; la gestión mediante enlace mantiene sus gates y sujeta su retención a la política de datos.

B1 está desbloqueado funcionalmente y completado en la rama Neon aislada `Feat10`. PostgreSQL 18.6 confirmó `btree_gist` disponible y permisos de creación; la migración `20261014211225_scheduling_appointments` quedó aplicada y las pruebas de constraints focalizadas pasaron 2/2. B2–B7 implementaron política temporal, calendarios/disponibilidad, alta interna, ciclo de vida y reserva/gestión pública. B8a implementa la Agenda administrativa sobre las APIs reales; la lectura de calendarios ahora incluye ausencias y pasó integración tenant-aware 1/1 en Feat10. Frontend: typecheck y lint focalizado PASS, pruebas de Agenda y navegación 6/6. No se usó Neon dev ni producción. La revisión visual/manual del usuario queda pendiente.

El enlace público usa un token seguro cuyo hash se persiste, con revocación y gestión sujetas a las reglas aprobadas. La vigencia máxima propuesta es hasta 30 días después del turno y queda limitada por la política de retención. El algoritmo de hash/rotación de claves, runtime temporal, soporte de extensión y protocolo concreto de locks son validaciones de implementación, no decisiones de negocio pendientes.

Piloto/métrica y política de retención/privacidad siguen pendientes para validar el MVP y usar datos de terceros. B8a espera revisión visual; B8b y B9 siguen pendientes.
