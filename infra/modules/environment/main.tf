locals {
  labels = {
    app        = "storynido"
    env        = var.environment
    managed-by = "terraform"
  }

  is_production = var.environment == "production"

  services = [
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbuild.googleapis.com",
    "clouderrorreporting.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudtrace.googleapis.com",
    "developerconnect.googleapis.com",
    "firebase.googleapis.com",
    "firebaseapphosting.googleapis.com",
    "firebaserules.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "identitytoolkit.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "recaptchaenterprise.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
    "vision.googleapis.com",
    "workflowexecutions.googleapis.com",
    "workflows.googleapis.com",
  ]

  observability_roles = [
    "roles/cloudtrace.agent",
    "roles/errorreporting.writer",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ]
}

data "google_project" "this" {
  project_id = var.project_id
}

module "apis" {
  source = "../apis"

  project_id = var.project_id
  services   = local.services
}

# --- Cuentas de servicio (mínimo privilegio) -----------------------------------

module "service_accounts" {
  source     = "../service_accounts"
  depends_on = [module.apis]

  project_id = var.project_id
  accounts = {
    sn-api = {
      display_name = "StoryNido API"
      description  = "Cloud Run: API pública."
      project_roles = concat(local.observability_roles, [
        "roles/aiplatform.user",
        "roles/cloudtasks.enqueuer",
        "roles/datastore.user",
        "roles/firebaseauth.admin",
        "roles/pubsub.publisher",
        "roles/recaptchaenterprise.agent",
        "roles/workflows.invoker",
      ])
    }
    sn-worker = {
      display_name = "StoryNido worker"
      description  = "Cloud Run: worker del pipeline de generación."
      project_roles = concat(local.observability_roles, [
        "roles/aiplatform.user",
        "roles/cloudtasks.enqueuer",
        "roles/datastore.user",
        "roles/pubsub.publisher",
        "roles/workflows.invoker",
      ])
    }
    sn-workflows = {
      display_name = "StoryNido workflows"
      description  = "Cloud Workflows: orquestación del pipeline."
      project_roles = [
        "roles/cloudtasks.enqueuer",
        "roles/logging.logWriter",
      ]
    }
    sn-invoker = {
      display_name  = "StoryNido invoker"
      description   = "Identidad OIDC de Cloud Tasks, Pub/Sub y Scheduler para llamar al worker."
      project_roles = []
    }
    sn-deployer = {
      display_name = "StoryNido deployer (GitHub Actions)"
      description  = "CI/CD vía Workload Identity Federation (Cloud Run, reglas e índices de Firestore). Sin claves JSON."
      project_roles = [
        "roles/datastore.indexAdmin",
        "roles/firebase.viewer",
        "roles/firebaserules.admin",
        "roles/run.developer",
        "roles/serviceusage.serviceUsageConsumer",
      ]
    }
  }
}

locals {
  sa      = module.service_accounts.emails
  member  = module.service_accounts.members
  sa_name = module.service_accounts.names
}

# api y worker firman URLs de Storage con su propia identidad (signBlob).
resource "google_service_account_iam_member" "self_token_creator" {
  for_each = toset(["sn-api", "sn-worker"])

  service_account_id = local.sa_name[each.value]
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.member[each.value]
}

# Quien encola tareas o crea suscripciones con OIDC debe poder "actuar como" sn-invoker.
resource "google_service_account_iam_member" "invoker_users" {
  for_each = toset(["sn-api", "sn-worker", "sn-workflows"])

  service_account_id = local.sa_name["sn-invoker"]
  role               = "roles/iam.serviceAccountUser"
  member             = local.member[each.value]
}

# El deployer despliega revisiones que corren como sn-api y sn-worker.
resource "google_service_account_iam_member" "deployer_acts_as" {
  for_each = toset(["sn-api", "sn-worker"])

  service_account_id = local.sa_name[each.value]
  role               = "roles/iam.serviceAccountUser"
  member             = local.member["sn-deployer"]
}

# --- Datos ---------------------------------------------------------------------

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  point_in_time_recovery_enablement = local.is_production ? "POINT_IN_TIME_RECOVERY_ENABLED" : "POINT_IN_TIME_RECOVERY_DISABLED"
  delete_protection_state           = var.deletion_protection ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"

  depends_on = [module.apis]
}

module "bucket_photos" {
  source     = "../storage_bucket"
  depends_on = [module.apis]

