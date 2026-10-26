variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "project_number" {
  type        = string
  description = "Número del proyecto (para el agente de servicio de Pub/Sub)."
}

variable "region" {
  type        = string
  description = "Región de las colas de Cloud Tasks."
}

variable "topics" {
  type        = list(string)
  description = "Tópicos de Pub/Sub."
}

variable "push_subscriptions" {
  type = map(object({
    topic                 = string
    push_endpoint         = string
    oidc_service_account  = string
    ack_deadline_seconds  = optional(number, 60)
    max_delivery_attempts = optional(number, 10)
  }))
  default     = {}
  description = "Suscripciones push autenticadas con OIDC, por nombre."
}

variable "queues" {
  type = map(object({
    max_dispatches_per_second = number
    max_concurrent_dispatches = number
    max_attempts              = number
    min_backoff               = optional(string, "5s")
    max_backoff               = optional(string, "600s")
  }))
  description = "Colas de Cloud Tasks, por nombre."
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Etiquetas."
}

locals {
  pubsub_agent = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic" "this" {
  for_each = toset(var.topics)

  project = var.project_id
  name    = each.value
  labels  = var.labels
}

# Mensajes que agotan los reintentos: se guardan para inspección y reproceso.
resource "google_pubsub_topic" "dead_letter" {
  project = var.project_id
  name    = "dead-letter"
  labels  = var.labels
}

resource "google_pubsub_subscription" "dead_letter_inspect" {
  project                    = var.project_id
  name                       = "dead-letter-inspect"
  topic                      = google_pubsub_topic.dead_letter.id
  message_retention_duration = "604800s"
  labels                     = var.labels
}

resource "google_pubsub_topic_iam_member" "dead_letter_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.name
  role    = "roles/pubsub.publisher"
  member  = local.pubsub_agent
}

resource "google_pubsub_subscription" "push" {
  for_each = var.push_subscriptions

  project              = var.project_id
  name                 = each.key
  topic                = google_pubsub_topic.this[each.value.topic].id
  ack_deadline_seconds = each.value.ack_deadline_seconds
  labels               = var.labels

  push_config {
    push_endpoint = each.value.push_endpoint
    oidc_token {
      service_account_email = each.value.oidc_service_account
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = each.value.max_delivery_attempts
  }

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription_iam_member" "dead_letter_subscriber" {
  for_each = var.push_subscriptions

  project      = var.project_id
  subscription = google_pubsub_subscription.push[each.key].name
  role         = "roles/pubsub.subscriber"
  member       = local.pubsub_agent
}

resource "google_cloud_tasks_queue" "this" {
  for_each = var.queues

  project  = var.project_id
  location = var.region
  name     = each.key

  rate_limits {
    max_dispatches_per_second = each.value.max_dispatches_per_second
    max_concurrent_dispatches = each.value.max_concurrent_dispatches
  }

  retry_config {
    max_attempts  = each.value.max_attempts
    min_backoff   = each.value.min_backoff
    max_backoff   = each.value.max_backoff
    max_doublings = 5
  }

  stackdriver_logging_config {
    sampling_ratio = 1
  }
}

output "topics" {
  description = "IDs de los tópicos por nombre."
  value       = { for name, t in google_pubsub_topic.this : name => t.id }
}

output "queues" {
  description = "IDs de las colas por nombre."
  value       = { for name, q in google_cloud_tasks_queue.this : name => q.id }
}
