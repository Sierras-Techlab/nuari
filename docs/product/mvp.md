# MVP

## Objetivo de validación

El primer MVP debe demostrar que Nuari puede reemplazar una parte concreta del Excel o registro manual de un negocio real y convertirse en su fuente operativa diaria.

El éxito inicial no se medirá por la cantidad de módulos construidos, sino por la capacidad de completar de punta a punta un flujo frecuente con información confiable y menor trabajo manual.

## Estrategia de alcance

El MVP debe implementar un único flujo vertical para un tipo de negocio piloto. La selección del piloto y del flujo todavía es una decisión abierta; por lo tanto, este documento no presenta como aprobado un listado funcional que aún no fue acordado.

Antes de iniciar funcionalidades de dominio se debe decidir:

- Tipo de negocio piloto.
- Problema operativo principal que se reemplazará.
- Usuario que ejecutará el flujo.
- Evento que marca el inicio y el final del flujo.
- Métrica observable de éxito.

## Base técnica necesaria

Independientemente del flujo elegido, la primera etapa requiere:

- Workspace con frontend Next.js y API NestJS.
- Conexión segura de la API a PostgreSQL.
- Comunicación HTTP del frontend con la API.
- Modelo mínimo de organización y membresía cuando comience la autenticación.
- Estrategia de migraciones y ambientes.
- Validación de entrada, manejo de errores y observabilidad básica.
- Pruebas unitarias, de integración y end-to-end proporcionales al flujo.

## Fuera del primer corte

Hasta que el flujo piloto lo justifique expresamente, no se construirá en el primer corte:

- Servicios y Comercio completos simultáneamente.
- Ecommerce completo.
- Integración integral con Mercado Pago.
- WhatsApp.
- Funcionalidades de IA.
- Microservicios.
- Reportería avanzada.

## Criterio de aceptación del MVP

El MVP podrá considerarse validable cuando un negocio piloto pueda ejecutar el flujo elegido con datos aislados por organización, recuperar su estado posteriormente y operar durante un período acordado sin mantener un registro paralelo como fuente principal.

La definición cuantitativa del período y de la métrica se agregará después de seleccionar el piloto; esa actualización será una decisión de producto, no un detalle de implementación.
