# TASK-06 — FEAT-001: Identidad, organizaciones y prueba inicial

## Goal

Conectar las interfaces existentes con PostgreSQL y NestJS para completar registro → login → `/onboarding` → creación de organización, membresía OWNER y prueba de 14 días → `/app`. Implementar sesiones persistentes, verificación/recuperación de credenciales y autorización multi-tenant, sin rediseñar las vistas.

## Context

- Estado inspeccionado: Next.js 16.3.3/React 19 en `app/`; NestJS 12, ESM, Prisma 7/PostgreSQL en `api/`; proyectos npm independientes. La API sólo expone `GET /api/health`.
- `api/prisma/schema.prisma` sólo tiene generator/datasource; no existen modelos ni migraciones de dominio. Reutilizar `DatabaseModule`, `PrismaService`, configuración pooled/direct y `configureApp`; generar el cliente antes de compilar.
- Registro/login son `AuthForm`: registro navega sin enviar datos; login muestra un aviso. `/onboarding` tiene cuatro pasos locales y un CTA que sólo navega a `/app`. No hay sesiones, guards, contratos de errores ni logout.
- El catálogo del onboarding ya usa `SERVICES | COMMERCE | HOSPITALITY` y `BASIC | PRO | BUSINESS | TOURISM`. No hay definiciones comerciales backend. Landing y onboarding muestran catálogos/precios distintos: no inferir precios, cupos ni prestaciones autoritativas de esos textos.
- Turnero, Servicios, Clientes, Caja y Equipo siguen usando fuentes locales no persistentes. FEAT-001 persiste identidad, organizaciones y suscripciones, **no** esos dominios ni sus datos. `TeamMember` no equivale a una membresía autenticable.
- Aplican [ADR-001](../architecture/decisions/ADR-001-modular-monolith.md), [ADR-002](../architecture/decisions/ADR-002-managed-postgresql.md), [ADR-003](../architecture/decisions/ADR-003-tenant-isolation.md), [ADR-004](../architecture/decisions/ADR-004-living-documentation.md) y [ADR-005](../architecture/decisions/ADR-005-custom-authentication.md).
- Conflicto documental: `modules.md` atribuye membresías a Identity and Access; ADR-005 las asigna a Organizations. Seguir ADR-005 y corregir `modules.md` durante implementación. Usar `OrganizationMember` como nombre físico y Membership como concepto.
- Esta solicitud aprueba el corte de identidad y prueba SaaS; no aprueba los módulos anunciados ni reemplaza la validación pendiente del piloto. Supera las exclusiones históricas de TASK-05 únicamente para conectar/proteger su interfaz.

## Requirements

1. Registrar identidad global con nombre, email normalizado y contraseña; no crear organización ni rol global durante el registro. Iniciar/cerrar sesión y consultar al usuario actual.
2. Verificar correo, reenviar verificación y recuperar/restablecer contraseña con tokens de un solo uso. Permitir login sin correo verificado; exigir verificación para **crear una organización con prueba**, no para acceder por una membresía ya existente.
3. Admitir múltiples membresías por identidad con roles `OWNER`, `ADMIN`, `EMPLOYEE` y estado activo/inactivo. Un invitado con membresía activa entra a `/app` aunque nunca haya creado una organización propia.
4. Crear desde `/onboarding` organización + OWNER + suscripción TRIALING + registro de concesión de prueba, atómicamente e idempotentemente. Este endpoint es sólo para creación inicial por usuarios sin membresías activas; no implementar creación de organizaciones adicionales.
5. La prueba dura exactamente `14 * 24 * 60 * 60` segundos, sin tarjeta/cobro automático, desde la creación efectiva en backend. Un usuario sólo puede recibir una concesión de prueba como creador durante la vida de su cuenta.
6. Evaluar acceso comercial en backend en cada operación protegida. Tras vencer, conservar datos, sesión, consulta de cuenta, logout y consulta/gestión del estado de suscripción; bloquear funcionalidades de negocio.
7. Conectar formularios conservando estilos, tarjetas, animaciones, teclado y transiciones. Agregar únicamente controles/estados funcionales necesarios: loading, errores, verificación, recuperación, logout, contexto organizacional y restricción comercial.
8. No implementar JWT principal, proveedores de identidad, invitaciones completas, administración de personal/roles, pagos, checkout, renovaciones, facturación, webhooks, RLS ni persistencia del Turnero.

## Architecture

### Límites y capacidades públicas

- `IdentityModule`: usuarios, credenciales, sesiones y tokens; guard de sesión global con excepciones públicas explícitas. Identidad no requiere tenant. Exportar capacidades para identificar usuario y gestionar sesión, no repositorios.
- `OrganizationsModule`: organizaciones, `OrganizationMember`, resolución de membresía/contexto tenant, permisos y caso de uso de creación inicial. Exportar `resolveTenant(userId, organizationId)`, listado de membresías activas y creación inicial.
- `SubscriptionsModule`: concesiones de prueba, suscripción por organización, cálculo temporal y `requireBusinessAccess(tenant, now)`. No depende de un proveedor de pagos.
- `HttpAccessModule` compone las capacidades públicas de esos módulos: arma `AccessSnapshot`, aloja `/auth/me` y `/auth/active-organization`, y registra guards tenant/permiso/comercial mediante metadata explícita. Identity no importa Organizations/Subscriptions; Subscriptions no importa Organizations; Organizations puede consumir Identity/Subscriptions. Evitar ciclos de módulos/`forwardRef` y duplicación de resolución de acceso.
- La creación inicial es un caso de uso coordinador de Organizations. Pasar un contexto transaccional explícito a las capacidades públicas de suscripción y selección de organización de la sesión; no consultar tablas internas de otro módulo arbitrariamente ni abrir transacciones independientes.
- Guard/flujo de acceso: sesión → membresía activa → permiso → acceso comercial cuando corresponda. Un permiso nunca se deriva sólo de autenticación o del rol enviado por cliente.
- Introducir `Clock` inyectable en casos de uso de tokens/sesiones/suscripciones. Producción usa tiempo UTC del servidor; tests usan reloj fijo. No usar fecha del navegador como autoridad.

