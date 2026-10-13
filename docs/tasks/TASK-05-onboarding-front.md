# TASK-05 — Onboarding visual del negocio

## Goal

Implementar `/onboarding` adaptando el HTML de referencia a TSX y Tailwind del proyecto. Permitir recorrer `/` → `/register` → `/onboarding` → `/app` únicamente como flujo de interfaz, sin backend, autenticación ni configuración real de organizaciones.

## Context

- Referencia visual y de contenido: `C:\Users\Uriel\Downloads\onboarding_nuari.html`. Consultarla antes de implementar; no servirla como HTML incrustado.
- Frontend en `app/`: Next.js 16 App Router, React 19, TypeScript estricto, Tailwind 4 y `@phosphor-icons/react` ya instalado. La fuente vigente es Manrope.
- La landing ya enlaza a `/register`; `AuthForm` actualmente sólo muestra un aviso al enviar. `/app` usa el shell Turnero y fuentes locales independientes.
- Este trabajo no amplía el MVP ni aprueba módulos, planes o contratos de dominio. Ver [MVP](../product/mvp.md) y [problemas conocidos](../../.ai/known_issues.md).

## Requirements

1. Añadir una página pública `/onboarding`, con título de metadata «Configura tu negocio - Nuari», accesible directamente sin registro previo.
2. Reproducir los cuatro pasos del HTML, su contenido y jerarquía visual:
   - **Identidad:** bienvenida, «Empecemos por lo esencial.», nombre del negocio y vista editable `nuari.app/<slug>`. Continuar requiere nombre no vacío tras `trim` y slug válido.
   - **Tipo:** tarjetas de selección única Servicios, Comercio y Hostelería, con sus descripciones, iconos y colores originales. Sin selección inicial; Continuar requiere elegir una.
   - **Plan:** Básico, Pro, Business y Turismo, con las prestaciones del HTML, distintivo «MÁS ELEGIDO» en Pro y bloque visual de prueba de 14 días. Sin precios adicionales ni selección inicial; Continuar requiere elegir uno.
   - **Resumen:** inicial del nombre, nombre, enlace, tipo y plan elegidos, con tarjeta y decoración del HTML. El CTA final navega a `/app`.
3. Mantener logo enlazado a `/`, cuatro puntos de progreso acumulativo y «Volver» desde el segundo paso. Retroceder conserva todos los campos y selecciones; el resumen refleja las últimas ediciones.
4. Generar el slug desde el nombre mientras no se haya editado manualmente: minúsculas, normalización de acentos (`Estética Ñandú` → `estetica-nandu`), separación con guiones, sin caracteres ajenos a `[a-z0-9-]`, guiones repetidos ni extremos. Una edición manual deja de seguir al nombre; validar y mostrar error asociado si queda vacío o inválido. No comprobar disponibilidad ni crear una ruta pública para ese enlace.
5. Conservar las sugerencias visuales del HTML: sin plan elegido, atenuar Turismo para Servicios/Comercio y los otros planes para Hostelería. Son sugerencias, no restricciones: todos siguen siendo seleccionables. Recalcular al cambiar tipo si aún no hay plan; conservar cualquier plan ya seleccionado.
6. Cambiar únicamente el envío visual de registro: tras validar los campos existentes, prevenir el envío nativo y navegar a `/onboarding`, sin transmitir datos. Retirar el aviso de registro no habilitado para ese envío; `/login` mantiene su comportamiento actual. No rediseñar ni agregar reglas al registro.
7. No reproducir el envío simulado del HTML: sin espera de red ficticia, logs del payload, mensaje «Negocio configurado» ni desvanecimiento del `body`. En el resumen sustituir la afirmación de creación/inicio de prueba por «Revisá la configuración de tu espacio antes de continuar» y usar CTA «Entrar a mi espacio». El contenido de planes es sólo presentación; no inicia pruebas ni suscripciones.
8. Soportar ratón, táctil y teclado. Enter permite continuar un paso válido y activar el CTA final, sin interceptar Enter/Espacio sobre controles de selección o «Volver» ni provocar saltos dobles.

## Architecture

