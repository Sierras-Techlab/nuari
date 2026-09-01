# ADR-001: Monolito modular para la API

- Estado: Aceptada
- Fecha: 2026-08-27

## Contexto

Nuari tendrá dominios de núcleo, servicios, comercio e integraciones. El equipo inicial está compuesto por dos desarrolladores y necesita validar un MVP antes de operar todos los módulos.

Se consideró implementar cada módulo como microservicio para aislar despliegues y facilitar la localización de errores.

## Decisión

La API comenzará como una aplicación NestJS desplegable única, organizada en módulos de dominio con límites e interfaces explícitos.

El frontend Next.js será una aplicación separada. Un worker podrá agregarse como tercer desplegable cuando existan procesos asíncronos concretos.

## Motivos

- Mantiene transacciones simples para ventas, pagos, stock y operaciones relacionadas.
- Reduce infraestructura, contratos distribuidos y observabilidad necesaria durante el MVP.
- Permite trabajar y probar por módulo sin asumir el costo operativo de microservicios.
- Conserva la posibilidad de extraer módulos si aparece evidencia que lo justifique.

## Consecuencias

- La API se despliega como una unidad.
- Los límites deben sostenerse mediante estructura, interfaces, tests y revisiones; no mediante procesos separados.
- Una falla del proceso puede afectar toda la API, por lo que el runtime necesitará health checks, reinicio y una estrategia de despliegue segura.
- La extracción futura requerirá definir contratos y estrategia de datos, pero partirá de módulos ya delimitados.

## Alternativas descartadas

### Next.js full-stack

Habría reducido aplicaciones iniciales, pero el equipo prefiere un backend NestJS y una frontera clara para la lógica de negocio.

### Microservicios desde el comienzo

Ofrecen despliegues independientes, pero agregan coordinación, autenticación entre servicios, consistencia distribuida, reintentos y observabilidad antes de validar el producto.

## Criterios para revisar la decisión

Se revisará si un módulo necesita escalado, seguridad, disponibilidad, tecnología, ciclo de despliegue o propiedad de equipo claramente independientes.
