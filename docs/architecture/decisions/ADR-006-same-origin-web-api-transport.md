# ADR-006: Transporte same-origin entre Next.js y la API

- Estado: Aceptada
- Fecha: 2026-10-12

## Contexto

La autenticación propia usa una cookie de sesión `HttpOnly` emitida por NestJS. El frontend Next.js y la API son despliegues separados; usar dominios distintos en el navegador complica cookies, CSRF y entornos preview. La API debe continuar siendo la única autoridad de identidad, autorización, reglas de negocio y PostgreSQL.

## Decisión

- El navegador consume la API mediante Axios en el origen web, con `baseURL=/api` y credenciales. Next.js reescribe `/api/:path*` hacia el origen interno `API_INTERNAL_URL` de NestJS, configurado sólo en el servidor. El rewrite conserva método, cuerpo, `Origin` y los encabezados `Set-Cookie`; no implementa autenticación ni lógica de dominio.
- Las cookies de sesión son host-only para el origen web, sin `Domain`, y no dependen de cookies third-party. En producción requieren HTTPS.
- El renderizado server-side puede llamar a Nest directamente desde utilidades `server-only`, sin caché y reenviando solamente la cookie de sesión necesaria. No debe escribir/rotar cookies ni almacenar credenciales de sesión en frontend.
- Nest valida el `Origin` exacto de `WEB_ORIGIN`, CORS con credenciales y la protección CSRF. CORS no se considera defensa CSRF.
- No se admite como alternativa el acceso browser→API cross-site. Los entornos preview deben tener una configuración de origen explícita y aislada.

## Consecuencias

- `API_INTERNAL_URL` es secreto/configuración server-only; el navegador no descubre ni llama al origen API de despliegue.
- Next actúa como límite de transporte, no como BFF con persistencia o reglas de autorización duplicadas.
- Rewrite, propagación de cookies, HTTPS, CORS, CSRF y cabeceras forwarded deben verificarse en build/start y en el entorno de despliegue antes de producción.
- Las llamadas privadas server-side y sus respuestas son dinámicas y `no-store`; no se debe servir un RSC/HTML privado desde una caché compartida.

## Alternativas descartadas

- Cookies cross-site entre web y API: aumenta dependencia de atributos de terceros, dominios y políticas de navegador.
- Route Handlers/Server Actions como segunda API de autenticación: duplicarían contratos y lógica que ADR-005 asigna a NestJS.
- Guardar el token de sesión en JavaScript para adjuntarlo a solicitudes: contradice ADR-005 y expone credenciales ante XSS.
