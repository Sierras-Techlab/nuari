# Despliegue

## Topología inicial

```text
Users
  |
  v
Vercel: Next.js web
  |
  | HTTPS
  v
Container/VPS: NestJS API
  |
  | TLS + pooled connection
  v
Neon PostgreSQL: São Paulo
```

## Frontend

Next.js se desplegará inicialmente en Vercel. La URL pública de la API se suministrará mediante configuración de ambiente y no quedará codificada en componentes.

## API

NestJS se desplegará como proceso o contenedor de larga duración. El proveedor concreto del runtime todavía no fue seleccionado. La operación inicial debe incluir:

- HTTPS mediante proxy o plataforma administrada.
- Health check.
- Logs estructurados.
- Reinicio automático.
- Variables de ambiente administradas fuera del repositorio.
- Estrategia de despliegue y rollback.

Un único VPS puede ser suficiente para validar, pero no se debe confundir separación de aplicaciones con alta disponibilidad.

## Base de datos

PostgreSQL estará administrado por Neon en São Paulo. La API utilizará una conexión pooled para tráfico normal y una conexión directa separada para migraciones y tareas administrativas.

Las credenciales de producción no estarán disponibles en el frontend ni se versionarán.

Antes de utilizar datos reales se debe contar con:

- Plan apropiado para producción.
- Ventana de restauración configurada.
- Exportación lógica cifrada fuera del proveedor.
- Prueba de restauración documentada.
- Alarmas o monitoreo de capacidad y errores.

## Ambientes

Se mantendrán ambientes separados:

- Desarrollo local.
- Staging o preview.
- Producción.

Cada ambiente tendrá credenciales y base o branch separados. Las migraciones se probarán fuera de producción antes de aplicarse.

## Región y latencia

La API y la base deben ejecutarse en regiones cercanas entre sí. Si el runtime de la API permite elegir región, São Paulo es la preferencia inicial para mantener baja latencia hacia Neon y hacia usuarios argentinos.

## Procesos asíncronos

Webhooks que requieran confirmación rápida, reintentos o procesamiento prolongado podrán delegarse a un worker futuro. No se agregará Redis, una cola o un worker sin un caso de uso que determine sus requisitos de entrega e idempotencia.

## Archivos y correo

Cloudflare R2 y Resend son proveedores previstos, no dependencias obligatorias de la inicialización. Sus adaptadores se incorporarán desde el módulo de integraciones cuando una funcionalidad aprobada los necesite.
