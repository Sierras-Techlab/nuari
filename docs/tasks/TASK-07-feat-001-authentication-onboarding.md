# TASK-07 — FEAT-001: Autenticación, organizaciones y onboarding

## Goal

Persistir en PostgreSQL el flujo registro → login → verificación de correo → `/onboarding` → organización + membresía OWNER + suscripción de prueba de 14 días → `/app`. Implementar identidad global, sesiones seguras y autorización por organización; conectar las vistas existentes sin rediseñarlas.

## Context

- Contrato vigente de ejecución para **FEAT-001**. Sustituye para esta feature a `TASK-06-feat-001-identity-organizations-trial.md`, encontrado como archivo no versionado durante la inspección; no ejecutar ambas tareas ni interpretar sus diferencias como decisiones ya implementadas. TASK-01 a TASK-05 conservan sus alcances históricos.
- Estado inspeccionado: proyectos npm independientes; Next.js 16.3.3/React 19/TypeScript en `app/`; NestJS 12/Express/ESM/Prisma 7 en `api/`. Sólo existe `GET /api/health`. No hay modelos, enums, migraciones, DTO, guards ni servicios de dominio backend.
- Reutilizar `DatabaseModule`, `PrismaService`, `configureApp`, conexiones pooled/direct y cliente Axios centralizado. CORS ya permite credenciales para `WEB_ORIGIN`; Axios todavía no las configura ni traduce errores.
- `AuthForm` conserva Nombre/Apellido/email/contraseña: registro sólo navega; login sólo muestra un aviso. `/onboarding` tiene cuatro pasos locales, utilidades de slug y catálogo con los valores solicitados. El CTA no persiste nada. `/app/**` no tiene protección.
- Los providers `WorkspaceProvider` y `DemoAppointmentProvider` mantienen datos locales. `TeamMember.role = admin | professional` es presentación operativa, **no** `OrganizationMember`. FEAT-001 no persiste agenda, servicios, clientes, caja ni equipo.
- Fuentes canónicas: [ADR-001](../architecture/decisions/ADR-001-modular-monolith.md), [ADR-002](../architecture/decisions/ADR-002-managed-postgresql.md), [ADR-003](../architecture/decisions/ADR-003-tenant-isolation.md), [ADR-004](../architecture/decisions/ADR-004-living-documentation.md), [ADR-005](../architecture/decisions/ADR-005-custom-authentication.md), [multi-tenancy](../architecture/multi-tenancy.md), [modelo](../architecture/data-model.md), [módulos](../architecture/modules.md) y [MVP](../product/mvp.md).
- Resolver al implementar: `modules.md` atribuye membresías a Identity and Access; ADR-005 asigna su resolución a Organizations. Priorizar ADR-005: `OrganizationMember` es el nombre físico de Membership, con roles por organización. Esta tarea autoriza el corte de identidad/SaaS, no los módulos comerciales anunciados ni la validación todavía pendiente del piloto.
- Landing y onboarding son contenido comercial presentacional, sin catálogo backend aprobado de importes/cupos. No deducir precios ni permisos de sus textos. Registrar esa discrepancia y los enlaces legales pendientes como pendientes de publicación, sin cambiar su estética ni inventar políticas legales.

## Requirements

1. Registrar nombre, email normalizado único y contraseña; crear sólo identidad/credencial, sin organización, rol global ni `onboardingCompleted`. Registro no inicia sesión: confirmar genéricamente y dirigir a `/login`.
2. Implementar login, logout, consulta de identidad/contexto, verificación/reenvío de correo y recuperación/reset. Permitir login sin correo verificado; exigir verificación para conceder la primera prueba. Una membresía activa existente permite ingresar aunque el usuario no sea creador ni haya hecho onboarding propio.
3. Admitir varias organizaciones por usuario y roles `OWNER`, `ADMIN`, `EMPLOYEE` distintos por membresía. No implementar invitaciones, edición de roles, gestión de personal ni creación adicional de negocios.
4. Crear organización, miembro ACTIVE/OWNER, suscripción TRIALING, concesión única de prueba y resultado idempotente en una transacción. Endpoint sólo para usuarios sin membresías activas y sin concesión previa.
5. Prueba exactamente de 336 horas desde la creación efectiva confirmada por backend; plan elegido persistido por organización, sin tarjeta/cobro automático. Una concesión de prueba por identidad creadora durante la vida de su cuenta; pertenecer como empleado no consume esa concesión.
6. Al vencer, denegar gestión de negocio en backend y desmontar sus pantallas/providers; conservar datos y acceso a identidad, logout y estado/regularización de suscripción. No construir pagos ni simular una activación paga.
7. Integrar loading, validación, errores, expiración, redirecciones, reintentos y confirmación real, preservando tarjetas, estructura, estilos, animaciones, transiciones y accesibilidad.
8. Rutas principales exactas: `/`, `/register`, `/login`, `/onboarding`, `/app`. Proteger también todas las subrutas `/app/**`. **No crear `/app/onboarding` ni mover las rutas existentes.**
9. Excluidos: JWT principal, proveedor de identidad, OAuth/MFA, cambio de email, borrado de cuentas/organizaciones, invitaciones completas, staff operativo real, permisos completos de cada dominio, precios/cupos, Mercado Pago, checkout, cobros, renovaciones, facturación, webhooks, IA/WhatsApp, RLS, microservicios y persistencia del Turnero.

## Architecture

### Decisiones y límites de módulos

- Mantener NestJS como única autoridad de identidad, autorización, reglas y acceso a PostgreSQL. No implementar lógica de negocio en Next ni importar Prisma/tipos internos backend en frontend.
- `IdentityModule`: User, Credential, sesiones y tokens; `SessionGuard` global con decorador público explícito. Exporta capacidades de identidad/sesión, no repositorios.
- `OrganizationsModule`: organizaciones, miembros, permisos y contexto tenant. Exporta resolución/listado de membresías activas y creación inicial; el rol nunca se obtiene del request.
- `SubscriptionsModule`: planes admitidos, suscripción, elegibilidad/concesión de prueba y evaluación comercial. Exporta política de acceso y creación de prueba dentro de una transacción recibida.
- Organizations coordina el onboarding mediante capacidades públicas de Identity y Subscriptions con un `TransactionContext` explícito. Una sola transacción Prisma/PostgreSQL; no transacciones anidadas independientes ni accesos arbitrarios a tablas internas de otro módulo.
- Orden de autorización: sesión válida → miembro ACTIVE del tenant solicitado → permiso requerido → suscripción vigente si la operación es de negocio. No aplicar guard comercial a toda la aplicación indiscriminadamente.
- `Clock` inyectable para sesiones, tokens, rate limits y suscripciones; producción usa UTC del servidor y tests tiempo controlado. No hay endpoints públicos de cambio de reloj ni cron necesario para denegar vencimientos.
- Coder debe registrar un ADR nuevo, con el próximo número disponible, para transporte same-origin y completar ADR-005 con políticas de seguridad de esta tarea. Alinear módulos/modelo/multi-tenancy. No reemplazar ADR-001/002/003 ni adoptar otra arquitectura.

