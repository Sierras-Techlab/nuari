# Nuari App

Frontend Next.js de Nuari. Es un proyecto npm independiente ubicado en `app/`.

## Desarrollo

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`. La variable `NEXT_PUBLIC_API_URL` es opcional en desarrollo y por defecto apunta a `http://localhost:3001/api`.

Las llamadas HTTP deben utilizar `src/lib/api/api-client.ts`. No colocar URLs de API directamente en componentes.

## UI

Los tokens semánticos viven en `src/app/globals.css` y las primitivas reutilizables de shadcn/ui en `src/components/ui/`. Usar `cn` desde `src/lib/utils.ts` para combinar clases; no duplicar variantes en las páginas. La ruta `/__ui` es una referencia visual disponible sólo durante el desarrollo y no reemplaza la landing pública `/`.

El shell interno vive en el route group `(app)` y se prueba desde `/app`. La ruta `/` no está envuelta por este shell. La sidebar muestra el módulo activo **Turnero** con Inicio, Agenda, Servicios, Clientes, Caja y Equipo. Todas estas rutas tienen interfaz navegable y estado local. No hay sesión, permisos ni tenant context reales; los cambios viven sólo en memoria y se reinician al recargar. Por decisión de interfaz, las páginas internas no muestran avisos de demostración: este límite debe mantenerse explícito en documentación y durante la revisión del producto.

La UI de agenda consume `src/features/appointments/types.ts` mediante `AppointmentSource`. `demo-source.ts` implementa ese contrato con datos locales y `demo-provider.tsx` mantiene la fuente durante la navegación del shell. Servicios, Clientes, Caja y Equipo consumen `WorkspaceSource` en `src/features/workspace/types.ts`; `local-source.ts` implementa sus operaciones en memoria. Los servicios y profesionales del espacio alimentan las opciones de Agenda. Cuando exista el contrato de NestJS se reemplazarán estos adaptadores; disponibilidad, autorización, caja definitiva y persistencia vivirán en la API.

La landing pública vive en `/` y reproduce la referencia visual de `landing_page_nuari.html` con JSX y utilidades Tailwind CSS 4; no carga CDN, scripts de iconos ni datos de la API. Sus mockups, planes e importes son sólo contenido presentacional.

Las animaciones de entrada de la landing usan `src/components/marketing/reveal.tsx` con mejora progresiva: sin JavaScript, sin `IntersectionObserver` o con movimiento reducido el contenido permanece visible. Los iconos se importan individualmente desde `@phosphor-icons/react` usando su entrada SSR/CSR correspondiente.

La landing incorpora navbar responsive, mockups HTML, bento, casos de uso, precios estáticos, integraciones futuras y un FAQ nativo con `<details>`. `/login` y `/register` continúan siendo destinos preparados; no implica que el registro, el cobro ni las integraciones estén disponibles. Satoshi no está incluida porque no existe un asset local con procedencia verificable; mientras tanto se conserva Manrope como fallback optimizado.

Las rutas públicas `/login` y `/register` ahora contienen la interfaz de autenticación de referencia: son formularios demostrativos, accesibles y responsive, sin integración API ni persistencia de credenciales. El submit queda deshabilitado sin JavaScript y, al hidratarse, sólo muestra un estado informativo honesto.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```
