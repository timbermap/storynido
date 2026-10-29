provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

module "environment" {
  source = "../../modules/environment"

  project_id                 = var.project_id
  environment                = "staging"
  region                     = var.region
  firestore_location         = var.firestore_location
  public_domain              = "staging.storynido.com"
  api_domain                 = var.api_domain
  cors_origins               = ["https://staging.storynido.com", "https://web--storynido-staging.us-central1.hosted.app", "https://admin--storynido-staging.us-central1.hosted.app", "http://localhost:3000"]
  github_repository          = "timbermap/storynido"
  github_repository_owner_id = "157223336"
  alert_email                = var.alert_email
  billing_account            = var.billing_account
  budget_amount              = var.budget_amount
  budget_currency            = var.budget_currency
  api_scaling                = { min = 0, max = 3 }
  worker_scaling             = { min = 0, max = 3 }
  deletion_protection        = false
  photo_analyzer             = var.photo_analyzer
  # Gelato (DECISIONS 077) en borrador: no se fabrica ni se cobra.
  # Gelato y Lulu (EE. UU.) y Cloudprinter (México): el enrutador elige la más barata (DECISIONS 080).
  # Lulu (DECISIONS 086) en sandbox: no imprime ni cobra.
  print_providers   = ["gelato", "cloudprinter", "lulu"]
  gelato_order_type = "draft"
  # Mails reales con Resend; el secreto de las bajas ya tiene valor (DECISIONS 078).
  email_provider           = "resend"
  email_link_secret_loaded = true
  log_level                = "debug"
  # Panel de admin: 2FA (TOTP) obligatorio desde Identity Platform (DECISIONS 092).
  admin_url          = "https://admin--storynido-staging.us-central1.hosted.app"
  admin_mfa_required = true
  # Identity Platform con TOTP y App Check (fase 18). Los dominios son los que ya estaban en Auth.
  auth_authorized_domains = [
    "localhost",
    "storynido-staging.firebaseapp.com",
    "storynido-staging.web.app",
    "staging.storynido.com",
    "web--storynido-staging.us-central1.hosted.app",
    "admin--storynido-staging.us-central1.hosted.app",
  ]
  app_check_domains = ["staging.storynido.com", "web--storynido-staging.us-central1.hosted.app"]
}