### Transporte y renderizado privado

- Mantener NestJS como única autoridad. Registrar un ADR nuevo para transporte same-origin y concretar seguridad en ADR-005; usar el próximo número ADR disponible al implementar.
- Browser usa Axios centralizado con `baseURL=/api` y `withCredentials: true`. Next realiza un **rewrite de transporte** `/api/:path*` hacia `${API_INTERNAL_URL}/api/:path*`; no añadir autenticación ni lógica de negocio en Route Handlers/Server Actions.
- `API_INTERNAL_URL` es origen HTTP(S) server-only (local: `http://localhost:3001`; producción HTTPS). El rewrite conserva path, métodos, Origin y todos los `Set-Cookie`; comprobarlo en navegador local y build de producción. Mantener `turbopack.root`.
- Cookie host-only emitida por la respuesta reenviada queda en el host web; así llega a Next y no requiere `Domain` compartido ni cookies de terceros. No soportar como modo alternativo browser→API cross-site en esta feature.
- Helpers `server-only` consultan Nest directamente con `fetch`, `cache: "no-store"`, reenviando **sólo** la cookie de sesión necesaria. No usar el singleton Axios para estado request-specific ni copiar el Cookie completo. SSR no crea/rota cookies ni propaga cookies mediante render.
- Validar sesión/contexto en cada página privada y cerca de los datos; no confiar sólo en layout ni en la presencia de cookie. Usar `await cookies()` de Next 16. Evitar RSC payload privado antes del gate; `proxy.ts` es opcional y sólo optimista. No crear `middleware.ts`.
- API privada y respuestas de sesión: `Cache-Control: no-store`. No cache compartida, ISR ni memoización entre requests de autorización. No absorber las excepciones de `redirect()`.
- `WEB_ORIGIN` debe ser un origen exacto HTTP(S), sin path/query/fragment ni comodines; CORS con credenciales sólo para ese origen. Orígenes preview requieren ambiente/configuración propios. La comprobación CSRF no se sustituye por CORS.

### Modelo y migraciones

IDs UUID generados en backend; timestamps `timestamptz`, UTC, `createdAt`/`updatedAt` donde se indique. No exponer registros Prisma directamente. Enums cerrados, sin strings arbitrarios.

