variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "environment" {
  type        = string
  description = "Nombre del ambiente, para los títulos."
}

variable "auth_authorized_domains" {
  type        = list(string)
  description = "Dominios desde los que se puede iniciar sesión (Auth → Dominios autorizados)."
}

variable "app_check_domains" {
  type        = list(string)
  description = "Dominios de la web para la clave de reCAPTCHA Enterprise de App Check."
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

# --- Auth con Identity Platform (sin vuelta atrás) -------------------------------------------
# Pasa el proyecto de Firebase Auth a Identity Platform para tener TOTP en el admin. Replica lo
# que se había configurado a mano en la consola: email (enlace mágico), anónimo y los dominios.
# El proveedor Google sigue configurado aparte (consola de Firebase).
resource "google_identity_platform_config" "auth" {
  project = google_firebase_project.this.project

  authorized_domains = var.auth_authorized_domains

  sign_in {
    allow_duplicate_emails = false
    email {
      enabled           = true
      password_required = false
    }
    anonymous {
      enabled = true
    }
    phone_number {
      enabled = false
    }
  }

  # Segundo factor opcional por usuario; el admin lo exige al staff (ADMIN_MFA_REQUIRED).
  mfa {
    state = "ENABLED"
    provider_configs {
      state = "ENABLED"
      totp_provider_config {
        adjacent_intervals = 5
      }
    }
  }
}

# --- App Check en la web (reCAPTCHA Enterprise) ----------------------------------------------
resource "google_recaptcha_enterprise_key" "web" {
  project      = google_firebase_project.this.project
  display_name = "StoryNido web (${var.environment}) · App Check"

  web_settings {
    integration_type  = "SCORE"
    allow_all_domains = false
    allowed_domains   = var.app_check_domains
  }
}

resource "google_firebase_app_check_recaptcha_enterprise_config" "web" {
  project   = google_firebase_project.this.project
  app_id    = google_firebase_web_app.web.app_id
  site_key  = google_recaptcha_enterprise_key.web.name
  token_ttl = "3600s"
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

output "recaptcha_site_key" {
  description = "Clave pública de reCAPTCHA Enterprise de la web (NEXT_PUBLIC_RECAPTCHA_SITE_KEY)."
  value       = google_recaptcha_enterprise_key.web.name
}
