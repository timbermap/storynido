variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "environment" {
  type        = string
  description = "Nombre del ambiente, para los títulos."
}

variable "alert_email" {
  type        = string
  description = "Email que recibe las alertas."
}

variable "api_host" {
  type        = string
  description = "Host público de la API para el uptime check (sin https://)."
}

variable "cloud_run_services" {
  type        = list(string)
  description = "Servicios de Cloud Run a vigilar por errores 5xx."
}

variable "max_5xx_per_5m" {
  type        = number
  default     = 5
  description = "Cantidad de respuestas 5xx en 5 minutos que dispara una alerta."
}

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "StoryNido ${var.environment} · email"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_uptime_check_config" "api" {
  project      = var.project_id
  display_name = "api /health (${var.environment})"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.api_host
    }
  }
}

resource "google_monitoring_alert_policy" "api_down" {
  project               = var.project_id
  display_name          = "StoryNido ${var.environment}: API caída"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "El uptime check de /health falla"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.api.uptime_check_id}\" AND resource.type=\"uptime_url\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }
      trigger {
        count = 1
      }
    }
  }
}

resource "google_monitoring_alert_policy" "run_5xx" {
  for_each = toset(var.cloud_run_services)

  project               = var.project_id
  display_name          = "StoryNido ${var.environment}: errores 5xx en ${each.value}"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "Más de ${var.max_5xx_per_5m} respuestas 5xx en 5 minutos"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${each.value}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.response_code_class=\"5xx\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.max_5xx_per_5m
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger {
        count = 1
      }
    }
  }
}

output "email_channel_id" {
  description = "ID del canal de notificación por email."
  value       = google_monitoring_notification_channel.email.id
}