| Entidad | Campos y constraints obligatorios |
| --- | --- |
| `User` | `id`, `name`, `email` normalizado UNIQUE, `emailVerifiedAt?`, `createdAt`, `updatedAt`. Sin organización, rol ni booleano `onboardingCompleted`. |
| `UserCredential` | `userId` PK/FK UNIQUE, `passwordHash`, `passwordChangedAt`, `updatedAt`. Una credencial de contraseña por usuario. |
| `Session` | `id`, `userId`, `tokenHash` UNIQUE, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt?`, `activeOrganizationId?`. Índices `(userId, revokedAt)` y `expiresAt`. La organización seleccionada es preferencia, no autorización. |
| `EmailVerificationToken` | `id`, `userId`, `tokenHash` UNIQUE, `createdAt`, `expiresAt`, `consumedAt?`. Índices `(userId, consumedAt)` y `expiresAt`. |
| `PasswordResetToken` | Misma estructura de token, separado por propósito; no intercambiarlo con verificación/sesión. |
| `Organization` | `id`, `name`, `slug` UNIQUE global normalizado, `businessType`, `createdAt`, `updatedAt`. Sin dueño global embebido; propietario mediante membresía. |
| `OrganizationMember` | `id`, `userId`, `organizationId`, `role`, `status`, `createdAt`, `updatedAt`. UNIQUE `(userId, organizationId)`; índices `(userId, status)` y `(organizationId, status)`. Roles OWNER/ADMIN/EMPLOYEE; estados ACTIVE/INACTIVE. |
| `Subscription` | `id`, `organizationId` UNIQUE, `planCode`, `status`, `trialStartedAt`, `trialEndsAt`, `paidThrough?`, `createdAt`, `updatedAt`. Índice `(status, trialEndsAt)`. Estados TRIALING/EXPIRED/ACTIVE/PAST_DUE/CANCELED. Una suscripción vigente por organización. |
| `TrialGrant` | `id`, `userId` UNIQUE, `organizationId` UNIQUE, `grantedAt`; impide repetir prueba aunque se desactive/elimine una membresía. Sin endpoints de eliminación. |
| `OnboardingSubmission` | `id`, `userId`, `key` UUID, `requestHash`, `organizationId` UNIQUE, `createdAt`. UNIQUE `(userId, key)`. Sólo se persisten resultados exitosos, en la misma transacción. |

- `BusinessType` y `PlanCode` reutilizan exactamente los valores del catálogo existente. Planes se representan como enum `PlanCode`, **no** como una tabla de precios duplicada: esta feature no tiene tarifas ni catálogo administrable. `GET /subscription-plans` publica códigos admitidos y duración, no prestaciones/precios sin aprobar.
- Relaciones: User 1:1 Credential; User 1:N Session/Token/Member; Organization 1:N Member y 1:1 Subscription/TrialGrant. Cascada sólo de User a credenciales/sesiones/tokens. Membership y TrialGrant usan FK RESTRICT hacia User/Organization; Subscription y OnboardingSubmission RESTRICT hacia Organization; organización seleccionada en Session usa SET NULL. No implementar borrado de cuentas/organizaciones.
- Constraints SQL en migraciones: email trim/lowercase; slug canónico; diferencia `trialEndsAt - trialStartedAt = interval '336 hours'` (duración absoluta, sin DST); `grantedAt = trialStartedAt` garantizado por el caso de uso; fechas de expiración posteriores a creación; ACTIVE requiere `paidThrough` no nulo. No duplicar plan en Organization ni trial en User.
- Preparar migraciones aditivas y versionadas (identidad, organizaciones, suscripciones/idempotencia), preservando Prisma 7 y generator actual. Aplicar sobre PostgreSQL vacío aislado y comprobar deploy desde cero. No usar `db push`, resets ni bases compartidas/productivas para tests; rollback de despliegue con backup/procedimiento documentado, no borrado automático de datos.
- Invitaciones futuras: reservar contrato conceptual `OrganizationInvitation(organizationId, normalizedEmail, role, tokenHash, expiresAt, acceptedAt, invitedByMembershipId)`; emisión/aceptación requerirá permisos y consumo transaccional. **No crear tabla/endpoints/UI de invitaciones ahora**. Nada en User o Credential debe impedir esa ampliación.

### Validación y contratos HTTP

Prefijo Nest vigente `/api`; la tabla muestra paths relativos a ese prefijo. JSON con DTO específicos. Éxitos retornan DTO sin envelope salvo donde se indica. Error uniforme `{ code, message, fieldErrors?: Record<string,string[]> }`; mensajes públicos seguros, sin SQL, stack, hashes ni tokens. Validación global con whitelist + rechazo de campos desconocidos; sin coerción implícita permisiva.

- Nombre de usuario/negocio: trim, 1–100 caracteres; combinar `firstName`/`lastName` existentes en un único `name` para registro, sin rediseñar formulario.
- Email: trim + lowercase, válido, máximo 254 caracteres; no eliminar puntos ni sufijos `+`, ni asumir alias equivalentes.
- Contraseña: 12–128 caracteres, máximo 1024 bytes UTF-8, sin trim/normalización ni reglas arbitrarias de composición. Actualizar ayuda/validación web; el placeholder actual de 8 caracteres no constituye política backend.
- Slug: lowercase canónico, 3–63 caracteres, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`; rechazar formato no canónico. Reservar `api`, `app`, `login`, `register`, `onboarding`, `admin`, `www`, `support`, `nuari`. La unicidad en DB resuelve colisiones; no crear una URL pública de negocio.
- Rechazar `userId`, `ownerId`, `role`, `status`, fechas de trial, `paidThrough` y cualquier campo no listado en creación. Todos los planes son seleccionables con todos los tipos; sugerencias actuales son sólo UX.

| Método/path | Acceso y request | Resultado |
| --- | --- | --- |
| `GET /health` | Público | Conservar `{status:"ok"}`; no requiere DB. |
| `GET /auth/csrf` | Público; inicialización same-origin | `200 {csrfToken}` y cookie CSRF; no retorna token de sesión. |
| `POST /auth/register` | Público + CSRF; `{name,email,password}` | `202 {message}` genérico tanto para cuenta nueva como email existente. Cuenta nueva y credencial se crean atómicamente; solicitar envío de verificación. No inicia sesión. |
| `POST /auth/login` | Público + CSRF; `{email,password}` | `200 {user,csrfToken}` + cookie nueva de sesión/CSRF. `401 INVALID_CREDENTIALS` idéntico para email inexistente/contraseña errónea. |
| `POST /auth/logout` | CSRF; admite sesión ausente/expirada | `204`, revoca sesión actual y limpia cookies con mismos atributos. Idempotente, no revoca otras sesiones. |
| `GET /auth/me` | Sesión | `200 AccessSnapshot`; `401 UNAUTHENTICATED` si falta/vence/revoca. |
| `POST /auth/active-organization` | Sesión + CSRF; `{organizationId}` | `200 AccessSnapshot`; validar membresía ACTIVE en Organizations antes de guardar selección en Session. |
| `POST /auth/email-verification/request` | Sesión + CSRF; body vacío | `202 {message}` genérico; envía sólo al email de la identidad actual; ya verificado no produce otro token. |
| `POST /auth/email-verification/confirm` | Público + CSRF; `{token}` | `204`; inválido/consumido/expirado: `400 INVALID_TOKEN`, sin revelar identidad. No login automático. |
| `POST /auth/password-reset/request` | Público + CSRF; `{email}` | `202 {message}` idéntico exista o no; no cambiar contraseña ni revocar sesiones al solicitar. |
| `POST /auth/password-reset/confirm` | Público + CSRF; `{token,password}` | `204`; cambio + consumo + revocación de todas las sesiones atómicos. `400 INVALID_TOKEN` uniforme. Limpiar cookie actual; luego login explícito. |
| `GET /subscription-plans` | Sesión | `200 {plans:[{code}],trialDays:14}`; catálogo estable de cuatro códigos. |
| `POST /organizations` | Sesión + CSRF + email verificado; `Idempotency-Key` UUID; `{name,slug,businessType,planCode}` | `201 {organization,membership,subscription}`; repetición idéntica exitosa: `200` con mismos IDs/fechas. |
| `GET /organizations/:id/subscription` | Membresía ACTIVE, cualquier rol; no exige trial activo | `200 {subscription,access}` con DTO público. No modificar/activar el plan por esta ruta. |
| `GET /organizations/:id/business-access` | Sesión + tenant + permiso `business:access` + acceso comercial | `200 {organizationId,allowed:true,evaluatedAt,validUntil}`; mínimo endpoint real protegido por el guard comercial, usado por adaptadores locales y tests. |