- Crear `app/src/app/onboarding/page.tsx` como Server Component con metadata y una pantalla cliente en `app/src/features/onboarding/`. Heredar sólo el layout raíz: no colocar la ruta dentro de `(auth)` ni `(app)`; no añadir el panel lateral de login ni el shell interno.
- Usar estado React local tipado para paso `1 | 2 | 3 | 4`, nombre, slug, edición manual, tipo y plan. Mantener catálogos y transformación/validación del slug en archivos enfocados del feature, sin repositorios ni contratos API ficticios.
- Usar `Link` para enlaces y `useRouter` de `next/navigation` para navegación por envío, siempre a destinos internos constantes. Todos los tipos y planes terminan en el mismo `/app`; no modificar su workspace con esta selección.
- Adaptar clases al Tailwind 4 existente, sin configuración Tailwind v3 ni scripts CDN. Usar imports individuales Phosphor CSR en componentes cliente y la fuente Manrope existente; no cargar Satoshi/Fontshare ni incorporar dependencias.
- Mantener la paleta clara del HTML incluso con tema oscuro global: fondo `#F8FAF9`, superficies blancas, texto/CTA `#182026`, hover `#2A3742`, texto secundario `#667078`, borde `#E4E9E7`; acentos verde `#7ED6A5`/menta `#DDF6E8`, azul `#7EA8F8`/`#E8F0FF`, cálido `#FFB86B`/`#FFF1E2` y lavanda `#A997E8`/`#F0ECFF`.
- Conservar bordes redondeados, sombras suaves, check de selección, hover y transiciones de opacidad/desplazamiento, respetando `prefers-reduced-motion`. Preferir utilidades; si hace falta CSS, aislarlo al feature, sin cambiar tokens o estilos globales de otras rutas.
- No copiar `h-screen overflow-hidden` ni pasos absolutos que recorten contenido. Usar altura mínima de viewport, flujo desplazable y anchos por paso aproximados de 2xl/3xl/4xl/2xl; tipos en 1/3 columnas y planes en 1/2/4 según espacio. El header no debe superponerse con el contenido.
- Sólo el paso activo es operable y accesible. Dar labels reales a nombre y slug, semántica accesible de selección única, foco visible, errores asociados y progreso textual «Paso X de 4» para lectores de pantalla. Mover el foco al nombre inicialmente y al encabezado del paso al navegar.

## Affected Areas

- Nuevo `app/src/app/onboarding/page.tsx`.
- Nuevo `app/src/features/onboarding/`: pantalla, catálogos/tipos, utilidades y pruebas; CSS local sólo si es necesario.
- `app/src/components/auth/auth-form.tsx` y `auth-form.test.tsx`; `app/src/app/(auth)/auth-pages.test.tsx` si requiere adaptar mocks de navegación o ampliar cobertura SSR.
- Al implementar, actualizar `.ai/context_snapshot.md`, `docs/development/testing.md` y `.ai/known_issues.md` con la nueva ruta, navegación y límites reales. Mantener explícito que no existe identidad, persistencia ni activación comercial.
- No requiere cambios en API, Prisma, infraestructura, dependencias, layouts existentes ni pantallas Turnero.

## Security / Invariants

- No llamar a Axios/fetch, Server Actions o Route Handlers para registrar/configurar; no crear usuarios, organizaciones, membresías, permisos, sesiones ni suscripciones.
- No añadir guards, proxy/middleware ni redirecciones por sesión. `/onboarding` y `/app` siguen accesibles directamente; el flujo visual no es autorización.
- No persistir los campos en cookies, localStorage, sessionStorage o URL, ni registrar datos personales/contraseñas. El estado del onboarding se pierde al recargar o desmontar.
- Renderizar entradas como texto React: sin `innerHTML`, `dangerouslySetInnerHTML` ni manipulación global del DOM. El slug no determina el destino de navegación.
- Preservar la protección prehidratación del formulario de registro: sin JavaScript no debe enviar sus datos por navegación nativa. El formulario de onboarding tampoco debe generar envíos nativos.
- Planes y tipos son opciones visuales locales, no entidades ni reglas autoritativas. `Organization` permanece como límite de tenant para una integración futura.

## Edge Cases

- Nombre vacío, sólo espacios, acentos, signos o caracteres que generan slug vacío; slug manual inválido o vaciado; nombre cambiado después de editar el slug.
- Nombres/enlaces largos: envolver o limitar el campo visual sin ocultar el contenido útil, desbordar horizontalmente o romper la tarjeta de resumen.
- Cambiar tipo/plan al retroceder, conservar el plan aunque no coincida con la sugerencia y actualizar resumen e inicial tras editar el nombre.
- Enter/clic repetido no salta pasos ni duplica navegación; no avanzar con datos inválidos aunque se invoque el handler directamente.
- Acceso directo, recarga y reentrada empiezan en el paso 1 vacío, sin depender de datos del registro.
- Pantallas móviles bajas, teclado virtual, zoom al 200%, tema oscuro y movimiento reducido; los CTA deben seguir siendo alcanzables.

## Acceptance Criteria

