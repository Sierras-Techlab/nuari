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

El shell interno vive en el route group `(app)` y se prueba desde `/app`. La ruta `/` no está envuelta por este shell. La navegación inicial es deliberadamente mínima hasta que se seleccione el flujo piloto; no representa permisos reales ni un tenant context.

La landing pública vive en `/` y reproduce la referencia visual de `landing_page_nuari.html` con JSX y utilidades Tailwind CSS 4; no carga CDN, scripts de iconos ni datos de la API. Sus mockups, planes e importes son sólo contenido presentacional.

Las animaciones de entrada de la landing usan `src/components/marketing/reveal.tsx` con mejora progresiva: sin JavaScript, sin `IntersectionObserver` o con movimiento reducido el contenido permanece visible. Los iconos se importan individualmente desde `@phosphor-icons/react` usando su entrada SSR/CSR correspondiente.

La landing incorpora navbar responsive, mockups HTML, bento, casos de uso, precios estáticos, integraciones futuras y un FAQ nativo con `<details>`. `/login` y `/register` continúan siendo destinos preparados; no implica que el registro, el cobro ni las integraciones estén disponibles. Satoshi no está incluida porque no existe un asset local con procedencia verificable; mientras tanto se conserva Manrope como fallback optimizado.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```