`AccessSnapshot` contiene:

```text
user: { id, name, email, emailVerifiedAt }
memberships: [{ id, role, organization: { id, name, slug, businessType } }]
activeOrganizationId: UUID | null
access: null | { businessAllowed, reason, validUntil, canManageSubscription }
onboarding: { canCreateOrganization, reason }
```

Sólo listar membresías activas. `reason` comercial: `TRIAL_ACTIVE | PAID_ACTIVE | TRIAL_EXPIRED | SUBSCRIPTION_INACTIVE`; onboarding: `ELIGIBLE | EMAIL_UNVERIFIED | HAS_MEMBERSHIP | TRIAL_ALREADY_USED`. No enviar credenciales, datos de otras personas ni `tokenHash`. Fechas ISO-8601 UTC. `SubscriptionDTO`: id, organizationId, planCode, status efectivo y fechas públicas de trial/paidThrough.

Códigos mínimos: `400 VALIDATION_ERROR/INVALID_TOKEN/INVALID_IDEMPOTENCY_KEY`, `401 UNAUTHENTICATED/INVALID_CREDENTIALS`, `403 CSRF_INVALID/EMAIL_UNVERIFIED/TRIAL_ALREADY_USED/SUBSCRIPTION_REQUIRED/PERMISSION_DENIED`, `404 ORGANIZATION_NOT_FOUND` también para organización ajena o membresía inactiva, `409 SLUG_TAKEN/ONBOARDING_ALREADY_COMPLETED/IDEMPOTENCY_CONFLICT`, `429 RATE_LIMITED` + `Retry-After`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. No distinguir organización inexistente y no autorizada. No clasificar timeout/500 como sesión ausente o usuario sin membresía.

### Sesiones, credenciales y correo

- Argon2id: memoria mínima 19 MiB (`19456 KiB`), iteraciones 2, paralelismo 1, salt aleatorio mínimo 16 bytes; hash PHC completo en Credential. Usar adaptador con `argon2`, verificar y rehash cuando cambien parámetros. Email inexistente ejecuta verificación contra hash dummy con mismos parámetros; nunca comparar contraseñas en claro.
- Token de sesión: 32 bytes aleatorios base64url de `node:crypto`; DB almacena SHA-256 del token. Sólo cookie, nunca JSON, URL, logs, localStorage/sessionStorage o estado React. No reutilizar cookie prelogin: crear sesión nueva en cada login.
- Expiración absoluta 30 días e inactividad 7 días. Guard rechaza si `now >= expiresAt`, `now >= lastSeenAt + 7 días` o hay revocación; actualizar `lastSeenAt` en requests autenticados válidos. Cookie Max-Age hasta expiración absoluta; no extender ese límite con actividad/recarga. No hace falta cron para validar vencimiento.
- Producción: `__Host-nuari_session`, HttpOnly, Secure, SameSite=Lax, Path=/, sin Domain. Desarrollo HTTP: `nuari_session`, HttpOnly, Secure=false, SameSite=Lax, Path=/, sin Domain. Producción debe rechazar configuración HTTP/insegura. Aplicar mismos atributos al limpiar cookie.
- CSRF signed double-submit ligado a sesión: cookie HttpOnly `__Host-nuari_csrf` en producción (nombre sin prefijo en HTTP local), mismos atributos, TTL 1 hora. Serializar sólo nonce aleatorio, expiración y firma HMAC-SHA256; usar el hash de la cookie de sesión presentada como contexto de firma, nunca incluir ese hash en el token público (marcador anónimo cuando no hay cookie). Devolverlo como `csrfToken` desde `/auth/csrf` para enviarlo en `X-CSRF-Token`. Comparar header/cookie y validar firma, expiración y vínculo mediante comparación constante. Secret mínimo 32 bytes, distinto de SMTP/DB. Rotar cookie/token tras login; logout acepta ese vínculo aunque la sesión presentada haya vencido/revocado. Sólo login/logout escriben cookie de sesión; obtener CSRF no autentica ni renueva la sesión.
- En toda mutación exigir Origin exactamente WEB_ORIGIN, JSON (salvo body vacío), CSRF y límites de body (16 KiB). Rechazar Origin ausente/`null` y `Sec-Fetch-Site: cross-site`; clientes de test deben usar el contrato explícito. No emitir CSRF a Origin ajeno. Login/registro/reset también llevan CSRF para evitar login-CSRF.
- Frontend conserva CSRF sólo en memoria y lo pide al recargar. Ante CSRF inválido puede renovar y repetir **una vez**; para onboarding mantiene la misma clave/payload. No reintentos automáticos de otros errores ni bucles de interceptors.
- Tokens de verificación/reset: 32 bytes aleatorios, sólo SHA-256 en DB; TTL 24 horas y 30 minutos respectivamente. Nueva solicitud invalida tokens anteriores del mismo propósito; consumo condicional en transacción permite un único ganador. Bloquear la fila de credencial/usuario al iniciar sesión y resetear para evitar una sesión que sobreviva a un reset concurrente. Reset invalida todos los tokens de recuperación existentes.
- Correo vía capacidad `EmailSender` y adaptador SMTP TLS (`nodemailer`), sin proveedor de identidad ni cola distribuida. Persistir token antes de envío; realizar SMTP fuera de la transacción. Fallo SMTP no revierte cuenta ni devuelve secretos: respuesta genérica, log saneado y reenvío disponible. No prometer entrega garantizada/outbox en esta fase.
- Links construidos exclusivamente con WEB_ORIGIN: `/verify-email#token=...` y `/reset-password#token=...`. Páginas leen fragmento, retiran token de la URL y sólo lo envían por POST; GET nunca consume tokens (escáneres de correo). Sin analytics/recursos terceros y con `Referrer-Policy: no-referrer`. Agregar `/forgot-password`, `/reset-password`, `/verify-email` usando lenguaje visual existente; no mover las cinco rutas principales.

