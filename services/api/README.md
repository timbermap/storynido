# @storynido/api

API HTTP de StoryNido (Fastify en Cloud Run).

## Desarrollo

```bash
pnpm emulators                      # en otra terminal (Auth y Firestore)
pnpm --filter @storynido/api dev    # http://localhost:8080
```

- **Swagger UI**: http://localhost:8080/docs (fuera de producción). Especificación: `/docs/json`.
- Para probar rutas protegidas desde Swagger, pegá en _Authorize_ un ID token de Firebase (en la web: `await (await import('firebase/auth')).getAuth().currentUser.getIdToken()` desde la consola, o el script de los tests).

## Cómo está armada

| Pieza                                                         | Dónde                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| Contrato de rutas (método, path, acceso, esquemas Zod)        | `@storynido/shared` → `src/api/contract.ts`                    |
| Registro de una ruta desde el contrato                        | [`src/plugins/route.ts`](src/plugins/route.ts)                 |
| Autenticación (ID token de Firebase → `request.user`) y roles | [`src/plugins/auth.ts`](src/plugins/auth.ts)                   |
| App Check en rutas sensibles (`{ appCheck: true }`)           | [`src/plugins/auth.ts`](src/plugins/auth.ts)                   |
| Modo del sitio (mantenimiento / solo vista previa)            | [`src/plugins/site-mode.ts`](src/plugins/site-mode.ts)         |
| Helmet, CORS y rate limiting                                  | [`src/plugins/security.ts`](src/plugins/security.ts)           |
| Formato único de error                                        | [`src/plugins/error-handler.ts`](src/plugins/error-handler.ts) |
| Proveedores (IA, pagos, imprenta, mails, storage)             | `@storynido/providers`                                         |
| Firebase Admin y configuración en vivo (siteConfig, aiConfig) | [`src/firebase.ts`](src/firebase.ts)                           |
| Vista previa (cuento, ilustraciones, marca de agua, edición)  | [`src/preview/service.ts`](src/preview/service.ts)             |
| Presupuesto diario de IA, registro de costos y alerta         | [`src/ai/budget.ts`](src/ai/budget.ts)                         |
| Configuración de IA (ver: admin; cambiar: superadmin)         | [`src/routes/ai-config.ts`](src/routes/ai-config.ts)           |

### Agregar una ruta

1. Definila en `apiRoutes` (`packages/shared/src/api/contract.ts`): método, path, `access` (`public`, `user`, `admin` o `superadmin`) y esquemas.
2. Registrala con `addRoute(app, apiRoutes.miRuta, { availability, appCheck }, handler)`.
3. Los clientes (`createApiClient`) la pueden usar de inmediato, con tipos y validación.

`availability`: `always` (responde incluso en mantenimiento), `normal` (por defecto) o `live_only` (bloqueada en modo "solo vista previa", por ejemplo el checkout).

### Errores

```json
{
  "error": {
    "code": "forbidden",
    "message": "No tenés permiso para esta acción.",
    "requestId": "req-7"
  }
}
```

Códigos: `bad_request`, `validation_failed`, `unauthorized`, `forbidden`, `app_check_failed`, `not_found`, `rate_limited`, `maintenance`, `unavailable_in_mode`, `internal`.

## Tests

`pnpm --filter @storynido/api test` corre todo con emuladores propios (puertos 19099/18180, proyecto `demo-storynido-test`): no interfiere con `pnpm emulators` ni con sus datos.