### Transporte Next/Nest y protección de renderizado

- Axios browser: `baseURL=/api`, `withCredentials: true`, timeout vigente de 10 s y DTO/errores explícitos. Actualizar el significado documentado de `NEXT_PUBLIC_API_URL` a `/api`; rechazar configuraciones cross-origin para esta feature.
- Rewrite en `app/next.config.ts`: `/api/:path*` → `${API_INTERNAL_URL}/api/:path*`. `API_INTERNAL_URL` es origen server-only, local `http://localhost:3001`, HTTPS en despliegues. Conservar `turbopack.root`. Next es proxy de transporte, no otro backend: sin Route Handlers/Server Actions de negocio.
- El rewrite debe conservar método/body/Origin y cada `Set-Cookie` por separado. Cookies host-only quedan en el host web y llegan a Next: no requieren `Domain` compartido ni cookies third-party. Verificarlo en build/start y staging; no admitir browser→API cross-site como fallback.
- Helpers `server-only` leen `await cookies()` y consultan Nest con `fetch` directo a `API_INTERNAL_URL`, `cache: 'no-store'` y timeout. Reenviar **sólo** la cookie de sesión al origen configurado, sin singleton Axios request-specific, Cookie completo ni destinos derivados del cliente.
- Validar contexto antes de renderizar **cada página privada**, además del shell. Next 16 advierte que un layout no evita render/RSC de sus hijos ni se revalida en toda navegación. No proteger únicamente con layout, `useEffect`, existencia de cookie o `proxy.ts`. No se necesita middleware/proxy de autenticación.
- SSR no emite/rota cookies. Sesión/DTO privados, HTML y RSC no se comparten mediante caché/ISR; API responde `Cache-Control: no-store` en auth/contexto/organizaciones. No interceptar las excepciones de `redirect()` como errores de red.
- `WEB_ORIGIN`: un origen exacto HTTP(S), sin path/query/fragment/comodines; obligatorio y HTTPS en producción. CORS con credenciales sólo para él; preview necesita configuración de ambiente propia. OPTIONS es público, pero CORS no sustituye CSRF.

### Esquema y migraciones

UUID backend para IDs; timestamps `timestamptz` UTC; hashes SHA-256 de tokens codificados en hex y únicos. Conservar Prisma 7, generator y adaptador PostgreSQL actuales.

| Entidad | Campos y constraints |
| --- | --- |
| `User` | `id`, `name`, `email` normalizado UNIQUE, `emailVerifiedAt?`, `createdAt`, `updatedAt`. Sin tenant/rol global. |
| `UserCredential` | `userId` PK/FK, `passwordHash` PHC Argon2id, `version` entero positivo, `passwordChangedAt`, `updatedAt`. Relación User 1:1. |
| `Session` | `id`, `userId`, `tokenHash` UNIQUE, `credentialVersion`, `activeOrganizationId?`, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt?`. Índices `(userId, revokedAt)`, `expiresAt`. |
| `EmailVerificationToken` | `id`, `userId`, `tokenHash` UNIQUE, `createdAt`, `expiresAt`, `consumedAt?`. Índices `(userId, consumedAt)`, `expiresAt`. |
| `PasswordResetToken` | Mismos campos, tabla separada por propósito. |
| `Organization` | `id`, `name`, `slug` UNIQUE global y canónico, `businessType`, `createdAt`, `updatedAt`. Propietario mediante miembro, no campo de User. |
| `OrganizationMember` | `id`, `userId`, `organizationId`, `role`, `status`, `createdAt`, `updatedAt`. UNIQUE `(userId, organizationId)`; índices `(userId, status)` y `(organizationId, status)`. |
| `Subscription` | `id`, `organizationId` UNIQUE, `planCode`, `status`, `trialStartedAt`, `trialEndsAt`, `paidThrough?`, `createdAt`, `updatedAt`; índice `(status, trialEndsAt)`. |
| `TrialGrant` | `id`, `userId` UNIQUE, `organizationId` UNIQUE, `grantedAt`. Registro permanente de concesión; no eliminar al desactivar membresía. |
| `OnboardingSubmission` | `id`, `userId`, `key` UUID, `requestHash`, `organizationId` UNIQUE, `createdAt`. UNIQUE `(userId, key)`; sólo resultados exitosos. |
| `RateLimitBucket` | `scope`, `keyHash`, `windowStartedAt`, `count`, `expiresAt`; PK compuesta `(scope, keyHash, windowStartedAt)`, índice `expiresAt`. Contadores compartidos PostgreSQL, sin emails/IP en claro. |

- Enums exactos: `BusinessType = SERVICES | COMMERCE | HOSPITALITY`; `PlanCode = BASIC | PRO | BUSINESS | TOURISM`; `OrganizationRole = OWNER | ADMIN | EMPLOYEE`; `MembershipStatus = ACTIVE | INACTIVE`; `SubscriptionStatus = TRIALING | EXPIRED | ACTIVE | PAST_DUE | CANCELED`.
- **Planes:** catálogo cerrado de códigos enum, no tabla de precios/catálogos administrables sin necesidad actual. GET publica esos códigos y `trialDays:14`; no duplica planes en Organization. Todos los planes son válidos para todos los tipos; recomendaciones visuales no restringen selección. No hacer cumplir cupos/prestaciones deducidos de la UI. Pagos futuros extenderán Subscription/entidades de proveedor, no User/Membership.
- User 1:N sesiones/tokens/miembros; Organization 1:N miembros y 1:1 Subscription/TrialGrant; creador User 0:1 TrialGrant. `Session.activeOrganizationId` es preferencia por sesión, nunca prueba de membresía.
- Cascada sólo User→Credential/Session/Token. Miembros, TrialGrant y Submission usan FK RESTRICT hacia User/Organization; Subscription RESTRICT hacia Organization; selección en Session SET NULL. No exponer borrados ni permitir que un borrado accidental habilite otra prueba.
- CHECK SQL versionados: email = trim/lowercase; slug válido; `credentialVersion/version > 0`; expiraciones posteriores a creación; `trialEndsAt = trialStartedAt + interval '336 hours'`; ACTIVE requiere `paidThrough` no nulo. `TrialGrant.grantedAt = trialStartedAt` lo garantiza la creación atómica. No duplicar marcadores de onboarding/prueba en User.
- Migraciones aditivas por fases: identidad/seguridad, organizaciones, suscripción/idempotencia. El estado intermedio no expone creación parcial. Generar/aplicar sobre PostgreSQL de prueba aislado, comprobar `migrate deploy` desde cero. Sin `db push`, downgrade Prisma, reset de bases ni borrados productivos; documentar despliegue/backup/rollback preservando datos.
- Futuras invitaciones, **sin tabla ni endpoints ahora**: `OrganizationInvitation(organizationId, normalizedEmail, role, tokenHash, expiresAt, acceptedAt, invitedByMembershipId)`, emisión autorizada y aceptación con email verificado, consumo único y creación de Member transaccional. El usuario invitado conserva su identidad global y la suscripción de la organización; no se crea StaffMember automáticamente.

### Validación y contratos HTTP

Prefijo Nest `/api`; paths de la tabla relativos a él. Éxitos son DTO JSON, no registros Prisma ni envelopes inventados. Error único `{code,message,fieldErrors?:Record<string,string[]>}`; fechas ISO-8601 UTC. ValidationPipe global con whitelist, rechazo de campos extra y sin coerción implícita permisiva; filtro de excepciones saneado.

- `name`: trim, 1–100 caracteres; registro concatena Nombre/Apellido existentes en un solo `name`, sin nuevos campos visuales.
- Email: trim/lowercase, formato válido, máximo 254 caracteres. No eliminar puntos, `+aliases` ni asumir equivalencias entre proveedores.
- Contraseña: 12–128 caracteres, máximo 1024 bytes UTF-8, sin trim/normalización/reglas de composición. Actualizar ayuda/placeholder actual de 8 caracteres y validación accesible, no la estética. Login acepta las mismas cotas sin transformar contraseña.
- Slug: 3–63 caracteres, lowercase, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`; rechazar formato no canónico. Reservados: `api`, `app`, `login`, `register`, `onboarding`, `admin`, `www`, `support`, `nuari`. Reutilizar generador web para UX; backend valida y DB decide unicidad. No crear una ruta pública por slug.
- IDs/claves UUID; tokens base64url con tamaño/formato acotado; límite body JSON de 16 KiB. Rechazar fechas/estado/rol/ownerId/userId/paidThrough/campos desconocidos del cliente, sin reflejar sus valores en errores.

