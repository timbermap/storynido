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
  environment                = "production"
  region                     = var.region
  firestore_location         = var.firestore_location
  public_domain              = "storynido.com"
  api_domain                 = var.api_domain
  cors_origins               = ["https://storynido.com", "https://www.storynido.com"]
  github_repository          = "timbermap/storynido"
  github_repository_owner_id = "157223336"
  alert_email                = var.alert_email
  billing_account            = var.billing_account
  budget_amount              = var.budget_amount
  budget_currency            = var.budget_currency
  # Mínimo 0 + ping cada 10 min mientras no haya ventas (≈ USD 0,10/mes contra USD 8-10/mes de
  # una instancia siempre encendida). Con tráfico real se pasa a min = 1.
  api_scaling         = { min = 0, max = 20 }
  api_keep_warm       = true
  worker_scaling      = { min = 0, max = 50 }
  deletion_protection = true
  photo_analyzer      = var.photo_analyzer
  # Gelato (DECISIONS 077).
  print_providers   = ["gelato"]
  gelato_order_type = "order"
  log_level         = "info"
  # Se suma el dominio del admin cuando exista.
  auth_authorized_domains = [
    "storynido.com",
    "www.storynido.com",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]
  app_check_domains = ["storynido.com", "www.storynido.com"]
}
