variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud de este ambiente."
}

variable "environment" {
  type        = string
  description = "Nombre del ambiente: staging o production. Debe coincidir con el environment de GitHub Actions."

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment debe ser staging o production."
  }
}

variable "region" {
  type        = string
  description = "Región principal (Cloud Run, Tasks, Workflows, Artifact Registry, buckets)."
}

variable "firestore_location" {
  type        = string
  description = "Ubicación de Firestore (por ejemplo nam5). No se puede cambiar después de crearla."
}

variable "public_domain" {
  type        = string
  description = "Dominio del sitio público en este ambiente (sin https://)."
}

variable "api_domain" {
  type        = string
  default     = ""
  description = "Dominio propio de la API (por ejemplo api.storynido.com). Vacío = usar la URL de Cloud Run."
}

variable "cors_origins" {
  type        = list(string)
  description = "Orígenes que pueden subir y descargar archivos con URLs firmadas."
}

variable "github_repository" {
  type        = string
  description = "Repositorio de GitHub autorizado a desplegar (owner/repo)."
}

variable "github_repository_owner_id" {
  type        = string
  description = "ID numérico del dueño del repositorio de GitHub."
}

variable "alert_email" {
  type        = string
  description = "Email que recibe alertas de monitoreo y presupuesto."
}

variable "billing_account" {
  type        = string
  description = "ID de la cuenta de facturación para el presupuesto."
}

variable "budget_amount" {
  type        = number
  description = "Presupuesto mensual del proyecto."
}

variable "budget_currency" {
  type        = string
  default     = "USD"
  description = "Moneda del presupuesto (la de la cuenta de facturación)."
}

variable "api_scaling" {
  type = object({
    min = number
    max = number
  })
  description = "Instancias mínimas y máximas de la API."
}

variable "worker_scaling" {
  type = object({
    min = number
    max = number
  })
  description = "Instancias mínimas y máximas del worker."
}

variable "deletion_protection" {
  type        = bool
  description = "Protege contra borrado los recursos con datos (Firestore, Cloud Run, Workflows)."
}

variable "photo_analyzer" {
  type        = string
  default     = "mock"
  description = "Análisis de fotos: mock (sin costo) o vision (Cloud Vision, con costo por imagen)."

  validation {
    condition     = contains(["mock", "vision"], var.photo_analyzer)
    error_message = "photo_analyzer debe ser mock o vision."
  }
}

variable "log_level" {
  type        = string
  default     = "info"
  description = "LOG_LEVEL de los servicios."
}