### Creación inicial, idempotencia y prueba

1. Normalizar/validar body y clave; obtener usuario/sesión únicamente del guard. Iniciar transacción PostgreSQL; bloquear fila User (`SELECT ... FOR UPDATE` parametrizado). Todas las creaciones iniciales pasan por ese lock.
2. Consultar `(userId,key)` antes de comprobar elegibilidad: si existe con mismo hash canónico, revalidar membresía ACTIVE en esa organización y devolver mismos IDs/fechas con estado comercial actual, sin reiniciar trial; si membresía ya no está activa, `404 ORGANIZATION_NOT_FOUND`; si payload cambia, `IDEMPOTENCY_CONFLICT`. No almacenar ni reproducir cookies ni una decisión de acceso antigua. La repetición no cambia una selección organizacional posterior de la sesión.
3. Para una nueva clave exigir email verificado, ninguna membresía ACTIVE y ningún TrialGrant previo. Con membresía existente, `ONBOARDING_ALREADY_COMPLETED`; con concesión previa pero sin membresías, `TRIAL_ALREADY_USED` (no repetir prueba).
4. Crear organización, miembro ACTIVE/OWNER, suscripción TRIALING y TrialGrant; usar un único `now` obtenido dentro de la transacción inmediatamente antes de insertar, no al abrir el formulario. `trialStartedAt=grantedAt=now`, `trialEndsAt=now+14 días`, `paidThrough=null`.
5. Guardar OnboardingSubmission con hash SHA-256 de los cuatro campos canónicos y seleccionar la organización en la sesión vigente, revalidada dentro de la transacción. Confirmar todo junto. Retornar éxito únicamente después del commit.
6. UNIQUE en slug/membresía/TrialGrant/submission es defensa final. Mapear conflictos esperables, rollback completo y reintentar de forma acotada errores transitorios de transacción (máximo 3 intentos), sin SMTP/efectos externos dentro del retry.

- Concurrencia misma clave/payload: una organización; misma clave/payload distinto: conflicto; claves diferentes del mismo usuario: sólo la primera creación prospera. Slug tomado por otro usuario no consume elegibilidad ni clave; puede corregirse y reintentarse.
- Frontend genera UUID al primer envío final, conserva clave/payload durante timeout/retry y la misma configuración; guarda ese intento pendiente en sessionStorage **sin tokens ni datos de identidad**, asociado al userId. Si cambia el payload tras fallo confirmado, generar clave nueva. Borrar intento tras confirmación/logout/cambio de identidad. Tras respuesta perdida, `/auth/me` permite encontrar la membresía; nunca crear de nuevo sólo porque no llegó respuesta.
- Una concesión única no evita múltiples identidades fraudulentas. Exigir correo verificado, rate limiting y registrar intentos/creaciones saneados; documentar este límite. No implementar bloqueo por pertenecer como empleado a organizaciones en prueba ni extender trials por cambios de plan/membresía.
- Acceso: TRIALING sólo si `trialStartedAt <= now < trialEndsAt`; ACTIVE sólo si `paidThrough > now`. EXPIRED/PAST_DUE/CANCELED bloquean negocio. En el límite exacto se deniega. Marcar TRIALING vencida como EXPIRED con actualización condicional al consultar, pero autorizar por fechas aunque esa actualización todavía no ocurra. No cron obligatorio ni endpoint público para activar ACTIVE.
- Guard comercial restringe lecturas **y** escrituras de negocio. Perfil, membresías/contexto, logout, recuperación/verificación y estado de suscripción quedan fuera del guard comercial, pero no del guard de sesión/tenant que corresponda.
- Todos los códigos de plan tienen el mismo control mínimo de trial en FEAT-001; no implementar cupos/features/precios deducidos de la UI. Los tipos de negocio no crean módulos nuevos. La futura integración de pagos actualizará la suscripción mediante capacidad autorizada y agregará sus entidades de pago sin cambiar la identidad/membresía.

### Permisos, navegación y frontend

| Capacidad mínima | OWNER | ADMIN | EMPLOYEE |
| --- | --- | --- | --- |
| Leer organización/estado de suscripción; acceder a negocio con suscripción habilitada | Sí | Sí | Sí |
| Gestionar futura contratación de la organización | Sí | Sí | No; mostrar contacto con administrador |
| Gestión avanzada de roles/invitaciones/personal | Fuera de alcance | Fuera de alcance | Fuera de alcance |

`business:access` no concede automáticamente permisos definitivos de Caja/Equipo ni administra roles. Es el permiso mínimo del corte; definir permisos de dominio en sus futuras tasks.

