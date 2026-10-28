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
  # Gelato (EE. UU.) y Cloudprinter (México): el enrutador elige la más barata (DECISIONS 080).
  print_providers   = ["gelato", "cloudprinter"]
  gelato_order_type = "draft"
  # Mails reales con Resend; el secreto de las bajas ya tiene valor (DECISIONS 078).
  email_provider           = "resend"
  email_link_secret_loaded = true
  log_level                = "debug"
  # Panel de admin (DECISIONS 084): sin 2FA en staging hasta pasar a Identity Platform.
  admin_url          = "https://admin--storynido-staging.us-central1.hosted.app"
  admin_mfa_required = false
}
