# Lista de salida a producción

Lo que falta para abrir la venta. Se marca ✅ solo lo verificado. El orden de la tabla es el orden sugerido. Operación diaria: [`RUNBOOK.md`](RUNBOOK.md).

**Leyenda:**

- 👤 lo hace Sebastián (cuentas, DNS, contratos o decisiones);
- 🤖 se hace en el repo;
- 🤝 los dos.

## 1. Decisiones pendientes

| Estado | Qué                                                                                                                               | Quién |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ⬜     | Procesador de pagos (Gumroad, PagueloFacil o Paymentwall; Paymentwall espera aprobación)                                          | 👤    |
| ⬜     | Imprenta para Latinoamérica (respuestas de Cloudprinter, RPI y Peecho)                                                            | 👤    |
| ⬜     | BookVault para Europa (sí o no)                                                                                                   | 👤    |
| ⬜     | Revisar márgenes por producto (Admin → Precios y márgenes) y activarlos en producción; todos los países se venden (DECISIONS 096) | 👤    |

## 2. Calidad antes de vender

| Estado | Qué                                                                                                                                                         | Quién |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ✅     | E2E, accesibilidad (WCAG 2.2 AA), Lighthouse y carga (fase 17)                                                                                              | 🤖    |
| ⬜     | Pedido real en staging con IA real, de punta a punta (la traza completa del pedido en Cloud Trace)                                                          | 🤝    |
| ⬜     | Muestra física de cada SKU (Gelato y Lulu): valida el archivo y habilita `qaSamplePassed` en producción                                                     | 👤    |
| ⬜     | Panel humano: 25 compradores y 10 profesionales (ver `QA-SCENARIOS.md`)                                                                                     | 👤    |
| ✅     | Escenario 22: fecha del regalo con aviso si no llega                                                                                                        | 🤖    |
| ⬜     | Lulu: prueba completa en sandbox (webhook del sandbox registrado y recibido el 2026-10-29; en producción: `infra/scripts/lulu-webhook.sh production <api>`) | 🤝    |

## 3. Legal y privacidad

| Estado | Qué                                                                                                                             | Quién |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ⬜     | Revisión de un abogado: `PRIVACY.md`, términos y textos de consentimiento (fotos, tutor)                                        | 👤    |
| ⬜     | Responsable en privacidad y términos: hoy dice "StoryNido SRL, Uruguay" (provisorio). Confirmar razón social y domicilio reales | 👤    |
| ⬜     | Dirección postal para el pie de los mails (CAN-SPAM): `email_postal_address` en `infra/envs/production/main.tf`                 | 👤    |

## 4. Infraestructura de producción (`storynido-prod`)

| Estado | Qué                                                                                                                                                                                                                                                                                                                        | Quién |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ⬜     | Copiar `infra/envs/production/terraform.tfvars.example` y `backend.hcl.example`, completar (presupuesto, mail de alertas, imprentas, pagos)                                                                                                                                                                                | 🤝    |
| ⬜     | `terraform plan` y `apply` en `infra/envs/production` (con OK sobre el plan y estimación de costos)                                                                                                                                                                                                                        | 👤    |
| ⬜     | Cargar los secretos con `infra/scripts/set-secret.sh storynido-prod <secreto>` (claves de producción de cada proveedor)                                                                                                                                                                                                    | 👤    |
| ⬜     | Backends de App Hosting `web` y `admin` en producción (`firebase apphosting:backends:create`)                                                                                                                                                                                                                              | 👤    |
| ⬜     | Variable `DEPLOY_ENABLED` y las variables del ambiente `production` en GitHub (salen de `terraform output github_actions`)                                                                                                                                                                                                 | 🤝    |
| ⬜     | Seed de producción, después del `apply`: `pnpm --filter @storynido/firebase seed:cloud --project storynido-prod`. Sin usuarios ni cupones de prueba ni imprentas simuladas; precios inactivos (se revisan y activan en el admin); sitio en "Solo vista previa"; presupuesto de IA de USD 2 por día (subirlo en Admin → IA) | 🤝    |

## 5. Dominios (requieren autorización en los DNS)

| Estado | Qué                                                                                | Quién |
| ------ | ---------------------------------------------------------------------------------- | ----- |
| ⬜     | `storynido.com` → App Hosting `web` (producción)                                   | 👤    |
| ⬜     | `www.storynido.com` → redirección a `storynido.com`                                | 👤    |
| ⬜     | `api.storynido.com` → Cloud Run `api` (variable `api_domain`)                      | 🤝    |
| ⬜     | Admin: subdominio propio (por ejemplo `admin.storynido.com`) → App Hosting `admin` | 👤    |
| ⬜     | Resend: dominio verificado (SPF, DKIM y DMARC) para `hola@storynido.com`           | 👤    |

## 6. Seguridad

| Estado | Qué                                                                                                                                               | Quién |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ⬜     | Identity Platform con TOTP en producción (en staging, aplicado el 2026-10-29; producción ya exige 2FA en el admin por defecto)                    | 🤝    |
| ⬜     | App Check en producción: la clave sale del `terraform apply` (en staging, clave creada y App Check sin exigir); exigirlo con `APP_CHECK_ENFORCED` | 🤝    |
| ⬜     | Webhooks de pagos e imprentas registrados con sus secretos                                                                                        | 👤    |
| ✅     | Gitleaks y `pnpm audit` en CI; CSP y cabeceras de seguridad; rate limit                                                                           | 🤖    |

## 7. Monitoreo

| Estado | Qué                                                                                        | Quién |
| ------ | ------------------------------------------------------------------------------------------ | ----- |
| ✅     | Alertas, panel, Error Reporting y vigía del pipeline (verificado en staging el 2026-10-28) | 🤖    |
| ✅     | Spans en Cloud Trace: llegan los de la API (verificado en staging el 2026-10-29)           | 🤖    |
| ⬜     | Presupuesto mensual de producción y mail de alertas confirmados                            | 👤    |

## 8. Día del lanzamiento

1. Admin de producción → Sitio → "Solo vista previa".
2. `git tag v1.0.0 && git push --tags`: despliega producción. Después, `firebase deploy --only apphosting --project storynido-prod`.
3. Prueba de humo:
   - la web, el admin y `/health` de la API;
   - un pedido digital pagado con tarjeta real y reembolsado desde el admin;
   - un pedido impreso a la dirección propia.
4. Revisar Error Reporting y el panel de monitoreo.
5. Admin → Sitio → "En vivo".
6. Los primeros días: revisar cada pedido en revisión manual y las alertas.

## Login con Google desde el dominio propio (DECISIONS 106)

- En `apps/web/apphosting.yaml` (producción) agregar `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: storynido.com` cuando el dominio esté conectado.
- En Google Cloud Console → APIs y servicios → Credenciales → "Web client (auto created by Google Service)", agregar la URI de redirección `https://storynido.com/__/auth/handler`.