| Estado persistido | Comportamiento |
| --- | --- |
| Sin sesión | `/`, `/login`, `/register` públicos; `/onboarding` y `/app/**` redirigen a `/login` antes de render privado. |
| Sesión, cero membresías ACTIVE | `/app/**` → `/onboarding`; formulario disponible si elegible. Mostrar verificación pendiente o prueba ya utilizada sin loop ni creación automática. |
| Sesión y membresía ACTIVE, cualquier rol | `/login`, `/register`, `/onboarding` → `/app`; nunca exigir ser creador/OWNER ni completar onboarding propio. |
| Onboarding confirmado | Refrescar snapshot servidor y `router.replace('/app')`; no navegar por éxito optimista ni contar 14 días en cliente. |
| Organización con acceso comercial denegado | `/app` conserva shell mínimo con cuenta, logout, estado/plan/vencimiento y panel de regularización. Rutas de negocio → `/app`; no montar sus providers. Mostrar que contratación real aún no está disponible; no CTA que finja cobro. |
| Membresía seleccionada desactivada | Backend elige otra ACTIVE, si existe; si no, contexto null y `/onboarding` con motivo de elegibilidad. Nunca reutilizar datos del contexto anterior. |

- Selección activa persistida por **sesión**. `/auth/me` valida esa selección; fallback determinista por `createdAt` e `id` entre membresías activas. Selector discreto en shell sólo cuando hay varias; empleados pueden seleccionar únicamente sus organizaciones. No añadir dashboard por slug ni `/app/onboarding`.
- Tras registro 202 ir a `/login` con confirmación genérica; no auto-login ni envío de contraseña por URL. Tras login consultar snapshot y dirigir según membresía. Una persona sin correo verificado puede entrar por una membresía existente; sin membresías verá el onboarding con solicitud de verificación antes del envío final.
- No rediseñar `AuthForm`, tarjetas ni resumen. Añadir pending, bloqueo de doble submit, `aria-live`, errores por campo y restablecer controles tras fallo. Error de slug devuelve al paso correspondiente conservando el resto; timeout mantiene reintento idempotente. Un 409 de onboarding ya completado requiere nuevo snapshot.
- Loading/503/timeout mantienen gate cerrado con reintento explícito, no pantallas de negocio ni redirección como si no hubiera membresía. 401 limpia contexto y redirige a login; 403 comercial muestra restricción; 404 tenant refresca selección sin mostrar datos anteriores.
- Desmontar árbol operativo y limpiar fuentes/listados/formularios al logout, cambio de identidad/organización o pérdida de acceso. Montaje keyed por `userId:organizationId`; abortar/ignorar respuestas del contexto anterior. No escribir cookies ni tenant en defaults de Axios singleton.
- **Límite de los mocks:** mantener adapters locales, no trasladar sus arrays a PostgreSQL ni presentarlos como datos reales persistidos. En rutas autenticadas eliminar fallback automático a demo cuando falta contexto. Envolver métodos de fuentes locales (lecturas y mutaciones) con consulta a `/organizations/:id/business-access` antes de ejecutar; si falla, no ejecutar método local. Revalidar snapshot al foco y cada 60 segundos con pestaña visible, además de cada acción. Al vencer, desmontar providers.
- Este control de mocks demuestra el gate, no convierte JavaScript local en seguridad de datos persistidos. La defensa real reside en guard Nest y endpoints tenant-aware; toda futura API de dominio deberá aplicar esos guards en la misma operación que lee/escribe. Documentar que turnos/clientes/caja/equipo todavía se pierden al recargar y no están listos para operación real.

### Fases ejecutables

| Fase | Dependencias y áreas | Criterio de cierre |
| --- | --- | --- |
| A — Identidad/autenticación | Sin dependencia funcional. Schema/migración identidad, IdentityModule, bootstrap/DTO/errores, email adapter, cookies/CSRF/rate limiting; ADR y transporte same-origin. | Registro/login/logout/me/verificación/reset probados por HTTP; Argon2id, revocación, expiraciones y cookies verificadas. Health conserva funcionamiento sin DB. |
| B — Organizaciones | A. Schema/migración Organization/Member; OrganizationsModule, tenant resolver, permisos, selección/listado de membresías. Preparar capacidad transaccional de creación, sin publicar creación parcial. | Identidad con cero/una/varias membresías, OWNER/ADMIN/EMPLOYEE/inactiva y organización ajena cubiertos. No endpoints que creen organización sin suscripción. |
| C — Suscripción inicial | A+B. Schema/migración Subscription/TrialGrant/OnboardingSubmission, SubscriptionsModule y coordinación final de `POST /organizations`. | Atomicidad, reintentos/concurrencia, TRIALING 14 días y denegación exacta al vencer demostrados contra PostgreSQL. Endpoint de creación sólo se habilita completo. |
| D — Integración frontend | A+B+C. Axios, helpers server-only, rutas existentes, auth/onboarding/shell, páginas auxiliares, wrappers y gates de fuentes locales. | Recorrido real sin rediseño, SSR privado protegido, sesión tras recarga, selección de empleado/múltiples organizaciones y trial vencido sin negocio. |
| E — Validación integral | A–D. Integración DB, E2E HTTP/browser, documentación y revisión de seguridad. | Todos los criterios/verificaciones satisfechos; limitaciones declaradas y resultados registrados. |

No entregar una fase como feature completa ni publicar un onboarding que confirme éxito antes de implementar C. Añadir tests junto a cada fase; E integra y revisa, no posterga todas las pruebas.

## Affected Areas

