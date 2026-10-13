# Arquitectura general

## Estado

Esta arquitectura está aplicada en la base técnica inicial. La raíz contiene una aplicación Next.js y una API NestJS como proyectos npm independientes; los módulos de negocio todavía no fueron implementados.

## Enfoque

Nuari comenzará como un monolito modular con frontend y backend separados. La modularidad se aplicará en el diseño del código y del dominio; no se desplegará un microservicio por módulo durante el MVP.

```text
Browser
   |
   v
Next.js web
   |
   | same-origin /api rewrite; HTTPS / REST
   v
NestJS API
   |
   v
PostgreSQL (Neon, São Paulo)
```

Los procesos asíncronos podrán incorporarse como un worker independiente cuando aparezcan tareas que no deban ejecutarse dentro de una petición HTTP.

## Estructura del repositorio

```text
app/         Frontend Next.js
api/         API NestJS
docs/        Documentación canónica
.ai/         Contexto operativo breve
```

Cada aplicación tiene su propio manifiesto, lockfile y ciclo de instalación npm. Un futuro proceso asíncrono tendrá un directorio raíz propio cuando exista una necesidad concreta. Compartir tipos no debe acoplar el frontend a detalles internos del backend.

## Responsabilidades

### Web

- Renderizar la experiencia de usuario.
- Gestionar estado de presentación y formularios.
- Consumir la API mediante un cliente HTTP configurado.
- Presentar errores de forma útil.
- No implementar reglas de negocio que deban aplicarse a todos los clientes.

### API

- Autenticar y autorizar operaciones.
- Resolver el tenant context.
- Validar entradas.
- Ejecutar casos de uso y reglas de negocio.
- Persistir información y coordinar transacciones.
- Exponer contratos HTTP estables.
- Recibir webhooks e integraciones futuras.

### Base de datos

- Mantener integridad, relaciones y restricciones.
- Almacenar información de múltiples organizaciones con aislamiento lógico.
- Ejecutar transacciones que mantengan consistencia entre operaciones relacionadas.

### Worker futuro

- Procesar tareas reintentables o de larga duración.
- Enviar notificaciones.
- Consumir eventos o una cola.
- Ejecutar trabajos de integración y reportes costosos.

No se creará hasta que exista una tarea concreta que lo necesite.

## Comunicación

La comunicación entre browser y API usa REST same-origin en `/api`; Next.js reescribe al origen server-only de NestJS según [ADR-006](decisions/ADR-006-same-origin-web-api-transport.md). Axios centraliza base, credenciales, timeout, serialización y traducción de errores. NestJS sigue siendo el dueño de autenticación y autorización conforme a [ADR-005](decisions/ADR-005-custom-authentication.md); Next no añade una API de negocio paralela.

La API será la única aplicación con acceso directo a PostgreSQL. El navegador nunca recibirá credenciales de base de datos.

## Evolución

Un módulo podrá extraerse a un servicio separado cuando exista evidencia de al menos una de estas necesidades:

- Escalado o consumo de recursos claramente diferente.
- Requisitos de disponibilidad o seguridad independientes.
- Ciclo de despliegue realmente autónomo.
- Equipo propietario independiente.
- Limitación técnica que no pueda resolverse razonablemente dentro del monolito.

Antes de extraerlo se debe contar con límites de dominio, observabilidad, contratos y una estrategia de consistencia explícitos.
