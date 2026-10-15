# ADR-009: Decisiones aprobadas del turnero inicial

- Estado: **Aceptados los seis puntos y las reglas complementarias de negocio de TASK-10 sección 1.6. B1–B7 implementados/verificados; B8a implementada y pendiente de revisión visual del usuario.**
- Fecha: 2026-10-14.
- Fuente: confirmación expresa «Si apruebo» a los seis puntos, seguida por la aprobación final de las once reglas de TASK-10 sección 1.6 y las precisiones técnicas E1–E5. La autorización posterior inicia B1 con la condición de no usar Neon dev/producción.
- Contrato: [TASK-10, sección 1.5](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#15-seis-decisiones-aprobadas-por-confirmación-expresa--2026-10-14).
- Complementa [ADR-008](ADR-008-scheduling-personalization.md); no reemplaza la personalización aprobada ni amplía permisos de ejecución.

## Contexto

FEAT-003 aporta catálogo y profesionales persistidos. FEAT-004 tiene B1–B7 implementados en backend y B8a integra la referencia Gemini aprobada con contratos reales. Se necesita registrar decisiones seleccionadas sin convertir el resto del diseño técnico en una aprobación general.

## Implementación técnica B2

El entorno de API ejecuta Node 24.16 sin `globalThis.Temporal`; por ello la conversión temporal usa `@js-temporal/polyfill` 0.5.1, fijado exactamente en el lockfile y encapsulado en el adaptador de zona horaria. La licencia publicada es ISC y la única dependencia de ejecución añadida por el paquete es `jsbi` (Apache-2.0). No se implementa parser DST propio. `Temporal` resuelve los instantes posibles; el adaptador rechaza gaps, exige offset explícito para repeticiones, valida que coincida con IANA y representa días locales de 23/25 horas o fechas omitidas.

La política temporal pura valida enteros/rangos aprobados, compara el mínimo de anticipación y cutoff como tiempo transcurrido, y evalúa el horizonte por fecha local inclusiva. Recibe un `Clock`; no consulta el reloj ni zona del host. La prueba cubre transición de Nueva York, fecha omitida de Apia, horario de verano/invierno, medianoche, año bisiesto y límites numéricos. B2 no agrega endpoints ni persistencia.

B3 agrega `SchedulingReadModule`, limitado a DatabaseModule, como proyección tenant-aware para ocupaciones y reglas de bloqueo timezone. `AvailabilityModule` expone settings/calendarios versionados con permisos OWNER/ADMIN de escritura y lectura operativa para EMPLOYEE. Calendarios tienen lock y cambio de configuración con If-Match; reemplazos y ausencias que afectan reservas confirmadas fallan sin escritura parcial. Un cambio efectivo de timezone, directo o por country, se rechaza si hay CONFIRMED futuras/en curso o reglas locales; Organization y lectura de impacto participan de la misma transacción. B3 no agrega esquema ni migración.

## Seis decisiones aprobadas

1. **Capacidad sin profesional:** una reserva simultánea por servicio inicialmente. Recursos y capacidad configurable quedan para una evolución futura, sin implementarlos ahora. No es capacidad ilimitada ni un cupo compartido automáticamente entre todos los servicios.
2. **Estados de reserva:** CONFIRMED, COMPLETED, CANCELLED y NO_SHOW. No incorporar PENDING en el primer corte. Reserva, venta y pago siguen separados por los invariantes vigentes.
3. **Asignación automática:** distribución equilibrada entre profesionales disponibles y desempate determinista. Contar reservas CONFIRMED y COMPLETED que comienzan en el día local del negocio; excluir CANCELLED y NO_SHOW. La elegibilidad y disponibilidad se vuelven a verificar al confirmar.
4. **Empleados:** pueden crear, consultar, reprogramar y cancelar reservas internas dentro de las políticas ordinarias. Pueden leer los datos operativos necesarios, pero no notas sensibles ni información financiera global. No administran horarios/políticas, excepciones administrativas ni correcciones terminales. OWNER/ADMIN pueden corregir estados finales con motivo obligatorio y auditoría.
5. **Reservas públicas:** sin cuenta Nuari obligatoria, con nombre y al menos un contacto obligatorios, gestión mediante enlace seguro y revocable, y sin recuperación automática si no existe un canal verificable. Se persiste el hash del token, no el secreto. La vigencia máxima propuesta es hasta 30 días después del turno, sujeta a la política de retención. El enlace sólo gestiona la reserva conforme a las reglas aprobadas.
6. **Zonas horarias e integridad:** instantes UTC, zonas IANA y tratamiento explícito de cambios de horario; rechazar horas inexistentes y desambiguar las repetidas con offset explícito. Bloquear cambios de zona con reservas futuras hasta resolver su impacto. Restricciones PostgreSQL deben impedir reservas incompatibles y mantener aislamiento por Organization.

## Consecuencias documentadas

La capacidad uno y la lista de estados pasan de pendientes a aprobadas. Las reglas complementarias precisan cardinalidad, correcciones auditadas, horarios/calendarios, conteo de asignación, lectura operativa y operación pública. Los tokens de gestión se guardan como hash y son revocables; los detalles criptográficos quedan sujetos a validación técnica.

Los cambios de configuración mantienen la no retroactividad de ADR-008: preservan reservas ya confirmadas y sus condiciones. El diseño deberá probar la exclusión por profesional incluso entre servicios distintos y el cupo por servicio sin asignación, además del aislamiento y DST. Se describen pruebas futuras; ninguna garantía DB se declara verificada todavía.

## Reglas complementarias aprobadas y validaciones restantes

La confirmación final también aprobó las once reglas R1–R11 de [TASK-10, sección 1.6](../../tasks/TASK-10-feat-004-scheduling-availability-appointments.md#16-cierre-de-dominio--once-propuestas-para-aprobación-final), compatibles con este ADR y ADR-008. En particular: una reserva tiene un cliente y servicio, con cero o un profesional; los calendarios combinan negocio/profesional, excepciones y ausencias; los cambios que invaliden turnos requieren resolución explícita; los enlaces pueden consultarse/cancelarse según políticas después de despublicar o vencer la suscripción; y la integridad se garantiza en PostgreSQL además de la aplicación.

Las precisiones E1–E5 aprobadas establecen correcciones de estados finales sólo para OWNER/ADMIN con motivo y auditoría; el conteo diario de reparto descrito arriba; acceso operativo mínimo para EMPLOYEE sin notas sensibles ni finanzas globales; token hasheado y revocable, con vigencia máxima propuesta de 30 días sujeta a retención; y rechazo de horas inexistentes, offset explícito en horas repetidas y bloqueo de cambios de zona con reservas futuras hasta resolver impacto.

B1 está desbloqueado funcionalmente y completado. La migración quedó aplicada sólo en Neon Feat10 aislada (PostgreSQL 18.6); pruebas de constraints focalizadas 2/2. B2 implementó el adaptador temporal; B3 settings/calendarios; B4 disponibilidad privada; B5 reservas internas idempotentes; B6 ciclo de vida; B7 catálogo/availability/booking/gestión públicos, rate limit, token hasheado y revocación. B7 pasó 3/3 pruebas de integración en Feat10 y 2/2 pruebas unitarias de token; typecheck y lint pasaron. B8a integra Agenda según diseño `agenda_nuari 3.html`; espera revisión. La lectura de ausencias pasó integración en Feat10. No se usó Neon dev ni producción para FEAT-004. No hay commits.

Piloto/métrica y retención/privacidad siguen pendientes para validar el MVP y usar datos de terceros. El algoritmo de hash/rotación de claves, soporte del runtime temporal y protocolo concreto de locks son validaciones de implementación; no reabren las reglas de negocio aprobadas.
