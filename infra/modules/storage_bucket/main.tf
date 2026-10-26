variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "name" {
  type        = string
  description = "Nombre global del bucket."
}

variable "location" {
  type        = string
  description = "Región o multirregión del bucket."
}

variable "delete_after_days" {
  type        = number
  default     = null
  description = "Si se define, los objetos se borran automáticamente después de esta cantidad de días."
}

variable "soft_delete_retention_seconds" {
  type        = number
  default     = 604800
  description = "Retención de objetos borrados. 0 desactiva el soft delete (borrado definitivo inmediato)."
}

variable "cors_origins" {
  type        = list(string)
  default     = []
  description = "Orígenes permitidos para subir o descargar con URLs firmadas desde el navegador."
}

variable "iam" {
  type = map(object({
    role   = string
    member = string
  }))
  default     = {}
  description = "Permisos sobre el bucket, con claves estáticas (por ejemplo api_admin)."
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Permite destruir el bucket aunque tenga objetos (solo staging)."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas del bucket."
}

resource "google_storage_bucket" "this" {
  project       = var.project_id
  name          = var.name
  location      = var.location
  storage_class = "STANDARD"
  labels        = var.labels
  force_destroy = var.force_destroy

  # Nunca público: el acceso es solo por cuentas de servicio y URLs firmadas.
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = var.soft_delete_retention_seconds
  }

  dynamic "lifecycle_rule" {
    for_each = var.delete_after_days == null ? [] : [var.delete_after_days]
    content {
      condition {
        age = lifecycle_rule.value
      }
      action {
        type = "Delete"
      }
    }
  }

  dynamic "cors" {
    for_each = length(var.cors_origins) == 0 ? [] : [var.cors_origins]
    content {
      origin          = cors.value
      method          = ["GET", "HEAD", "PUT"]
      response_header = ["Content-Type", "Content-Length", "x-goog-content-sha256"]
      max_age_seconds = 3600
    }
  }
}

resource "google_storage_bucket_iam_member" "this" {
  for_each = var.iam

  bucket = google_storage_bucket.this.name
  role   = each.value.role
  member = each.value.member
}

output "name" {
  description = "Nombre del bucket."
  value       = google_storage_bucket.this.name
}
