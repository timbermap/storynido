variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "services" {
  type        = list(string)
  description = "APIs a habilitar (por ejemplo run.googleapis.com)."
}

resource "google_project_service" "this" {
  for_each = toset(var.services)

  project = var.project_id
  service = each.value

  # Deshabilitar una API al destruir puede romper otros recursos del proyecto.
  disable_on_destroy = false
}

output "services" {
  description = "APIs habilitadas."
  value       = [for s in google_project_service.this : s.service]
}
