variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "region" {
  type        = string
  description = "Región del repositorio."
}

variable "repository_id" {
  type        = string
  description = "Nombre del repositorio Docker."
}

variable "keep_recent_versions" {
  type        = number
  default     = 10
  description = "Cantidad de versiones recientes que nunca se borran."
}

variable "writers" {
  type        = map(string)
  default     = {}
  description = "Miembros IAM que pueden subir imágenes, con claves estáticas."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas."
}

resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_id
  format        = "DOCKER"
  labels        = var.labels

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = var.keep_recent_versions
    }
  }

  cleanup_policies {
    id     = "delete-older-than-30d"
    action = "DELETE"
    condition {
      older_than = "2592000s"
    }
  }
}

resource "google_artifact_registry_repository_iam_member" "writers" {
  for_each = var.writers

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.this.name
  role       = "roles/artifactregistry.writer"
  member     = each.value
}

output "url" {
  description = "Prefijo de las imágenes (REGION-docker.pkg.dev/PROYECTO/REPO)."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.this.repository_id}"
}
