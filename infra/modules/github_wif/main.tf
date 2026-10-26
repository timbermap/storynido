variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "github_repository" {
  type        = string
  description = "Repositorio autorizado, en formato owner/repo."
}

variable "github_repository_owner_id" {
  type        = string
  description = "ID numérico del dueño del repo (evita que otro repo con el mismo nombre pueda autenticarse)."
}

variable "github_environment" {
  type        = string
  description = "Environment de GitHub Actions que puede usar la cuenta de servicio (staging o production)."
}

variable "service_account_name" {
  type        = string
  description = "Nombre completo de recurso de la cuenta de servicio de deploy."
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.environment"         = "assertion.environment"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\" && assertion.repository_owner_id == \"${var.github_repository_owner_id}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Solo los jobs que corren en el environment de GitHub correspondiente pueden actuar como el deployer.
resource "google_service_account_iam_member" "deployer" {
  service_account_id = var.service_account_name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.environment/${var.github_environment}"
}

output "provider_name" {
  description = "Valor para workload_identity_provider en google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}