- API existentes: `api/src/app.config.ts`, `main.ts`, `app.module.ts`, `database/prisma.service.ts`, `database/database.module.ts`, `api/prisma/schema.prisma`, `prisma.config.ts` y nuevas migraciones; mantener imports ESM `.js` y TypeScript estricto.
- API nuevas: `src/identity/`, `src/organizations/`, `src/subscriptions/`, capacidades HTTP/seguridad compartidas enfocadas y adaptador de correo en integraciones. Tests colocados y `api/test/` para PostgreSQL/HTTP.
- Web: `app/src/lib/api/api-client.ts` y tests, helpers auth server-only y DTO/services; `components/auth/auth-form.tsx` y tests; `(auth)/login/page.tsx`, `(auth)/register/page.tsx`, `onboarding/page.tsx`, `features/onboarding/*`, `(app)/layout.tsx`, todas las páginas `(app)/app/**`, `components/layout/*` y providers/adapters workspace/appointments para gates sin refactor de dominio.
- Nuevas páginas auxiliares `/forgot-password`, `/reset-password`, `/verify-email`; `app/next.config.ts` para rewrite, configuración Playwright y E2E browser. No cambiar estructura visual/rutas de `/`, `/register`, `/login`, `/onboarding`, `/app`.
- Configuración de implementación: manifests/lockfiles propios, ejemplos de ambiente y scripts para pruebas DB/browser. El arquitecto no modifica esos archivos; son trabajo del Coder.
- Documentación a actualizar por Coder: ADR de transporte, ADR-005, `architecture/{modules,data-model,multi-tenancy,deployment,overview}.md`, `development/{setup,testing}.md`, README afectados, `.ai/context_snapshot.md` y `.ai/known_issues.md`. Mantener discrepancia de precios/prestaciones y mocks como pendientes, no declararlos resueltos.

## Security / Invariants

- Ningún token/contraseña/hash/secret en respuestas públicas, logs o analítica. Sólo tokens de propósito explícito por correo y token CSRF en su contrato. No exponer stack de Prisma ni repetir input sensible en errores.
- `Organization` sigue siendo límite tenant; contexto siempre viene de Session + Membership ACTIVE. Queries por ID incluyen organización cuando son tenant-aware. No confiar en body/header de rol o propietario.
- Row locks, constraints y transacciones son obligatorios para consumo de tokens, creación y concesión única; tests con mocks no prueban esas garantías.
- Rate limiting con `@nestjs/throttler`, almacenamiento en memoria **sólo para despliegue inicial de una instancia Nest**: login 10/min/IP y 10/15min/email; registro 5/h/IP; reset request 10/h/IP y 3/h/email; resend 5/h/user; confirmaciones 10/15min/IP; creación 3/h/user; CSRF 60/min/IP. Emails como claves HMAC, mismo tratamiento para existentes/inexistentes; almacenamiento acotado y expiración de buckets. Distribución/múltiples réplicas requiere almacenamiento compartido antes del despliegue, no asumir protección global con memoria local.
- Límites se aplican antes del hash/SMTP. Configurar IP sólo desde proxy confiable explícito; no confiar en `X-Forwarded-For` arbitrario. Pruebas deben demostrar que falsificar esa cabecera no evita límites. Limitar concurrencia de hashing para que el endpoint no agote memoria.
- Dependencias de producción permitidas y justificadas en notas: `argon2` (ADR-005), `cookie-parser` (parsing cookies Express), `class-validator`/`class-transformer` (DTO ValidationPipe), `@nestjs/throttler` (rate limiting), `helmet` (headers seguros API), `nodemailer` (SMTP detrás de puerto). Usar `node:crypto` para aleatoriedad/hash/HMAC. Verificar mantenimiento/compatibilidad Node 24; no sumar SDK de pagos/auth ni librería temporal innecesaria. `@playwright/test` sólo dev para E2E.
- Configuración validada al iniciar: WEB_ORIGIN, API_INTERNAL_URL web, secreto CSRF, cookies según NODE_ENV, proxy confiable, SMTP host/port/user/password/from/TLS y DATABASE_URL/DIRECT_URL existentes. SMTP real obligatorio en producción; fake sender sólo tests. No secretos `NEXT_PUBLIC_*`; browser usa `/api`, no alias dinámico de `process.env`. Actualizar ejemplos sin credenciales reales.
- Logs saneados de login fallido, rate limit, reset/revocación y creación/concesión, con IDs/evento, nunca body o Cookie. Auditar configuración/secretos y cambios de dependencias antes de publicar.

## Edge Cases

- Email equivalente por mayúsculas/espacios y dos registros concurrentes: una cuenta, respuesta genérica. No reemplazar contraseña existente al repetir registro.
- Login/reset concurrentes, tokens confirmados dos veces o con propósito equivocado, SMTP caído y emails retrasados; no revivir sesiones ni consumir token por GET.
- Cookie inválida, sesión revocada/expirada, acceso después de inactividad, CSRF previo al login, origin falsificado/ausente, respuesta 429; sin loops ni filtraciones.
- Slug reservado/duplicado, payload con enums inválidos, fecha/rol/plan manipulado, rollback a mitad de creación, respuesta perdida después de commit y doble envío desde pestañas distintas.
- Empleado invitado con membresía preexistente, membresía inactiva, varios roles en varias organizaciones, selección ajena, cambio de contexto con requests pendientes.
- Trial antes, exactamente en y después de vencimiento, pestaña abierta, estado TRIALING desactualizado, nueva clave después de crear, antiguo envío repetido tras vencer. Nunca extender fecha ni devolver acceso comercial cacheado.
- Cuenta con TrialGrant previo y sin membresías: mostrar motivo/ayuda en `/onboarding`, sin otra prueba ni redirects infinitos. Invitaciones/soporte podrán recuperar acceso en fases posteriores.
- Tipos COMMERCE/HOSPITALITY y plan TOURISM se persisten sin inventar sus módulos operativos ni prometer funcionalidades todavía inexistentes.