  project_id = var.project_id
  name       = "${var.project_id}-photos-original"
  location   = var.region
  labels     = merge(local.labels, { data = "minors-photos" })

  # Fotos de menores: borrado automático a los 30 días y sin soft delete,
  # para que un borrado a pedido sea definitivo de inmediato.
  delete_after_days             = 30
  soft_delete_retention_seconds = 0
  cors_origins                  = var.cors_origins
  force_destroy                 = !var.deletion_protection

  iam = {
    api    = { role = "roles/storage.objectAdmin", member = local.member["sn-api"] }
    worker = { role = "roles/storage.objectAdmin", member = local.member["sn-worker"] }
  }
}

module "bucket_assets" {
  source     = "../storage_bucket"
  depends_on = [module.apis]

  project_id    = var.project_id
  name          = "${var.project_id}-generated-assets"
  location      = var.region
  labels        = local.labels
  cors_origins  = var.cors_origins
  force_destroy = !var.deletion_protection

  iam = {
    api    = { role = "roles/storage.objectViewer", member = local.member["sn-api"] }
    worker = { role = "roles/storage.objectAdmin", member = local.member["sn-worker"] }
  }
}

module "bucket_pdfs" {
  source     = "../storage_bucket"
  depends_on = [module.apis]

  project_id    = var.project_id
  name          = "${var.project_id}-final-pdfs"
  location      = var.region
  labels        = local.labels
  cors_origins  = var.cors_origins
  force_destroy = !var.deletion_protection

  iam = {
    api    = { role = "roles/storage.objectViewer", member = local.member["sn-api"] }
    worker = { role = "roles/storage.objectAdmin", member = local.member["sn-worker"] }
  }
}

# --- Cómputo -------------------------------------------------------------------

module "registry" {
  source     = "../artifact_registry"
  depends_on = [module.apis]

  project_id    = var.project_id
  region        = var.region
  repository_id = "storynido"
  labels        = local.labels
  writers = {
    deployer = local.member["sn-deployer"]
  }
}

locals {
  common_env = {
    APP_ENV        = var.environment
    GCP_PROJECT_ID = var.project_id
    GCP_REGION     = var.region
    BRAND_DOMAIN   = var.public_domain
    LOG_LEVEL      = var.log_level
    BUCKET_PHOTOS  = module.bucket_photos.name
    BUCKET_ASSETS  = module.bucket_assets.name
    BUCKET_PDFS    = module.bucket_pdfs.name
    INVOKER_SA     = local.sa["sn-invoker"]
  }
}

module "worker" {
  source = "../cloud_run_service"

  project_id          = var.project_id
  region              = var.region
  name                = "worker"
  service_account     = local.sa["sn-worker"]
  min_instances       = var.worker_scaling.min
  max_instances       = var.worker_scaling.max
  cpu                 = "2"
  memory              = "2Gi"
  concurrency         = 4
  timeout_seconds     = 900
  deletion_protection = var.deletion_protection
  labels              = local.labels
  env                 = local.common_env

  invokers = {
    invoker   = local.member["sn-invoker"]
    workflows = local.member["sn-workflows"]
  }

  depends_on = [module.apis]
}

module "api" {
  source = "../cloud_run_service"

  project_id          = var.project_id
  region              = var.region
  name                = "api"
  service_account     = local.sa["sn-api"]
  min_instances       = var.api_scaling.min
  max_instances       = var.api_scaling.max
  deletion_protection = var.deletion_protection
  labels              = local.labels
  env                 = merge(local.common_env, { WORKER_URL = module.worker.uri })

  # La API es pública: la autenticación la hacen Firebase Auth y App Check en la app.
  public = true

  depends_on = [module.apis]
}

resource "google_cloud_run_domain_mapping" "api" {
  count = var.api_domain == "" ? 0 : 1

  project  = var.project_id
  location = var.region
  name     = var.api_domain

  metadata {
    namespace = var.project_id
    labels    = local.labels
  }

  spec {
    route_name = module.api.name
  }
}

# --- Asíncrono -----------------------------------------------------------------

module "messaging" {
  source     = "../messaging"
  depends_on = [module.apis]

  project_id     = var.project_id
  project_number = data.google_project.this.number
  region         = var.region
  labels         = local.labels

  topics = ["order-paid", "order-events"]