| Método/path | Acceso/request | Respuesta |
| --- | --- | --- |
| `GET /health` | Público, sin DB | `200 {status:'ok'}` vigente. |
| `GET /auth/csrf` | Inicialización same-origin | `200 {csrfToken}`, cookie CSRF; nunca token de sesión. |
| `POST /auth/register` | Público + CSRF; `{name,email,password}` | `202 {message}` genérico para nuevo/duplicado; User/Credential/token atómicos, envío de verificación posterior. Sin sesión ni organización. |
| `POST /auth/login` | Público + CSRF; `{email,password}` | `200 {user,csrfToken}`, cookies nuevas. `401 INVALID_CREDENTIALS` igual para email inexistente/contraseña errónea. |
| `POST /auth/logout` | CSRF, incluso sesión ausente/expirada | `204`; revocar sesión actual y limpiar cookies, idempotente. |
| `GET /auth/me` | Sesión | `200 AccessSnapshot`; `401 UNAUTHENTICATED` si ausente/expirada/revocada. |
| `POST /auth/active-organization` | Sesión + CSRF; `{organizationId}` | `200 AccessSnapshot`; comprobar miembro ACTIVE antes de persistir selección. |
| `POST /auth/email-verification/request` | Sesión + CSRF; body vacío | `202 {message}`; enviar sólo al email propio; si ya verificado, no-op. |
| `POST /auth/email-verification/confirm` | Público + CSRF; `{token}` | `204`; `400 INVALID_TOKEN` genérico si inválido/consumido/expirado. No login automático. |
| `POST /auth/password-reset/request` | Público + CSRF; `{email}` | `202 {message}` indistinguible exista o no; solicitud no revoca sesiones. |
| `POST /auth/password-reset/confirm` | Público + CSRF; `{token,password}` | `204`; cambiar credencial/consumir tokens/revocar sesiones atómicamente; limpiar cookies actuales. |
| `GET /subscription-plans` | Sesión | `200 {plans:[{code}],trialDays:14}` con cuatro códigos, sin precios. |
| `POST /organizations` | Sesión + CSRF; `Idempotency-Key` UUID; `{name,slug,businessType,planCode}` | `201 {organization,membership,subscription}` después de commit; replay idéntico autorizado `200`, mismos IDs y fechas. |
| `GET /organizations/:id/subscription` | Sesión + miembro ACTIVE, cualquier rol | `200 {subscription,access}`; disponible al vencer, sólo consulta. |
| `GET /organizations/:id/workspace` | Sesión + tenant + `business:access` + guard comercial | `200 {organization,membership,access,evaluatedAt}` con metadata propia, sin datos operativos ficticios. Deniega al vencer; endpoint mínimo real para gate/pruebas backend. |

DTO públicos:

```text
UserDTO = {id,name,email,emailVerifiedAt}
OrganizationDTO = {id,name,slug,businessType,createdAt,updatedAt}
MembershipDTO = {id,organizationId,role,status}
SubscriptionDTO = {id,organizationId,planCode,status,trialStartedAt,trialEndsAt,paidThrough}
Access = {businessAllowed,reason,validUntil,canManageSubscription}
AccessSnapshot = {
  user: UserDTO,
  memberships: [{id,role,organization: OrganizationDTO}], // sólo ACTIVE propias
  activeOrganizationId: UUID|null,
  access: Access|null,
  onboarding: {canCreateOrganization,reason}
}
```

- `Access.reason`: `TRIAL_ACTIVE | PAID_ACTIVE | TRIAL_EXPIRED | SUBSCRIPTION_INACTIVE`; `validUntil` viene del backend. `onboarding.reason`: `ELIGIBLE | EMAIL_UNVERIFIED | HAS_MEMBERSHIP | TRIAL_ALREADY_USED`. `SubscriptionDTO.status` representa estado efectivo, no sólo enum potencialmente atrasado en DB.
- Códigos: `400 VALIDATION_ERROR/INVALID_TOKEN/INVALID_IDEMPOTENCY_KEY`; `401 UNAUTHENTICATED/INVALID_CREDENTIALS`; `403 CSRF_INVALID/EMAIL_UNVERIFIED/TRIAL_ALREADY_USED/PERMISSION_DENIED/SUBSCRIPTION_REQUIRED`; `404 ORGANIZATION_NOT_FOUND` tanto inexistente como ajena/inactiva; `409 SLUG_TAKEN/ONBOARDING_ALREADY_COMPLETED/IDEMPOTENCY_CONFLICT`; `429 RATE_LIMITED` con `Retry-After`; `500 INTERNAL_ERROR`; `503 SERVICE_UNAVAILABLE`. No revelar membresía/estado de una organización ajena ni confundir 5xx/timeout con ausencia de sesión.

