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
  # Web y admin se publican solos desde GitHub Actions (DECISIONS 260).
  apphosting_ci_deploy = true
  alert_email          = var.alert_email
  billing_account      = var.billing_account
  budget_amount        = var.budget_amount
  budget_currency      = var.budget_currency
  api_scaling          = { min = 0, max = 3 }
  worker_scaling       = { min = 0, max = 3 }
  deletion_protection  = false
  photo_analyzer       = var.photo_analyzer
  # Gelato (DECISIONS 077) en borrador: no se fabrica ni se cobra.
  # Gelato y Lulu (EE. UU.) y Cloudprinter (México): el enrutador elige la más barata (DECISIONS 080).
  # Lulu (DECISIONS 086) en sandbox: no imprime ni cobra.
  print_providers   = ["gelato", "cloudprinter", "lulu"]
  gelato_order_type = "draft"
  # Impresos apagados (DECISIONS 295). Para la prueba de punta a punta con Lulu sandbox:
  # print_enabled = true, terraform apply y, al terminar, volver a false (docs/IMPRESO-ACTIVACION.md).
  print_enabled = false
  # Mails reales con Resend; el secreto de las bajas ya tiene valor (DECISIONS 078).
  email_provider           = "resend"
  email_link_secret_loaded = true
  # Pagos con PayPal en sandbox (DECISIONS 279 y 287): no cobra. Gumroad (DECISIONS 255) se apagó
  # en staging al verificar PayPal; para volver, payment_provider = "gumroad" y gumroad_product_url.
  payment_provider = "paypal"
  # Dodo (DECISIONS 244) queda listo para volver: payment_provider = "dodo".
  dodo_product_id = "pdt_0Ns9WghE2X0qwP6OPfN7D"
  log_level       = "debug"
  # Redes sociales conectadas (DECISIONS 309): cada red entra cuando sus secretos tienen valor.
  social_networks = ["instagram", "tiktok"]
  # Google Analytics 4 (propiedad StoryNido): el admin la lee con la cuenta de servicio de la API.
  ga4_property_id = "565435245"
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