1. Se completa el flujo visual `/` → `/register` válido → cuatro pasos de `/onboarding` → `/app`, sin API ni sesión y sin alterar login o Turnero.
2. La página coincide con la referencia en composición, paleta, tarjetas, iconografía, estados y textos salvo las adaptaciones explícitas; en móvil no recorta formularios ni planes.
3. Validaciones, slug automático/manual, sugerencias, avance/retroceso y resumen funcionan con estado local; recargar lo reinicia.
4. La navegación completa es operable con teclado, con foco coherente, progreso anunciado y sin controles ocultos en el orden de tabulación; movimiento reducido elimina animaciones no esenciales.
5. Hay pruebas Vitest/Testing Library para slug y validación, avance bloqueado, selecciones/sugerencias, conservación al volver, resumen actualizado y navegación final a `/app`; registro válido navega a `/onboarding` sin enviar datos y login conserva su aviso. Cubrir SSR sin envío nativo antes de hidratación y ausencia de avance ante datos inválidos.
6. Pasan tests, lint, typecheck y build web; queda documentado el carácter exclusivamente visual de la nueva ruta y sus verificaciones.

## Verification

- Antes de implementar, leer `app/AGENTS.md` y las guías locales Next en `app/node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` y `01-app/02-guides/redirecting.md`.
- Desde `app/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Con `npm run dev`, revisar `/`, `/register`, `/onboarding`, `/login` y `/app`; completar el flujo y probar acceso directo/recarga del onboarding. Comprobar en Network que no se envían datos a una API y en consola que no hay errores de hidratación ni payloads.
- Comparar cada paso con el HTML en escritorio (1440×900) y móvil (390×844 y 320×568); revisar scroll, zoom 200%, teclado, tema oscuro y movimiento reducido. Registrar resultados; no hay suite E2E web existente, no añadir Playwright sólo para esta tarea.

## Implementation

Status: IMPLEMENTED

### Changed Files

- `app/src/app/onboarding/page.tsx`
- `app/src/features/onboarding/catalog.ts`
- `app/src/features/onboarding/slug.ts`
- `app/src/features/onboarding/slug.test.ts`
- `app/src/features/onboarding/selection-card.tsx`
- `app/src/features/onboarding/onboarding-screen.tsx`
- `app/src/features/onboarding/onboarding-screen.test.tsx`
- `app/src/features/onboarding/onboarding.module.css`
- `app/src/components/auth/auth-form.tsx`
- `app/src/components/auth/auth-form.test.tsx`
- `app/src/app/(auth)/auth-pages.test.tsx`
- `.ai/context_snapshot.md`
- `.ai/known_issues.md`
- `docs/development/testing.md`
- `docs/tasks/TASK-05-onboarding-front.md` (sólo secciones de implementación/resultados)

### Notes

- Radios nativos con tarjetas visuales conservan navegación por flechas y Espacio; Enter selecciona sin saltar de paso. Sólo se monta el paso activo, sin formularios ni envíos nativos en onboarding. El envío válido de registro navega una única vez sin transmitir sus campos.
- Estado local separado del workspace; todos los tipos/planes navegan al destino fijo `/app`. No se modificaron API, permisos, persistencia, dependencias ni estilos globales.
- CSS Module para entrada del paso y tipografía/foco local: el reset global `button, input { font: inherit; }` sobrescribe utilidades Tailwind y necesitó especificidad local. No se usa la superposición absoluta del HTML; los pasos largos permiten scroll.
- Ajuste menor de accesibilidad: la atenuación afecta al fondo/escala de tarjetas, no a la opacidad del texto habilitado; el texto del badge cálido se oscureció para mantener contraste.
- Verificación de navegador con Chromium y herramientas instaladas sólo en el directorio temporal aprobado, sin añadir una suite o dependencia al proyecto. `npm run dev -- --port 3002` detectó el servidor existente; se utilizó éste en `http://localhost:3000` sin detenerlo. Las capturas y script quedan en `C:\Users\Uriel\AppData\Local\Temp\opencode\onboarding-browser`.

## Verification Results

- lint: PASS — `app/: npm run lint`.
- typecheck: PASS — `app/: npm run typecheck`.
- tests: PASS — `app/: npm test`, 64 pruebas en 15 archivos.
- build: PASS — `app/: npm run build`, incluye `/onboarding` como página estática.
- navegador: PASS — Chromium sobre servidor Next dev; `/`, `/register`, `/onboarding`, `/login` y `/app` responden 200; recorrido completo, selección con flechas/Enter, recarga y acceso directo, registro sin JavaScript y onboarding sin envío nativo. Sin llamadas a API, envío de payloads ni errores de consola/hidratación durante el flujo.
- responsive/visual: PASS — capturas de los cuatro pasos en 1440×900, 390×844 y 320×568, comparadas con la referencia; CTA alcanzables con scroll y sin desbordamiento horizontal. Verificados tema oscuro, movimiento reducido y resumen con nombre/slug largos. El reflow al 200% se comprobó mediante zoom CSS en Chromium, no mediante el control de zoom del navegador.
- revisión de alcance: PASS — se corrigieron contraste de tarjetas/badge cálido y tipografía local señalados por revisión independiente; sin cambios en arquitectura ni especificación original.
