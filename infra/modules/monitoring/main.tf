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

variable "ai_calls_per_30m" {
  type        = number
  default     = 300
  description = "Llamadas de IA en 30 minutos que se consideran un pico de costo."
}

# --- Métricas desde los logs estructurados (fase 16, DECISIONS 089) -------------------
# Los servicios loguean `event` con sus datos; Cloud Monitoring cuenta y mide desde ahí.

locals {
  run_logs = "resource.type=\"cloud_run_revision\""
  counters = {
    pipeline_failed  = "Pedidos que pasaron a revisión manual"
    pipeline_stuck   = "Pedidos atascados generando (vigía)"
    webhook_rejected = "Webhooks rechazados (firma o pedido inexistente)"
    ai_budget_alert  = "Gasto de IA pasó el porcentaje de alerta del presupuesto diario"
  }
}

resource "google_logging_metric" "event" {
  for_each = local.counters

  project     = var.project_id
  name        = "storynido/${each.key}"
  description = each.value
  filter      = "${local.run_logs} AND jsonPayload.event=\"${each.key}\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "service_errors" {
  project     = var.project_id
  name        = "storynido/service_errors"
  description = "Logs de error de cada servicio (los mismos que llegan a Error Reporting)"
  filter      = "${local.run_logs} AND severity>=ERROR"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key         = "service"
      value_type  = "STRING"
      description = "Servicio de Cloud Run"
    }
  }
  label_extractors = {
    service = "EXTRACT(resource.labels.service_name)"
  }
}

resource "google_logging_metric" "order_status" {
  project     = var.project_id
  name        = "storynido/order_status"
  description = "Cambios de estado de los pedidos"
  filter      = "${local.run_logs} AND jsonPayload.event=\"order_status\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key        = "status"
      value_type = "STRING"
    }
  }
  label_extractors = {
    status = "EXTRACT(jsonPayload.status)"
  }
}

resource "google_logging_metric" "ai_usage" {
  project     = var.project_id
  name        = "storynido/ai_usage"
  description = "Llamadas a la IA (por tipo)"
  filter      = "${local.run_logs} AND jsonPayload.event=\"ai_usage\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    labels {
      key        = "kind"
      value_type = "STRING"
    }
  }
  label_extractors = {
    kind = "EXTRACT(jsonPayload.kind)"
  }
}

resource "google_logging_metric" "ai_cost" {
  project         = var.project_id
  name            = "storynido/ai_cost_usd_micros"
  description     = "Costo estimado de cada llamada a la IA (millonésimas de USD)"
  filter          = "${local.run_logs} AND jsonPayload.event=\"ai_usage\""
  value_extractor = "EXTRACT(jsonPayload.costUsdMicros)"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "1"
  }
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 32
      growth_factor      = 2
      scale              = 100
    }
  }
}

resource "google_logging_metric" "pipeline_step_ms" {
  project         = var.project_id
  name            = "storynido/pipeline_step_ms"
  description     = "Duración de cada paso del pipeline que terminó bien"
  filter          = "${local.run_logs} AND jsonPayload.event=\"pipeline_step\" AND jsonPayload.outcome=\"succeeded\""
  value_extractor = "EXTRACT(jsonPayload.durationMs)"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
    labels {
      key        = "step"
      value_type = "STRING"
    }
  }
  label_extractors = {
    step = "EXTRACT(jsonPayload.step)"
  }
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 24
      growth_factor      = 2
      scale              = 50
    }
  }
}

# --- Alertas por mail ---------------------------------------------------------------

locals {
  # Cada alerta: métrica, umbral y ventana. Se disparan con valor > umbral en la ventana.
  log_alerts = {
    pipeline_failed  = { title = "pedido en revisión manual", threshold = 0, window = "300s" }
    pipeline_stuck   = { title = "pipeline atascado", threshold = 0, window = "1800s" }
    webhook_rejected = { title = "webhooks rechazados", threshold = 3, window = "900s" }
    ai_budget_alert  = { title = "presupuesto de IA cerca del límite", threshold = 0, window = "300s" }
  }
}

resource "google_monitoring_alert_policy" "log_event" {
  for_each = local.log_alerts

  project               = var.project_id
  display_name          = "StoryNido ${var.environment}: ${each.value.title}"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "${each.key} > ${each.value.threshold}"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.event[each.key].name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = each.value.threshold
      aggregations {
        alignment_period     = each.value.window
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger {
        count = 1
      }
    }
  }
  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "service_errors" {
  project               = var.project_id
  display_name          = "StoryNido ${var.environment}: errores en los servicios"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "Algún log de error en 5 minutos (ver Error Reporting)"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.service_errors.name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["metric.label.service"]
      }
      trigger {
        count = 1
      }
    }
  }
  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "ai_spike" {
  project               = var.project_id
  display_name          = "StoryNido ${var.environment}: pico de uso de IA"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "Más de ${var.ai_calls_per_30m} llamadas de IA en 30 minutos"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ai_usage.name}\" AND resource.type=\"cloud_run_revision\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.ai_calls_per_30m
      aggregations {
        alignment_period     = "1800s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger {
        count = 1
      }
    }
  }
}

# --- Dashboard ------------------------------------------------------------------------

resource "google_monitoring_dashboard" "operations" {
  project = var.project_id
  dashboard_json = jsonencode({
    displayName = "StoryNido ${var.environment}: operación"
    mosaicLayout = {
      columns = 12
      tiles = [
        {
          width  = 6
          height = 4
          widget = {
            title = "Pedidos por estado"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.order_status.name}\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "3600s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.status"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 6
          width  = 6
          height = 4
          widget = {
            title = "Duración de los pasos del pipeline (p95)"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.pipeline_step_ms.name}\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "3600s"
                      perSeriesAligner   = "ALIGN_DELTA"
                      crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      groupByFields      = ["metric.label.step"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Errores 5xx por servicio"
            xyChart = {
              dataSets = [{
                plotType = "LINE"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND metric.label.response_code_class=\"5xx\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["resource.label.service_name"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          xPos   = 6
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Llamadas de IA por tipo (costo en el admin)"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ai_usage.name}\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "86400s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.kind"]
                    }
                  }
                }
              }]
            }
          }
        },
        {
          yPos   = 8
          width  = 12
          height = 4
          widget = {
            title = "Errores por servicio (Error Reporting)"
            xyChart = {
              dataSets = [{
                plotType = "STACKED_BAR"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.service_errors.name}\" AND resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "3600s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.service"]
                    }
                  }
                }
              }]
            }
          }
        },
      ]
    }
  })
}

output "email_channel_id" {
  description = "ID del canal de notificación por email."
  value       = google_monitoring_notification_channel.email.id
}
