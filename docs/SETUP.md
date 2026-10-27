# Puesta en marcha

Guía para llevar StoryNido de cero a producción. Se completa a medida que avanzan las fases; la versión final se cierra en la fase 18.

## 1. Desarrollo local

Ver [README.md](../README.md): `pnpm install`, `cp .env.example .env.local`, `pnpm dev`. Con los proveedores en `mock` no hace falta ninguna cuenta.

## 2. Google Cloud (fase 02)

Paso a paso en [infra/README.md](../infra/README.md):

1. Bootstrap de cada ambiente (`infra/scripts/bootstrap.sh`).
2. `terraform apply` en `infra/envs/staging` y después en `infra/envs/production`.
3. Variables de GitHub Actions (`infra/scripts/github-vars.sh`) y `DEPLOY_ENABLED=true`.
4. Backends de Firebase App Hosting para `apps/web` y `apps/admin`.
5. Dominios: `storynido.com`, `admin.storynido.com`, `api.storynido.com`; redirección de `.online` y `.store`.

## 3. Autenticación (fase 03)

En local no hace falta nada: los emuladores aceptan Google, Apple y enlace mágico con cuentas de prueba.

Para staging y producción, en la consola de Firebase del proyecto → **Authentication → Sign-in method**:

1. **Correo electrónico/contraseña** → activar **Vínculo de correo electrónico (acceso sin contraseña)**. Dejá desactivada la opción de contraseña.
2. **Google** → activar y elegir el email de soporte.
3. **Apple** → requiere una cuenta del Apple Developer Program (USD 99/año), un Services ID y una clave de Sign in with Apple. Se puede dejar para después: el botón muestra un error amigable si el proveedor no está habilitado.
4. **Authentication → Configuración → Dominios autorizados**: agregar `staging.storynido.com` (o `storynido.com` y `www.storynido.com` en producción).
5. Configuración web: `terraform -chdir=infra/envs/staging output firebase_web_config`. Esos valores van en las variables `NEXT_PUBLIC_FIREBASE_*` del backend de App Hosting (no son secretos).

**Primer superadmin**: iniciá sesión una vez en el sitio y después:

```bash
gcloud auth application-default login
pnpm --filter @storynido/firebase set-role --project storynido-staging --email tu@email.com --role superadmin
```

## 4. Sitio público (fase 05)

- **App Hosting:** las variables están en `apps/web/apphosting.yaml` (producción) y `apphosting.staging.yaml`. La configuración de Firebase la inyecta App Hosting.
- **País por IP:** si se pone un balanceador o CDN delante del sitio, configurá el header personalizado `X-Client-Country: {client_region}`. Sin él, el país se detecta por el idioma del navegador y el visitante lo puede cambiar.
- **Textos legales:** `firebase/seed-data/content/<idioma>/*.md` son textos base. Antes de lanzar, completá los datos entre corchetes y hacelos revisar con asesoría legal. Después se editan desde el panel admin (fase 14).
- **Catálogo en staging o producción:** las historias, precios y textos se cargan con el panel admin (fase 14) o con una importación del seed preparada para ese ambiente.
- **Analítica:** `NEXT_PUBLIC_GA4_MEASUREMENT_ID` y `NEXT_PUBLIC_META_PIXEL_ID` en `apphosting.yaml` cuando existan (solo se cargan con consentimiento).

## 5. Fotos (fase 06)

- En la nube las fotos van a Cloud Storage (`STORAGE_PROVIDER=gcs`, lo define Terraform). El bucket ya tiene CORS para el sitio y borrado a los 30 días.
- Análisis: `photo_analyzer` en `infra/envs/<ambiente>/variables.tf` (`mock` o `vision`). Cloud Vision tiene costo por imagen después de las 1.000 gratis por mes.
- En local se usa el almacenamiento en disco (`LOCAL_STORAGE_DIR`) y el análisis simulado.

## 5b. Pipeline del pedido (fase 08)

- **Local:** con los emuladores y la API corriendo, levantá el worker con `pnpm --filter @storynido/worker dev` (puerto 8081). La API le manda los eventos directo (`PIPELINE_EVENTS=worker`, por defecto en local) y el worker orquesta y reparte las páginas en el mismo proceso.
- **Probarlo:** con un libro en vista previa lista, `POST /v1/dev/books/<bookId>/paid-order` (solo fuera de producción) crea un pedido pagado simulado y dispara el pipeline. El estado se ve en `GET /v1/admin/orders/<orderId>/pipeline`.
- **Nube:** API → Pub/Sub (`order-events`) → worker → Cloud Workflows (`infra/workflows/order-pipeline.yaml`) → worker por paso; las páginas van por Cloud Tasks (`illustrations`). El worker no es público: solo lo llaman las cuentas invocadoras con OIDC.
- **Pedido trabado:** queda en `qa_failed` con un aviso en `adminAlerts`. El admin reintenta un paso (`POST /v1/admin/orders/<id>/retry`) o regenera el libro (`POST /v1/admin/orders/<id>/regenerate`).

## 5c. Checkout y pagos (fase 11)

- **Local y staging (`PAYMENT_PROVIDER=mock`):** desde la muestra aprobada, "Elegir formato" lleva a `/es/pagar/<libro>`. "Pagar" crea el pedido y vuelve a `/es/pedido/<pedido>`, donde "Simular el pago" lo confirma con el mismo webhook firmado que usará el procesador real.
- **Cupón de prueba (emuladores):** `PRUEBA10` (10 %).
- **Webhook del proveedor:** `POST /v1/webhooks/payments/<proveedor>` con el cuerpo crudo; se verifica la firma.
- **Conversiones del servidor (opcional):** `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `META_PIXEL_ID` y `META_CAPI_ACCESS_TOKEN`. Sin claves no se envía nada.

## 5d. Imprenta y "Mi cuenta" (fase 12)

- **Local y staging (`PRINT_PROVIDER=mock`):** un pedido impreso queda en "Tu libro está en la imprenta". En la página del pedido, "Avanzar la imprenta" manda el siguiente webhook firmado: imprimiendo → en camino (con seguimiento) → entregado.
- **Matriz de impresión:** `pnpm seed` carga `printOptions` (MX y US). En staging se recarga con `pnpm --filter @storynido/firebase seed:cloud`.
- **Webhook de la imprenta:** `POST /v1/webhooks/print/<proveedor>` con el cuerpo crudo; se verifica la firma.
- **Mi cuenta (`/es/cuenta`):** pedidos en vivo, descarga, "Pedir de nuevo" (sin IA), perfiles con "Borrar datos" y "Borrar mi cuenta".

## 6. Secretos por plataforma

Cada secreto se carga con `infra/scripts/set-secret.sh <proyecto> <secreto>` cuando su fase lo necesita. En local, el mismo valor va en `.env.local`.

| Secreto                                      | Plataforma                                  | Fase |
| -------------------------------------------- | ------------------------------------------- | ---- |
| `stripe-secret-key`, `stripe-webhook-secret` | Stripe                                      | 11   |
| `gelato-api-key`, `gelato-webhook-secret`    | Gelato                                      | 12   |
| `resend-api-key`                             | Resend                                      | 13   |
| `meta-capi-access-token`                     | Meta                                        | 11   |
| `anthropic-api-key`, `flux-api-key`          | Opcionales (proveedores alternativos de IA) | 07   |

## 7. Producción

Se completa en la fase 18 (checklist de salida).