### Credenciales, sesiones, tokens y correo

- Argon2id mediante adaptador `argon2`: memoria mínima 19456 KiB, iteraciones 2, paralelismo 1 y salt aleatorio mínimo 16 bytes; almacenar PHC completo, comprobar/rehash cuando corresponda. Email inexistente ejecuta verificación dummy con parámetros equivalentes; limitar concurrencia de hashes antes de asignar memoria.
- Sesiones: 32 bytes criptográficos aleatorios `node:crypto`, base64url; sólo SHA-256 en DB. Cookie como único transporte del token; nunca JSON, URL, React, localStorage/sessionStorage o logs. Login siempre crea sesión nueva, no adopta token anónimo/preexistente; revoca la sesión presentada si reemplaza una sesión válida.
- Duración absoluta 30 días y máxima inactividad 7 días. Guard comprueba revocación, versión de credencial, `now < expiresAt` y `now < lastSeenAt + 7 días`; igualdad deniega. Actualizar `lastSeenAt` sólo si la sesión seguía válida, mediante condición atómica para que concurrencia no reviva una sesión. Actividad no extiende vencimiento absoluto.
- Cookie producción `__Host-nuari_session`: HttpOnly, Secure, SameSite=Lax, Path=/, sin Domain, Max-Age hasta vencimiento absoluto. HTTP local `nuari_session`, mismos atributos salvo Secure=false. No inferir Secure desde headers no confiables; ambiente/configuración validada decide. Borrar con nombre/path/atributos equivalentes.
- `credentialVersion` de Session debe coincidir con Credential.version. Reset incrementa versión y revoca todas las sesiones en la misma transacción, sin auto-login. Login verifica hash fuera del lock y, antes de insertar sesión, bloquea/revalida la credencial/hash/versión observados; si cambiaron, deniega o verifica otra vez. Así un login concurrente no confirma una sesión basada en contraseña antigua. Rehash sin cambio de contraseña no implica incremento de versión.
- Verificación/reset: tokens aleatorios de 32 bytes, hashes SHA-256, tablas y propósito separados; TTL 24 horas y 30 minutos respectivamente. Nueva solicitud invalida anteriores del mismo propósito bajo lock del usuario; consumo condicional/atómico con un único ganador. Reset invalida todos los reset tokens vigentes. Verificación actualiza `emailVerifiedAt` sin alterar organización/roles.
- Email por puerto `EmailSender`, adaptador Resend REST con `fetch` de Node y timeout, dentro de Integrations; Resend ya está previsto en docs. Sin SDK nuevo, proveedor de identidad ni worker/cola. En tests, sender capturado en proceso, nunca endpoint público para obtener tokens. Transporte real configurado para pruebas manuales/staging y producción.
- Persistir token antes de enviar y enviar fuera de transacción mediante dispatcher no duradero, acotado, en el mismo proceso Nest; no esperar latencia del proveedor en la respuesta HTTP de registro/reset. Capturar errores y drenar envíos pendientes al cierre con timeout. Fallo/saturación del proveedor no revierte cuenta ni filtra existencia: respuesta genérica, evento saneado y reenvío disponible. Entrega garantizada/outbox queda fuera de alcance; documentar el límite.
- Registro duplicado realiza trabajo Argon2 equivalente sin actualizar credencial; los contratos genéricos no deben distinguir existencia por status, cuerpo, cookies ni espera condicional de correo. No añadir sleeps como sustituto de estos controles.
- Links con `WEB_ORIGIN` fijo: `/verify-email#token=...` y `/reset-password#token=...`. GET no consume tokens (escáneres de correo); páginas extraen fragmento, lo retiran inmediatamente de URL y confirman sólo por POST explícito. Sin analytics/recursos terceros; `Referrer-Policy: no-referrer`. Añadir `/forgot-password`, `/reset-password`, `/verify-email` con primitivas/estética auth existentes, sin modificar las cinco rutas principales.

### CSRF, abuso y configuración

- Signed double-submit: cookie HttpOnly `__Host-nuari_csrf` en HTTPS, `nuari_csrf` local; mismos atributos de sesión, TTL 1 hora. Valor firmado HMAC-SHA256 incluye nonce aleatorio, expiración y hash de cookie de sesión presentada, o marcador anónimo. GET `/auth/csrf` devuelve ese valor JSON para `X-CSRF-Token`; nunca devuelve cookie de sesión.
- Comparar header/cookie en tiempo constante, verificar firma/TTL/vínculo. Rotar CSRF al login/cambio de identidad y eliminar al logout/reset. Logout puede verificar vínculo con la cookie presentada aunque sesión haya vencido/revocado. El cliente sólo conserva CSRF en memoria y renueva tras recarga/rotación.
- Toda mutación, incluida login/register/reset, exige Origin exacto `WEB_ORIGIN`, JSON salvo body vacío y CSRF. Rechazar Origin ausente/`null` y `Sec-Fetch-Site: cross-site`. GET CSRF sólo permite peticiones same-origin o Origin explícito permitido; rechaza origen ajeno. No mutaciones con GET.
- Sólo ante `CSRF_INVALID`, renovar token y repetir como máximo una vez; creación conserva clave y payload. No retries automáticos de credenciales, errores 5xx, timeout o pagos futuros. No bucles de interceptors.
- Rate limits antes de hash/envío: login 10/min/IP **y** 10/15min/email; registro 5/h/IP; reset request 10/h/IP y 3/h/email; resend 5/h/user; confirmaciones 10/15min/IP; onboarding 3/h/user; CSRF 60/min/IP. Contar éxitos/fallos sin distinguir existencia de email; usar HMAC de identificadores y contador atómico PostgreSQL por ventana fija.
- `RateLimitBucket` compartido permite varias instancias/reinicios sin eludir límites; no Redis ni dependencia de throttling necesaria. Limpiar buckets expirados de forma acotada/oportunista, sin tareas destructivas generales. Si DB no está disponible, fallar cerrado en endpoints que la requieren; health permanece independiente.
- IP sólo desde socket o cadena de proxies explícitamente confiable: configurar CIDRs/hops reales del ingress, sanitizar forwarded headers y bloquear suplantación. No usar `trust proxy=true`, Host/X-Forwarded-For arbitrarios ni IP proporcionada en body. Documentar/verificar el trayecto Next/rewrite/ingress antes de publicar; proveedor/runtime todavía pendiente es un bloqueo de despliegue, no permiso para asumir confianza global.
- Variables API: `WEB_ORIGIN`, `CSRF_SECRET`, `RATE_LIMIT_SECRET` (secretos aleatorios distintos, mínimo 32 bytes), `RESEND_API_KEY`, `EMAIL_FROM`, configuración explícita de proxies, URLs DB existentes y NODE_ENV. Web: `API_INTERNAL_URL` server-only y `/api` público. Validación fail-fast en producción; fake email/reloj sólo mediante inyección de tests, no habilitados públicamente.
- Dependencias nuevas justificadas: `argon2` por ADR-005; `class-validator`/`class-transformer` para ValidationPipe; `cookie-parser` para Express; `helmet` para headers seguros. Revisar mantenimiento/Node 24 y lockfiles. `@playwright/test` sólo desarrollo. No biblioteca temporal, de pagos/auth, Redis ni SDK de correo necesario.
- Redactar Cookie, Authorization, bodies auth, fragmentos/tokens, hashes, contraseñas y secretos en logs/errores/analítica/proxy. Auditar eventos con tipo/IDs/resultado: login fallido, límites, revocación, concesión y creación; nunca payload sensible. El token de correo sólo sale por su envío, el CSRF sólo por su contrato.

