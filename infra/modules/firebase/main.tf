variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "environment" {
  type        = string
  description = "Nombre del ambiente, para los títulos."
}

resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta
  project      = google_firebase_project.this.project
  display_name = "StoryNido web (${var.environment})"
}

resource "google_firebase_web_app" "admin" {
  provider     = google-beta
  project      = google_firebase_project.this.project
  display_name = "StoryNido admin (${var.environment})"
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  project    = google_firebase_project.this.project
  web_app_id = google_firebase_web_app.web.app_id
}

data "google_firebase_web_app_config" "admin" {
  provider   = google-beta
  project    = google_firebase_project.this.project
  web_app_id = google_firebase_web_app.admin.app_id
}

output "web_app_config" {
  description = "Configuración pública de Firebase para apps/web (NEXT_PUBLIC_FIREBASE_*)."
  value = {
    api_key             = data.google_firebase_web_app_config.web.api_key
    auth_domain         = data.google_firebase_web_app_config.web.auth_domain
    storage_bucket      = data.google_firebase_web_app_config.web.storage_bucket
    messaging_sender_id = data.google_firebase_web_app_config.web.messaging_sender_id
    app_id              = google_firebase_web_app.web.app_id
  }
}

output "admin_app_config" {
  description = "Configuración pública de Firebase para apps/admin (NEXT_PUBLIC_FIREBASE_*)."
  value = {
    api_key             = data.google_firebase_web_app_config.admin.api_key
    auth_domain         = data.google_firebase_web_app_config.admin.auth_domain
    storage_bucket      = data.google_firebase_web_app_config.admin.storage_bucket
    messaging_sender_id = data.google_firebase_web_app_config.admin.messaging_sender_id
    app_id              = google_firebase_web_app.admin.app_id
  }
}