## Acceptance Criteria

1. PostgreSQL conserva usuario, hash Argon2id, organización, OWNER, selección de sesión y suscripción tras logout/login y reinicio del servidor. El usuario no tiene rol/tenant global.
2. Registro crea sólo User/Credential/tokens; email duplicado responde de modo genérico sin nueva cuenta. Login incorrecto no filtra existencia y logout invalida token inmediatamente.
3. Sesiones duran bajo límites absolutos/inactividad, no se almacenan tokens planos; cookies/CSRF/CORS se comportan según entorno. Reset exitoso revoca todas las sesiones, incluso en concurrencia.
4. Verificación/reset funcionan mediante correo capturado en tests y transporte SMTP verificable; tokens expirados/consumidos fallan, GET no consume y ninguna respuesta muestra token de correo.
5. `/onboarding` y `/app/**` niegan acceso directo/SSR a visitantes; usuarios sin membresías van a `/onboarding`; cualquier miembro activo, incluido EMPLOYEE, va a `/app`. Recarga mantiene contexto; no existe `/app/onboarding`.
6. Creación confirmada tiene exactamente una Organization, Member ACTIVE/OWNER, Subscription TRIALING y TrialGrant. Plan/tipo coinciden con elección; inicio/vencimiento son backend y duración exacta 14 días.
7. Fallo de cualquier inserción revierte todo. Doble envío/retry/concurrencia no duplica ni amplía prueba; payload distinto con misma clave falla. Trial único por creador se mantiene aunque no tenga membresía activa.
8. Dos organizaciones y usuarios con roles distintos no pueden consultar/seleccionar contexto ajeno. Membresía revocada elimina acceso aunque sesión siga válida; suscripción es compartida por todos los miembros de su organización.
9. Backend permite acceso de negocio antes y lo deniega exactamente al vencer; endpoint de suscripción/cuenta/logout sigue disponible. Frontend aplica esa decisión, incluyendo pestaña abierta y métodos de fuentes locales; no hay fallback a demo sin contexto.
10. No hay rediseño ni traslado de rutas principales; estados de error/carga son accesibles, reintento seguro, navegación sin loops y no se presenta checkout/activación pagada ficticia.
11. Unitarias, integración PostgreSQL, HTTP y browser cubren estos criterios. No se afirma persistencia/seguridad multi-tenant de los dominios locales excluidos.
12. **Definition of Done:** fases A–E completas, documentación/ADRs/ambiente alineados, comandos ejecutados con resultados registrados en `Implementation` y `Verification Results`, diff limitado al alcance, revisión de seguridad sin defectos bloqueantes. Falta de DB/SMTP/browser es bloqueo explícito, no PASS ni feature terminada.

## Verification

### Cobertura a implementar

- Vitest unitarias: normalización/DTO, Argon2id, errores genéricos, cookies/CSRF, sesiones, consumo de tokens, permisos, elegibilidad, reloj y políticas de suscripción. Reloj fijo y avances controlados, nunca sleeps de 14 días.
- PostgreSQL real aislado: constraints, repositorios, rollback inducido, dos registros/creaciones/consumos concurrentes, concesión única, revocación/login-reset concurrentes y aislamiento de organizaciones. Crear script `npm run test:integration` y config dedicada; sin mocks de Prisma para esos casos.
- HTTP Nest/Supertest con bootstrap real: endpoints anteriores, cookie jar, CSRF/Origin/CORS, campos extra/enums/fechas falsificadas, auth/tenant/comercial, rate limits, me/logout/reset y estado efectivo vencido. Preservar smoke health sin conexión DB; suites que requieren DB deben fallar claramente si falta configuración, no saltarse silenciosamente.
- Web Vitest/Testing Library: formularios pending/errores, retry con misma clave, gate cerrado al fallar API, cambio de contexto/abort, verificación/reset y no ejecución de métodos locales denegados. Async Server Components se verifican en browser, no depender de soporte inexistente en Vitest.
- Añadir Playwright E2E `npm run test:e2e` en `app/`: registro→login→verificación→onboarding→app, recarga/logout/relogin, rutas privadas directas y navegación interna, empleado sin negocio propio, selector multi-org, sesión revocada, trial vencido (también con pestaña abierta), y respuesta perdida/doble envío. SMTP fake en harness, no endpoint público para sacar tokens o controlar tiempo; reloj inyectado exclusivamente en proceso de test. Verificar cookies/rewrite y ausencia de contenido privado en HTML/RSC.
- Probar browser contra build/start además de dev para validar rewrite, variables públicas y cookies reales; revisar móvil/escritorio/teclado sin cambios de estética.

### Comandos del Coder

Con DB de prueba independiente preparada y variables de test explícitas. Harness debe rechazar URLs productivas/compartidas y limpiar sólo registros de su ejecución; no usar comandos destructivos contra datos ajenos.

```text
# api/ — DIRECT_URL de prueba; DATABASE_URL de prueba para integración/HTTP
npm run db:generate
npm run db:migrate:deploy
npm run lint
npm run typecheck
npm test
npm run test:integration       # script nuevo de esta task
npm run test:e2e
npm run build
npm audit --omit=dev --omit=optional

# app/
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e               # script Playwright nuevo de esta task
npm audit
```

Registrar versiones, comandos, PASS/FAIL/BLOCKED y limitaciones reales. Los scripts nuevos deben preparar/apagar sólo sus procesos propios y documentarse en setup/testing. No actualizar contadores de pruebas ni afirmar checks aprobados sin ejecución. Coder añade sus secciones de implementación/resultados sin reescribir este contrato.