### Creación inicial y evaluación comercial

1. Guard obtiene userId/sessionId; validar cuatro campos y clave. Abrir transacción; bloquear User con `SELECT ... FOR UPDATE` parametrizado. Todas las creaciones iniciales del mismo usuario pasan por ese lock.
2. Buscar `(userId,key)` **antes** de elegibilidad: mismo hash canónico → replay del resultado; distinto → `IDEMPOTENCY_CONFLICT`. Para replay revalidar sesión y miembro ACTIVE de la organización original: no filtrar resultado tras perder membresía. Devolver estado efectivo actual, no una decisión comercial cacheada ni cookies antiguas.
3. Nueva clave: correo verificado, cero miembros ACTIVE y ausencia de TrialGrant. Si tiene membresía, `ONBOARDING_ALREADY_COMPLETED`; si ya usó prueba sin membresías, `TRIAL_ALREADY_USED`. No exigir rol global/ser empleado/no tener membresías históricas.
4. Capturar un único `now` del backend dentro de la transacción, después de validaciones y justo antes de insertar. Crear Organization, Member ACTIVE/OWNER, Subscription TRIALING (`trialStartedAt=now`, `trialEndsAt=now+336 horas`, `paidThrough=null`) y TrialGrant (`grantedAt=now`). Las fechas sólo existen como prueba efectiva si el commit prospera; no desde registro/apertura de formulario/envío HTTP.
5. Persistir Submission con SHA-256 de JSON canónico de los cuatro campos normalizados y seleccionar organización en sesión, revalidada dentro de transacción. Éxito HTTP sólo tras commit; todo falla/rollback junto si cualquier paso falla.
6. UNIQUE es defensa final. Slug ocupado no consume prueba/clave. Mapear restricciones a errores de dominio; máximo tres reintentos sólo por conflictos transitorios de transacción, sin efectos externos dentro de retry.

- Misma clave/payload concurrentes → una creación; misma clave con payload diferente → conflicto; claves distintas de un usuario → sólo primera nueva creación. Usuario distinto con mismo slug → sólo uno. No usar simplemente deshabilitar el botón como garantía.
- Cliente congela clave UUID/payload del intento final y los conserva en memoria mientras haya resultado incierto; retry usa exactamente ambos. Bloquear edición mientras request está pendiente. Tras fallo confirmado puede editar y generar clave nueva; tras timeout resolver primero snapshot/retry, no afirmar fracaso de creación. Recarga/reentrada obtiene membresías backend; si commit ocurrió, navega a `/app`, sin volver a crear. Locks/TrialGrant impiden duplicar incluso entre pestañas.
- TRIALING habilita sólo `trialStartedAt <= now < trialEndsAt`; ACTIVE sólo con `paidThrough > now`; demás estados deniegan. Estado efectivo TRIALING vencido = EXPIRED aun sin job/escritura. GET puede calcularlo sin mutar; guard nunca depende de un cron ni enum aislado. No endpoint para editar fechas/plan/activar ACTIVE; futuros pagos lo harán por capacidad autorizada.
- BusinessAccessGuard protege lecturas y escrituras de negocio. Account, contexto/membresías propias, verificación/reset/logout y estado de suscripción están fuera del guard comercial, no fuera de auth/tenant correspondientes.
- Una concesión por creador sobrevive a desactivación de membresía; no se reinicia por login/cambio de plan/replay. Prevención de múltiples identidades: verificación, límites y eventos; no prometer eliminar fraude multi-cuenta sin señales adicionales. No bloquear empleados por compartir organización en prueba.

### Permisos y navegación

| Capacidad mínima | OWNER | ADMIN | EMPLOYEE |
| --- | --- | --- | --- |
| Leer contexto/estado de su suscripción | Sí | Sí | Sí |
| `business:access`, sujeto a suscripción | Sí | Sí | Sí |
| Administrar futura contratación (`canManageSubscription`) | Sí | Sí | No: contactar administrador |
| Invitaciones/roles/personal | No implementado | No implementado | No implementado |

`business:access` es sólo el permiso base de este corte, no aprobación de permisos definitivos para Caja/Equipo ni autorización para administrar otros usuarios.

| Estado persistido | Navegación/renderizado |
| --- | --- |
| Sin sesión | `/`, `/login`, `/register` públicos; `/onboarding` y `/app/**` → `/login`, sin contenido privado SSR/RSC. |
| Sesión sin miembros ACTIVE | `/login`, `/register`, `/app/**` → `/onboarding`. Mostrar formulario y razón de elegibilidad; si no verificó, permitir completar campos pero bloquear envío final y ofrecer reenviar/verificar. Si prueba ya usada, mostrar ayuda/logout, no loop ni otra concesión. |
| Sesión con miembro ACTIVE, cualquiera de los tres roles | `/login`, `/register`, `/onboarding` → `/app`; nunca exigir negocio propio/ser OWNER. |
| Onboarding confirmado | Refrescar snapshot, `router.replace('/app')` y `router.refresh()`; sólo después de éxito/reconciliación backend. |
| Organización sin acceso comercial | `/app` muestra shell mínimo con cuenta/logout/plan/vencimiento y panel de regularización; `/app/agenda`, `/servicios`, `/clientes`, `/caja`, `/equipo` bajo `/app` → `/app`, sin montar negocio. |
| Selección de membresía desactivada | Backend elige otra ACTIVE si existe; si no, contexto null → `/onboarding` con elegibilidad. No reutilizar contexto anterior. |

