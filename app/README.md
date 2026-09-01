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

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```
