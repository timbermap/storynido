variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "region" {
  type        = string
  description = "Región de Cloud Run."
}

variable "name" {
  type        = string
  description = "Nombre del servicio."
}

variable "service_account" {
  type        = string
  description = "Email de la cuenta de servicio con la que corre el servicio."
}

variable "image" {
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
  description = "Imagen inicial. Después la actualiza el deploy de CI y Terraform la ignora."
}

variable "min_instances" {
  type        = number
  description = "Instancias mínimas (0 = escala a cero)."
}

variable "max_instances" {
  type        = number
  description = "Instancias máximas."
}

variable "cpu" {
  type        = string
  default     = "1"
  description = "CPU por instancia."
}

variable "memory" {
  type        = string
  default     = "512Mi"
  description = "Memoria por instancia."
}

variable "concurrency" {
  type        = number
  default     = 80
  description = "Requests simultáneos por instancia."
}

variable "timeout_seconds" {
  type        = number
  default     = 60
  description = "Timeout de cada request."
}

variable "env" {
  type        = map(string)
  default     = {}
  description = "Variables de entorno no secretas."
}

variable "public" {
  type        = bool
  default     = false
  description = "Si es true, cualquiera puede invocarlo (la autenticación la hace la app)."
}

variable "invokers" {
  type        = map(string)
  default     = {}
  description = "Miembros IAM con permiso de invocar, con claves estáticas."
}

variable "deletion_protection" {
  type        = bool
  default     = true
  description = "Impide borrar el servicio desde Terraform."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas del servicio."
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  location            = var.region
  name                = var.name
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.deletion_protection
  labels              = var.labels

  template {
    service_account                  = var.service_account
    timeout                          = "${var.timeout_seconds}s"
    max_instance_request_concurrency = var.concurrency

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
      }
    }
  }

  lifecycle {
    # La imagen la despliega GitHub Actions; Terraform maneja el resto de la configuración.
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.public ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = var.invokers

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = each.value
}

output "name" {
  description = "Nombre del servicio."
  value       = google_cloud_run_v2_service.this.name
}

output "uri" {
  description = "URL pública del servicio."
  value       = google_cloud_run_v2_service.this.uri
}