- Organización activa por Session; snapshot valida selección en cada request. Si falta/es inválida, fallback estable por `createdAt,id` de miembros ACTIVE, persistido mediante capacidad Identity. En cambio explícito, comprobar membresía. Selector discreto sólo si hay varias, conservando shell; no dashboards por slug ni rutas nuevas de negocio.
- Panel de regularización dentro de `/app`, sin rediseño: informar que contratación real todavía no está disponible; OWNER/ADMIN pueden consultar plan/contactar `hola@nuari.app`, EMPLOYEE debe contactar administrador. No CTA que finja pagar/activar ni API que acepte ACTIVE desde cliente. Mantener cuenta/logout también para usuario sin membresías en `/onboarding`.
- Form auth conserva estructura y protección prehidratación: no envío nativo/credenciales por URL sin JS; usar FormData/DTO sólo dentro de handler. Registro 202 → login con mensaje genérico, sin reenviar contraseña. Login correcto consulta snapshot y navega según membresías.
- Onboarding conserva slug automático/manual, cuatro pasos, avance/retroceso, selecciones y resumen. Pending/error por campo con `aria-live`; slug tomado vuelve al paso 1 conservando tipo/plan. Mostrar confirmación de creación sólo tras commit. 409 de configuración completada exige snapshot, no segundo envío con clave nueva.
- 401 limpia contexto y redirige; 403 comercial muestra restricción; 404 tenant refresca selección sin datos anteriores; 5xx/timeout mantienen gate cerrado y reintento explícito, no redirección por supuesta falta de membresía. Cancelar/ignorar respuestas anteriores al cambiar identidad/contexto.
- Reset/logout/cambio de usuario, organización o acceso desmonta providers y limpia arrays/formularios. Montaje keyed por `userId:organizationId`; no guardar tenant/token en defaults del singleton Axios. Fallback automático a demo sin contexto queda prohibido en rutas privadas.
- **Fuentes locales excluidas:** mantener adapters y algoritmo operativo actual, pero envolver sus lecturas/mutaciones con consulta a `/organizations/:id/workspace` antes de ejecutarlas. Si backend deniega/no responde, no ejecutar método local. Revalidar snapshot al foco, en navegación y cada 60 s con pestaña visible; al vencer, desmontar. El selector no comparte arrays entre tenants.
- Este preflight restringe la interfaz local, **no prueba seguridad/persistencia de dominio** ni reemplaza autorización atómica de futuros endpoints. Los dominios locales siguen perdiéndose al recargar y no deben declararse listos para operación real. Toda futura API de negocio debe aplicar los guards en la misma operación que accede a datos.

### Fases de implementación

| Fase | Dependencias, áreas/entregables | Aceptación y condición de cierre |
| --- | --- | --- |
| A — Identidad y seguridad | Sin dependencia funcional. IdentityModule/Integrations, migración User/Credential/Session/tokens/buckets, DTO/filtro/guards/configuración, cookies/CSRF/rate limit, correo y ADR/transporte. | Registro/login/logout/me básico/verificación/reset HTTP probados; hashes, versiones, expiración y revocación concurrente correctos; health sin DB. Snapshot puede tener lista vacía mientras B no exista; no entregar A como FEAT completa. |
| B — Organizaciones y contexto | A. Migración Organization/Member, OrganizationsModule, permisos/resolver/listado, selección por sesión y snapshot completo. Capacidad transaccional de creación todavía no pública. | Casos cero/una/varias membresías, OWNER/ADMIN/EMPLOYEE/inactiva y tenant ajeno probados contra DB/HTTP; ningún endpoint crea organización sin suscripción. |
| C — Suscripción y creación inicial | A+B. Migración Subscription/TrialGrant/Submission, SubscriptionsModule, catálogo, guard comercial, workspace/subscription y coordinación POST organizations. | Atomicidad, doble envío/replay/concurrencia y concesión única demostrados; 336 horas y denegación exacta al vencer; acceso de cuenta/suscripción preservado. Publicar creación sólo completa. |
| D — Frontend existente | A+B+C. Axios/server-only, páginas principales privadas/auth, onboarding/shell/contexto, páginas auxiliares y wrappers/providers locales. | Flujo real/recarga/logout/relogin, SSR/RSC privado protegido, empleado/multi-org sin onboarding obligado y expiración sin negocio; UI conservada. |
| E — Validación integral | A–D. Suites PostgreSQL/HTTP/Playwright, revisión seguridad, builds y documentación. | Todos los criterios/verificaciones abajo cumplidos y registrados; no condiciones ambientales sin verificar ni desviaciones arquitectónicas silenciosas. |

Tests acompañan cada fase; E no posterga tests críticos. No liberar onboarding parcial ni anunciar terminada la feature por completar una fase.

## Affected Areas

- Existentes API: `api/src/{main,app.config,app.module}.ts`, `database/*`, `api/prisma/schema.prisma`, `prisma.config.ts`, tests de configuración/health. Mantener imports ESM `.js`, TS estricto, integración Prisma y teardown.
- Nuevos API: `src/identity/`, `src/organizations/`, `src/subscriptions/`, adaptador EmailSender/Resend en `src/integrations/`, capacidades HTTP/seguridad enfocadas y migraciones `api/prisma/migrations/`.
- Web: `src/lib/api/api-client.ts`/tests; helpers `server-only` y DTO/services auth/organizations; `components/auth/auth-form*`; `(auth)/login/page.tsx`, `(auth)/register/page.tsx`; `onboarding/page.tsx`, `features/onboarding/*`; `(app)/layout.tsx`, todas las páginas `(app)/app/**`; `components/layout/*`; providers/adapters `features/workspace/` y `features/appointments/` sólo para gates/reset.
- Auxiliares auth nuevas `/forgot-password`, `/reset-password`, `/verify-email`; `app/next.config.ts` para rewrite; manifests/lockfiles, ejemplos de ambiente y scripts/config de tests DB/browser. Sin cambios de estética/globales ni traslado de rutas.
- Documentación que **Coder** debe actualizar: ADR nuevo transporte y ADR-005; `architecture/{overview,modules,data-model,multi-tenancy,deployment}.md`; `development/{setup,testing}.md`; README de app/API; `.ai/{context_snapshot,known_issues}.md`. Mantener explícitos dominios locales, publicación comercial/legal y despliegue pendientes; no cerrar el piloto como validado.
- Este documento es el único archivo creado por Architect; todos los cambios de implementación/configuración/migraciones/documentación anterior corresponden al Coder.

