variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "region" {
  type        = string
  description = "Región del workflow."
}

variable "name" {
  type        = string
  description = "Nombre del workflow."
}

variable "description" {
  type        = string
  description = "Descripción."
}

variable "service_account" {
  type        = string
  description = "Email de la cuenta de servicio con la que corre."
}

variable "source_contents" {
  type        = string
  description = "Definición YAML del workflow."
}

variable "env" {
  type        = map(string)
  default     = {}
  description = "Variables disponibles con sys.get_env()."
}

variable "deletion_protection" {
  type        = bool
  default     = true
  description = "Impide borrar el workflow desde Terraform."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas."
}

resource "google_workflows_workflow" "this" {
  project             = var.project_id
  region              = var.region
  name                = var.name
  description         = var.description
  service_account     = var.service_account
  source_contents     = var.source_contents
  user_env_vars       = var.env
  call_log_level      = "LOG_ERRORS_ONLY"
  deletion_protection = var.deletion_protection
  labels              = var.labels
}

output "id" {
  description = "ID del workflow."
  value       = google_workflows_workflow.this.id
}