  push_subscriptions = {
    order-paid-to-worker = {
      topic                = "order-paid"
      push_endpoint        = "${module.worker.uri}/pubsub/order-paid"
      oidc_service_account = local.sa["sn-invoker"]
    }
  }

  queues = {
    pipeline-steps = {
      max_dispatches_per_second = 10
      max_concurrent_dispatches = 50
      max_attempts              = 5
    }
    illustrations = {
      max_dispatches_per_second = 5
      max_concurrent_dispatches = 20
      max_attempts              = 5
      min_backoff               = "10s"
    }
    emails = {
      max_dispatches_per_second = 20
      max_concurrent_dispatches = 50
      max_attempts              = 10
    }
  }
}

# Cloud Workflows necesita su agente de servicio antes de crear el primer workflow.
resource "google_project_service_identity" "workflows" {
  provider = google-beta

  project = var.project_id
  service = "workflows.googleapis.com"

  depends_on = [module.apis]
}

module "order_pipeline" {
  source     = "../workflow"
  depends_on = [google_project_service_identity.workflows]

  project_id          = var.project_id
  region              = var.region
  name                = "order-pipeline"
  description         = "Pipeline de generación y entrega de un pedido pagado."
  service_account     = local.sa["sn-workflows"]
  source_contents     = file("${path.module}/../../workflows/order-pipeline.yaml")
  deletion_protection = var.deletion_protection
  labels              = local.labels
  env = {
    WORKER_URL = module.worker.uri
  }
}

# --- Secretos (sin valores: se cargan con gcloud, ver infra/README.md) --------

module "secrets" {
  source     = "../secrets"
  depends_on = [module.apis]

  project_id = var.project_id
  labels     = local.labels

  secrets = {
    stripe-secret-key = {
      description = "Stripe: clave secreta (sk_...)"
      accessors   = { api = local.member["sn-api"] }
    }
    stripe-webhook-secret = {
      description = "Stripe: secreto de firma de webhooks (whsec_...)"
      accessors   = { api = local.member["sn-api"] }
    }
    gelato-api-key = {
      description = "Gelato: API key"
      accessors   = { api = local.member["sn-api"], worker = local.member["sn-worker"] }
    }
    gelato-webhook-secret = {
      description = "Gelato: secreto de verificación de webhooks"
      accessors   = { api = local.member["sn-api"] }
    }
    resend-api-key = {
      description = "Resend: API key de emails"
      accessors   = { api = local.member["sn-api"], worker = local.member["sn-worker"] }
    }
    anthropic-api-key = {
      description = "Anthropic: API key (opcional, si se usa Claude para texto)"
      accessors   = { api = local.member["sn-api"], worker = local.member["sn-worker"] }
    }
    flux-api-key = {
      description = "Flux: API key (opcional, si se usa Flux para imágenes)"
      accessors   = { api = local.member["sn-api"], worker = local.member["sn-worker"] }
    }
    meta-capi-access-token = {
      description = "Meta: token de la API de Conversiones"
      accessors   = { api = local.member["sn-api"] }
    }
  }
}

# --- Firebase ------------------------------------------------------------------

module "firebase" {
  source     = "../firebase"
  depends_on = [module.apis]

  project_id  = var.project_id
  environment = var.environment
}

# --- CI/CD ---------------------------------------------------------------------

module "github_wif" {
  source     = "../github_wif"
  depends_on = [module.apis]

  project_id                 = var.project_id
  github_repository          = var.github_repository
  github_repository_owner_id = var.github_repository_owner_id
  github_environment         = var.environment
  service_account_name       = local.sa_name["sn-deployer"]
}

# --- Monitoreo y costos --------------------------------------------------------

module "monitoring" {
  source     = "../monitoring"
  depends_on = [module.apis]

  project_id         = var.project_id
  environment        = var.environment
  alert_email        = var.alert_email
  api_host           = var.api_domain != "" ? var.api_domain : trimprefix(module.api.uri, "https://")
  cloud_run_services = [module.api.name, module.worker.name]
}

module "budget" {
  source     = "../budget"
  depends_on = [module.apis]

  billing_account       = var.billing_account
  project_number        = data.google_project.this.number
  display_name          = "StoryNido ${var.environment}"
  amount                = var.budget_amount
  currency              = var.budget_currency
  notification_channels = [module.monitoring.email_channel_id]
}