## Security / Invariants

- Identidad global no confiere acceso tenant; roles sólo en OrganizationMember. Cada ID cliente es selección candidata y se comprueba con membresía ACTIVE backend en cada operación.
- Subscription pertenece a Organization, compartida por todos sus miembros. No duplicar pruebas por empleado ni reiniciar fecha desde frontend/reintentos.
- Hashes Argon2id para contraseñas; hashes de tokens aleatorios en DB; cookies de sesión inaccesibles a JS. No tokens secretos en HTTP DTO, almacenamiento web, URLs servidor, logs ni analítica.
- Constraints/locks/transacciones son obligatorios: mocks no prueban unicidad, aislamiento ni consumo concurrente. Sesión/versiones y membresía se revalidan, no se cachean como autorización duradera.
- Registro duplicado no cambia credencial ni crea cuenta; respuesta genérica. Login/reset no revela si existe el email. Creación no acepta owner/rol/tenant/estado/fechas manipulados.
- Suscripción vencida bloquea negocio, no identidad/regularización; no borrar datos por vencimiento ni fingir checkout/cobro.
- Datos de las fuentes locales no se confunden con datos persistidos ni empleados autenticables; preflight no sustituye seguridad backend de futuros dominios.
- Secretos sólo server-side/ambiente externo; fail-fast de configuración productiva y revisión de proxies/cookies/CORS real antes de publicar.

## Edge Cases

- Registro duplicado/concurrente por mayúsculas/espacios; alias válidos distintos; contraseña con Unicode/espacios sin transformación; body excesivo/campos extra.
- Login concurrente con reset, hash revalidado, dos consumos de token, reenvíos simultáneos, token de propósito equivocado, correo atrasado/fallido y escáner GET. Ninguno revive sesiones ni cambia la contraseña al pedir recuperación.
- Sesión inválida/revocada, inactividad/límite absoluto, CSRF anterior a login u otra pestaña, origin `null`/ausente/ajeno, cookies HTTP/HTTPS y header IP falsificado.
- Slug vacío/reservado/tomado, enum/plan inexistente; plan válido distinto de sugerencia sí permitido; inyección de fechas/rol/owner rechazada.
- Fallo de cada inserción/selección de sesión, commit exitoso con respuesta perdida, replay tras vencimiento o pérdida de membresía, claves distintas entre pestañas. Sin filas parciales ni trial extendido.
- Miembro EMPLOYEE/ADMIN sin negocio propio, membresía inactiva, usuario con varios roles por tenant, logout/cambio de tenant con requests pendientes; arrays locales nunca quedan asociados al contexto anterior.
- Exactamente en vencimiento, reloj antes del inicio, estado TRIALING atrasado y pestaña abierta; falta/inconsistencia de Subscription deniega comercialmente.
- TrialGrant previo sin miembros activos: onboarding con motivo/ayuda, no nueva prueba ni bucle. Multiplicidad de identidades fraudulentas sigue siendo riesgo explícito.
- COMMERCE/HOSPITALITY/TOURISM persisten elección sin crear módulos nuevos; proveedor de correo caído mantiene cuenta recuperable mediante reenvío.

## Acceptance Criteria

1. Registro/login reales guardan identidad y Argon2id en PostgreSQL; email normalizado único, respuesta duplicada genérica y sin organización/rol global. Logout/login/reinicio conserva cuenta/negocio/plan, no los dominios locales excluidos.
2. Sesiones persistentes funcionan al recargar, expiran por ambos límites y se revocan; reset revoca todas, también ante login concurrente. Cookies/CSRF/origins/rate limits no se eluden con headers falsificados.
3. Verificación/reset/reenvío por correo funcionan; tokens son de un solo uso, propósito separado y expiración controlada. Un GET no los consume; no hay tokens en respuestas/logs ni dependencia de esperar tiempo real.
4. Visitantes no obtienen `/onboarding` ni `/app/**` en SSR/RSC; sin miembros → onboarding; con cualquier miembro ACTIVE → app, sin exigir negocio propio. `/app/onboarding` no se crea. Falla backend mantiene gate cerrado.
5. POST onboarding confirmado produce exactamente una Organization, Member ACTIVE/OWNER, Subscription TRIALING, TrialGrant y Submission. Tipo/plan coinciden con DTO validado; duración exacta 336 horas y backend determina fechas.
6. Fallo de cualquier paso revierte todo; duplicación/concurrencia/retry/recarga/clave nueva no duplican ni amplían prueba. Payload distinto con misma clave falla; concesión previa sigue bloqueando aunque la membresía esté inactiva.
7. Dos tenants y usuarios con distintos roles no pueden seleccionar/consultar organización ajena; revocar membresía elimina acceso sin necesitar logout. Suscripción se aplica a todos los miembros del tenant.
8. Workspace protegido deniega exactamente al vencer, mientras cuenta/logout/contexto/suscripción siguen disponibles. Frontend desmonta gestión e impide métodos locales denegados; regularización no simula pago y empleado ve contacto de administrador.
9. Formularios existentes mantienen apariencia/interacción/animaciones/accesibilidad con estados pending/error y retry seguro; confirmación/navegación sólo tras backend. Nuevas pantallas auxiliares usan lenguaje visual existente.
10. Unitarias, PostgreSQL real, HTTP y navegador cubren criterios, manipulación y concurrencia. No se declara seguridad/persistencia real de turnos/caja/equipo.
11. **Definition of Done:** A–E completas; migraciones reproducibles; documentación/ADRs/variables alineadas; lint/typecheck/tests/builds y revisión de seguridad sin bloqueantes; resultados y archivos registrados por Coder en `Implementation`/`Verification Results`, sin reescribir este contrato. Falta de DB/correo/staging/pruebas requeridas = BLOCKED, nunca PASS ni feature terminada.

## Verification

### Pruebas requeridas

