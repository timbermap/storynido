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

## 3. Secretos por plataforma

Cada secreto se carga con `infra/scripts/set-secret.sh <proyecto> <secreto>` cuando su fase lo necesita. En local, el mismo valor va en `.env.local`.

| Secreto                                      | Plataforma                                  | Fase |
| -------------------------------------------- | ------------------------------------------- | ---- |
| `stripe-secret-key`, `stripe-webhook-secret` | Stripe                                      | 11   |
| `gelato-api-key`, `gelato-webhook-secret`    | Gelato                                      | 12   |
| `resend-api-key`                             | Resend                                      | 13   |
| `meta-capi-access-token`                     | Meta                                        | 11   |
| `anthropic-api-key`, `flux-api-key`          | Opcionales (proveedores alternativos de IA) | 07   |

## 4. Producción

Se completa en la fase 18 (checklist de salida).
