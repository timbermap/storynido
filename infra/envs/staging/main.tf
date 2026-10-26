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
  cors_origins               = ["https://staging.storynido.com", "http://localhost:3000"]
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
  log_level                  = "debug"
}
