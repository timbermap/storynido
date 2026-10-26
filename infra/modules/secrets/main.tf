variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "secrets" {
  type = map(object({
    description = string
    accessors   = map(string)
  }))
  description = "Secretos por ID, con quién puede leerlos (claves estáticas). Los valores se cargan fuera de Terraform."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas."
}

resource "google_secret_manager_secret" "this" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = each.key
  labels    = var.labels
  annotations = {
    description = each.value.description
  }

  replication {
    auto {}
  }
}

locals {
  access = merge([
    for id, secret in var.secrets : {
      for name, member in secret.accessors : "${id}/${name}" => { secret = id, member = member }
    }
  ]...)
}

resource "google_secret_manager_secret_iam_member" "this" {
  for_each = local.access

  project   = var.project_id
  secret_id = google_secret_manager_secret.this[each.value.secret].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}

output "ids" {
  description = "IDs de los secretos."
  value       = keys(google_secret_manager_secret.this)
}
