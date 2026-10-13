# ADR-005: Autenticación propia

- Estado: Aceptada
- Fecha: 2026-08-31

## Contexto

Nuari necesita identificar usuarios y establecer sesiones para operar con organizaciones y membresías multi-tenant. Authentication y Authorization son conceptos distintos: autenticarse identifica a una persona; autorizarla resuelve su membresía, organización activa, rol y permisos.

## Decisión

Nuari implementará autenticación propia dentro de la API NestJS. El módulo de identidad será responsable de usuarios, credenciales y sesiones, mientras que las organizaciones resolverán membresías y el contexto tenant mediante interfaces públicas.

El modelo previsto incluye `User`, `UserCredential`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `OrganizationMember` y, en una fase posterior, `OrganizationInvitation`. Las contraseñas se almacenarán mediante Argon2id. Las sesiones serán server-side y usarán tokens criptográficamente aleatorios: el navegador recibirá el token sólo mediante una cookie `HttpOnly`, `Secure` y con política `SameSite` adecuada; la base almacenará únicamente el hash del token.

Los roles pertenecen a `OrganizationMember`, no al usuario global. Todas las verificaciones de permisos y membresía ocurrirán en backend, y ningún identificador enviado por el cliente probará autorización.

## Consecuencias

- La API mantiene control sobre identidad, sesiones y reglas de autorización.
- El frontend no almacena tokens de autenticación en `localStorage`.
- La implementación deberá definir explícitamente expiración, revocación, protección contra abuso, verificación de correo, recuperación de contraseña y comportamiento entre dominios.
- La autenticación no concede acceso global a datos: cada operación operativa requiere tenant context autorizado.

La implementación inicial define estas políticas: tokens de sesión aleatorios de 32 bytes con SHA-256 persistido; duración absoluta de 30 días y límite de inactividad de 7 días; invalidación de todas las sesiones al restablecer credenciales; Argon2id con parámetros mínimos documentados en [TASK-07](../../tasks/TASK-07-feat-001-authentication-onboarding.md). Las cookies son host-only, `HttpOnly`, `SameSite=Lax`, `Path=/`, sin `Domain` y `Secure` en producción. Las mutaciones validan el `Origin` exacto y un token CSRF double-submit firmado, también para login y registro.

La creación inicial de una organización exige correo verificado. La membresía activa, no un rol global del usuario, determina el acceso; empleados existentes pueden ingresar sin crear un negocio propio. La limitación de abuso y las políticas de expiración no sustituyen controles anti-fraude por identidad, que no se prometen en esta fase.

El navegador usa el transporte same-origin de [ADR-006](ADR-006-same-origin-web-api-transport.md). La aplicación Next.js no es una autoridad de autenticación y no escribe cookies en render server-side.

## Alternativas descartadas

Se descarta adoptar un proveedor de autenticación como decisión inicial del producto. Podrán evaluarse servicios externos en el futuro sólo mediante una nueva decisión que preserve los contratos, el aislamiento y los requisitos de seguridad de Nuari.
