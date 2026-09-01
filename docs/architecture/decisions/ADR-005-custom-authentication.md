# ADR-005: Autenticación propia

- Estado: Aceptada
- Fecha: 2026-08-31

## Contexto

Nuari necesita identificar usuarios y establecer sesiones para operar con organizaciones y membresías multi-tenant. Authentication y Authorization son conceptos distintos: autenticarse identifica a una persona; autorizarla resuelve su membresía, organización activa, rol y permisos.

## Decisión

Nuari implementará autenticación propia dentro de la API NestJS. El módulo de identidad será responsable de usuarios, credenciales y sesiones, mientras que las organizaciones resolverán membresías y el contexto tenant mediante interfaces públicas.

El modelo previsto incluye `User`, `UserCredential`, `Session`, `EmailVerificationToken`, `PasswordResetToken`, `OrganizationMember` y `OrganizationInvitation`. Las contraseñas se almacenarán mediante Argon2id. Las sesiones serán server-side y usarán tokens criptográficamente aleatorios: el navegador recibirá el token sólo mediante una cookie `HttpOnly`, `Secure` y con política `SameSite` adecuada; la base almacenará únicamente el hash del token.

Los roles pertenecen a `OrganizationMember`, no al usuario global. Todas las verificaciones de permisos y membresía ocurrirán en backend, y ningún identificador enviado por el cliente probará autorización.

## Consecuencias

- La API mantiene control sobre identidad, sesiones y reglas de autorización.
- El frontend no almacena tokens de autenticación en `localStorage`.
- La implementación deberá definir explícitamente expiración, revocación, protección contra abuso, verificación de correo, recuperación de contraseña y comportamiento entre dominios.
- La autenticación no concede acceso global a datos: cada operación operativa requiere tenant context autorizado.

## Alternativas descartadas

Se descarta adoptar un proveedor de autenticación como decisión inicial del producto. Podrán evaluarse servicios externos en el futuro sólo mediante una nueva decisión que preserve los contratos, el aislamiento y los requisitos de seguridad de Nuari.