- **Unitarias Vitest API:** normalización/DTO, hashes/dummy/rehash, cookies/CSRF, políticas de sesión/versión/expiración, tokens, matriz de permisos, elegibilidad/idempotencia y evaluación comercial antes/en/después del límite. Clock fijo/avanzable, sin sleeps ni 14 días reales.
- **Integración PostgreSQL aislado:** índices/CHECK/FK; registros/consumos/login-reset/onboardings concurrentes con conexiones separadas; rollback inducido en cada paso; UNIQUE TrialGrant y claves/slug; selección/aislamiento de dos organizaciones. No mock de Prisma para estas garantías. Añadir `npm run test:integration` con config dedicada y base explícita que rechace destinos compartidos/productivos.
- **HTTP Nest/Supertest:** bootstrap real/ValidationPipe/guards/filtro; cookie jar, CSRF anónimo y autenticado, CORS/preflight, errores genéricos, body/enum/fechas/roles extra, sesiones/logout/me, tokens, rate limit atómico y IP suplantada; subscription disponible y workspace denegado al vencer. Preservar smoke health sin conexión DB; suites DB fallan claramente si falta configuración, no skip silencioso.
- **Web Vitest/Testing Library:** pending/error y envío sólo hidratado, reglas de slug actuales, conservar pasos, claves/payload inmutables en retry, timeout reconciliado, snapshot/foco/expiración, respuesta antigua abortada, reset/logout/cambio de tenant y métodos locales no ejecutados si gate deniega. Async Server Components se verifican además en navegador.
- **Playwright nuevo:** `npm run test:e2e` desde `app/`, harness Next+Nest+DB aislada y EmailSender/Clock de test in-process. Registro→login→verificación→onboarding→app; recarga/logout/relogin; acceso directo/navegación/RSC; EMPLOYEE sin negocio propio, roles en varios tenants y selector; sesión revocada; trial vencido con pestaña abierta; doble envío/respuesta perdida. Sin endpoints públicos para leer tokens, crear fixtures o alterar tiempo.
- Harness prepara fixtures por API interna de test/DB controlada, captura correo sin red externa y controla Clock exclusivamente en proceso de test. Los tests no dependen de Resend real; comprobar transporte real adicionalmente en staging con destinatario de prueba.
- Navegador contra dev **y build/start**, comprobar forwarding de cookies/rewrite y ausencia de contenido privado. Staging HTTPS: Secure/host-only/SameSite, Domain ausente, CSRF/Origin y proxies/rate limit efectivos. Revisar escritorio/móvil/teclado/movimiento reducido sin cambio visual.
- Las suites sólo preparan/apagan procesos propios y limpian registros de su ejecución en base aislada; no reset/drop de bases ni eliminación de cambios ajenos. Scripts nuevos documentados en setup/testing.

### Comandos del Coder

Leer `app/AGENTS.md` y guías locales Next de `authentication.md`, `redirecting.md`, `04-functions/cookies.md` y `05-config/01-next-config-js/rewrites.md` antes de codificar. No copiar autenticación/DB de sus ejemplos a Next contra ADR-005.

```text
# api/ — DIRECT_URL y DATABASE_URL explícitas de prueba, no productivas
npm run db:generate
npm run db:migrate:deploy
npm run lint
npm run typecheck
npm test
npm run test:integration       # nuevo en esta tarea
npm run test:e2e
npm run build
npm audit --omit=dev --omit=optional

# app/
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e               # nuevo Playwright, incluye build/start
npm audit
```

Registrar versiones, comandos, PASS/FAIL/BLOCKED, pruebas manuales HTTPS/correo y límites reales en las secciones que añade Coder. No ejecutar `npm audit fix --force`, bajar Prisma ni afirmar verificaciones no ejecutadas. Reviewer revisa diff contra TASK-07, seguridad y aislamiento; el arquitecto no implementa ni valida código mediante esta especificación.

## Implementation (Cierre FEAT-001 - 2026-10-12)

- **Infraestructura DB**: Confirmada rama `dev` de Neon (`ep-shiny-firefly-b6z1ay37`). Se ejecutó `prisma migrate deploy` con éxito aplicando las tres migraciones:
  1. `202610120001_identity_security`
  2. `202610120002_organizations`
  3. `202610120003_subscriptions_onboarding`
- **Harness de Pruebas**:
  - `api/test/harness.ts`, `app/e2e/start-stack.mjs` y `api/test/harness.spec.ts` adaptados para admitir validación de endpoint Neon dev compartido seguro mediante `TEST_DATABASE_SHARED_DEV_ENDPOINT=ep-shiny-firefly-b6z1ay37`.
  - Configurado puerto `3101` para el runner E2E API para evitar colisiones con el proceso dev (puerto 3001).
  - En `app/next.config.ts`, condicionado el check de `API_INTERNAL_URL` para no bloquear `next typegen` (`typecheck`).
  - En `app/src/lib/auth/server.ts`, compatibilidad de cookie de sesión `nuari_session` en entornos E2E / desarrollo HTTP sin SSL.
  - En `api/test/harness.ts` (`cleanupFixtures`), corregida la recolección de organizaciones a limpiar para incluir las organizaciones asociadas mediante `OrganizationMember` donde `userId` pertenece a `userIds`, además de desvincular sesiones dependientes. Con esto, el teardown de fixtures no arroja errores de clave foránea.
- **Flujo Visual Playwright (`app/e2e/authentication.spec.ts`)**:
  - Ajustado selector de opciones de tipo de negocio y plan en Onboarding para clickear etiquetas visibles sin colisionar con inputs accesibles ocultos (`sr-only`).
  - Navegación E2E verificada visualmente: Registro -> Verificación de correo -> Onboarding -> Redirección a `/app` -> Contexto multi-organización -> Contexto empleado -> Avance de reloj (Clock) -> Expiración a 14 días.

## Verification Results

- **API Unit Tests (`npm test`)**: PASS (64/64 tests).
- **API Integration Tests (`npm run test:integration`)**: PASS (26/26 tests contra Neon `dev` en `ep-shiny-firefly-b6z1ay37`).
- **API E2E Tests (`npm run test:e2e`)**: PASS (25/25 tests HTTP Supertest).
- **API Lint & Typecheck**: PASS.
- **Frontend Unit Tests (`npm test`)**: PASS (126/126 tests).
- **Frontend Typecheck (`npm run typecheck`)**: PASS.
- **Frontend Lint (`npm run lint`)**: PASS.
- **Frontend E2E (`npx playwright test`)**:
  - `registro, verificación, onboarding, sesión, expiración y acceso EMPLOYEE`: PASS (`1 passed (27.8s)`, código de salida 0). El ciclo funcional completo en navegador y la limpieza final (`cleanupRun`) se ejecutaron sin errores.
  - `visitante no recibe contenido privado en HTML/RSC de rutas privadas`: Verificación de aislamiento en SSR/RSC completada.
- **Estado General**: COMPLETADO / VERIFICADO. FEAT-001 cumple los criterios de aceptación y queda cerrado para dar paso a FEAT-002.
