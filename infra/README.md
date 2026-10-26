# infra/ · Terraform (Google Cloud)

Toda la infraestructura de StoryNido como código. Un proyecto de Google Cloud por ambiente:

| Ambiente     | Proyecto (sugerido) | Deploy                              | Sitio                   |
| ------------ | ------------------- | ----------------------------------- | ----------------------- |
| `staging`    | `storynido-staging` | automático al pasar el CI de `main` | `staging.storynido.com` |
| `production` | `storynido-prod`    | al publicar un tag `v*`             | `storynido.com`         |

## Estructura

```
infra/
├── envs/
│   ├── staging/       # raíz de Terraform del ambiente (provider, backend, variables)
│   └── production/
├── modules/
│   ├── environment/   # compone un ambiente completo con los módulos de abajo
│   ├── apis/  service_accounts/  storage_bucket/  cloud_run_service/
│   ├── messaging/     # Pub/Sub + Cloud Tasks
│   ├── workflow/  secrets/  artifact_registry/  github_wif/
│   ├── monitoring/  budget/  firebase/
├── workflows/order-pipeline.yaml   # definición de Cloud Workflows (placeholder hasta la fase 08)
└── scripts/
    ├── bootstrap.sh     # crea proyecto, facturación y bucket del state
    ├── github-vars.sh   # crea el environment de GitHub y carga sus variables
    └── set-secret.sh    # carga o rota un secreto en Secret Manager
```

## Qué crea cada ambiente

| Recurso             | Detalle                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APIs                | Run, Firestore, Storage, Tasks, Pub/Sub, Workflows, Secret Manager, Artifact Registry, Vertex AI, Vision, Monitoring, Logging, Error Reporting, Trace, reCAPTCHA Enterprise, Firebase, App Hosting, Identity Toolkit, Scheduler, Budgets    |
| Cuentas de servicio | `sn-api`, `sn-worker`, `sn-workflows`, `sn-invoker` (OIDC para Tasks/Pub/Sub), `sn-deployer` (CI) — cada una con solo los roles que necesita                                                                                                |
| Firestore           | `(default)`, modo nativo, `nam5`. En production: PITR y protección contra borrado                                                                                                                                                           |
| Buckets             | `<proyecto>-photos-original` (borrado automático a 30 días, sin soft delete), `<proyecto>-generated-assets`, `<proyecto>-final-pdfs`. Todos privados (UBLA + public access prevention), acceso solo por cuentas de servicio y URLs firmadas |
| Cloud Run           | `api` (pública, auth en la app) y `worker` (privado: solo `sn-invoker` y `sn-workflows`). Staging escala a cero                                                                                                                             |
| Pub/Sub             | `order-paid` (push autenticado al worker), `order-events`, `dead-letter`                                                                                                                                                                    |
| Cloud Tasks         | `pipeline-steps`, `illustrations`, `emails`                                                                                                                                                                                                 |
| Workflows           | `order-pipeline`                                                                                                                                                                                                                            |
| Secret Manager      | `stripe-secret-key`, `stripe-webhook-secret`, `gelato-api-key`, `gelato-webhook-secret`, `resend-api-key`, `anthropic-api-key`, `flux-api-key`, `meta-capi-access-token` (sin valores)                                                      |
| Artifact Registry   | `storynido` (Docker), conserva las 10 últimas versiones y borra lo de más de 30 días                                                                                                                                                        |
| Firebase            | Proyecto Firebase y apps web `web` y `admin`                                                                                                                                                                                                |
| CI/CD               | Workload Identity Federation: solo el repo `timbermap/storynido`, y solo jobs en el environment de GitHub del mismo nombre                                                                                                                  |
| Monitoreo           | Canal de email, uptime check de `/health`, alertas de API caída y de 5xx en api/worker                                                                                                                                                      |
| Costos              | Presupuesto mensual con avisos al 50 %, 90 % y 100 % (y 100 % proyectado)                                                                                                                                                                   |

## Requisitos

- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.17 (`brew install hashicorp/tap/terraform`)
- [gcloud](https://cloud.google.com/sdk/docs/install), `gh` y `jq`
- Una cuenta de Google con permiso para crear proyectos y usar una cuenta de facturación

## Bootstrap (una vez por ambiente)

> **No mezclar con Timbermap.** Usá la configuración de gcloud `storynido` sin activarla globalmente, anteponiendo `CLOUDSDK_ACTIVE_CONFIG_NAME=storynido` a cada comando (o exportándola solo en la terminal donde trabajás con StoryNido). Nunca uses `timbermap-prod`.

```bash
gcloud config configurations create storynido --no-activate
gcloud config set account sebastian@timbermap.com --configuration storynido
export CLOUDSDK_ACTIVE_CONFIG_NAME=storynido   # solo en esta terminal
gcloud auth login
gcloud billing accounts list                 # anotá el ID de la cuenta de facturación

# 1. Proyecto, facturación, APIs mínimas y bucket del state (genera envs/<env>/backend.hcl)
infra/scripts/bootstrap.sh staging storynido-staging XXXXXX-XXXXXX-XXXXXX

# 2. Credenciales locales para Terraform (sin claves JSON). Si ya tenés ADC de otro
#    proyecto no hace falta cambiarlas: el provider usa billing_project = proyecto de StoryNido.
gcloud auth application-default login

# 3. Variables del ambiente
cd infra/envs/staging
cp terraform.tfvars.example terraform.tfvars  # completar billing_account y alert_email

# 4. Aplicar
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Los IDs de proyecto son globales: si `storynido-staging` ya existe, elegí otro (por ejemplo `storynido-stg-1234`) y usalo en todos los pasos.

## Si se corta un `apply`

Si se pierde la conexión, Terraform guarda el state en `errored.tfstate`. Para recuperarlo:

```bash
# El ID del lock en el backend GCS es la generación del objeto .tflock
gcloud storage objects describe gs://<proyecto>-tfstate/terraform/state/default.tflock --format="value(generation)"
terraform force-unlock -force <generación>
terraform state push errored.tfstate
terraform plan   # si un recurso quedó "tainted" pero está sano en GCP: terraform untaint <dirección>
```

## Después del primer `apply`

1. **Variables de GitHub Actions** (sin secretos, gracias a WIF):
   ```bash
   infra/scripts/github-vars.sh staging
   gh variable set DEPLOY_ENABLED --body true   # una sola vez, activa los deploys
   ```
2. **Secretos**: cargar cada valor cuando la fase correspondiente lo necesite:
   ```bash
   infra/scripts/set-secret.sh storynido-staging stripe-secret-key   # pegar y Ctrl+D
   ```
   Para rotar una clave, se corre lo mismo: crea una versión nueva.
3. **Firebase App Hosting** (web y admin): se conecta a GitHub desde la consola o la CLI, porque requiere autorizar la app de GitHub de Firebase:
   ```bash
   firebase apphosting:backends:create --project storynido-staging
   # root directory: apps/web (y otro backend con apps/admin), rama: main, región: us-central1
   ```
   En el backend de staging, configurá _Environment name_ = `staging` para que se apliquen los overrides de `apphosting.staging.yaml`.
4. **Dominios**:
   - Verificá `storynido.com` en [Google Search Console](https://search.google.com/search-console) con la misma cuenta que corre Terraform (necesario para el dominio propio de la API).
   - `api.storynido.com` (production): Terraform crea el mapeo; agregá en tu proveedor de DNS los registros que muestra `gcloud beta run domain-mappings describe --domain api.storynido.com --region us-central1`.
   - `storynido.com`, `www` y `admin.storynido.com`: se agregan como dominios propios en cada backend de App Hosting, que indica los registros DNS.
   - `storynido.online` y `storynido.store`: redirección 301 a `https://storynido.com` desde el proveedor de dominios.

## Deploys

- **staging**: cada push a `main` con CI en verde construye las imágenes de `api` y `worker`, las sube a Artifact Registry y las despliega en Cloud Run.
- **production**: `git tag v0.1.0 && git push origin v0.1.0` (solo sobre commits de `main` con CI en verde), o _Run workflow_ en GitHub Actions → Deploy.
- Terraform ignora la imagen de Cloud Run: la maneja el deploy. Cualquier otro cambio de configuración se hace en Terraform.
- Web y admin los despliega App Hosting directamente desde GitHub.

## Calidad

En CI: `terraform fmt -check`, `terraform validate` de ambos ambientes y `tflint` (reglas recomendadas + plugin de Google). En local:

```bash
terraform fmt -recursive infra
terraform -chdir=infra/envs/staging init -backend=false && terraform -chdir=infra/envs/staging validate
cd infra && tflint --init --config "$PWD/.tflint.hcl" && tflint --recursive --config "$PWD/.tflint.hcl"
```
