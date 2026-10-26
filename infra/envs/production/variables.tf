variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud de production."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Región principal."
}

variable "firestore_location" {
  type        = string
  default     = "nam5"
  description = "Ubicación de Firestore. No se puede cambiar después de crearla."
}

variable "api_domain" {
  type        = string
  default     = "api.storynido.com"
  description = "Dominio propio de la API. Vacío = URL de Cloud Run. Requiere verificar el dominio en Google."
}

variable "alert_email" {
  type        = string
  description = "Email para alertas de monitoreo y presupuesto."
}

variable "billing_account" {
  type        = string
  description = "ID de la cuenta de facturación (XXXXXX-XXXXXX-XXXXXX)."
}

variable "budget_amount" {
  type        = number
  default     = 500
  description = "Presupuesto mensual."
}

variable "photo_analyzer" {
  type        = string
  default     = "vision"
  description = "Análisis de fotos: mock o vision (Cloud Vision, costo por imagen)."
}

variable "budget_currency" {
  type        = string
  default     = "USD"
  description = "Moneda de la cuenta de facturación."
}
