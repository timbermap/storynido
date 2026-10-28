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

variable "email_provider" {
  type        = string
  default     = "mock"
  description = "Mails: mock (no se mandan) o resend (requiere el secreto resend-api-key con valor)."

  validation {
    condition     = contains(["mock", "resend"], var.email_provider)
    error_message = "email_provider debe ser mock o resend."
  }
}

variable "email_link_secret_loaded" {
  type        = bool
  default     = false
  description = "El secreto email-link-secret ya tiene valor: recién entonces los servicios lo leen (firma de las bajas)."
}

variable "admin_url" {
  type        = string
  default     = ""
  description = "URL del panel de administración (enlace de las alertas por mail). Vacío: la web."
}

variable "print_providers" {
  type        = list(string)
  default     = ["mock"]
  description = "Imprentas activas (se cotiza con todas y gana la más barata): mock, mock_alt, gelato."

  validation {
    condition     = length(var.print_providers) > 0 && alltrue([for id in var.print_providers : contains(["mock", "mock_alt", "gelato", "cloudprinter"], id)])
    error_message = "print_providers: una o más de mock, mock_alt, gelato, cloudprinter."
  }
}

variable "gelato_order_type" {
  type        = string
  default     = "draft"
  description = "Gelato: draft (queda en borrador, no se fabrica ni se cobra) u order (producción)."

  validation {
    condition     = contains(["draft", "order"], var.gelato_order_type)
    error_message = "gelato_order_type debe ser draft u order."
  }
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
