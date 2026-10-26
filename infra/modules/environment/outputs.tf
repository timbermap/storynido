output "api_url" {
  description = "URL de la API en Cloud Run."
  value       = module.api.uri
}

output "worker_url" {
  description = "URL del worker en Cloud Run (privado)."
  value       = module.worker.uri
}

output "artifact_registry" {
  description = "Prefijo de las imágenes Docker."
  value       = module.registry.url
}

output "buckets" {
  description = "Buckets de Cloud Storage."
  value = {
    photos = module.bucket_photos.name
    assets = module.bucket_assets.name
    pdfs   = module.bucket_pdfs.name
  }
}

output "service_accounts" {
  description = "Emails de las cuentas de servicio."
  value       = module.service_accounts.emails
}

output "github_actions" {
  description = "Variables a cargar en el environment de GitHub Actions."
  value = {
    GCP_PROJECT_ID   = var.project_id
    GCP_REGION       = var.region
    GCP_WIF_PROVIDER = module.github_wif.provider_name
    GCP_DEPLOYER_SA  = local.sa["sn-deployer"]
  }
}

output "firebase_web_config" {
  description = "Configuración pública de Firebase para apps/web."
  value       = module.firebase.web_app_config
}

output "firebase_admin_config" {
  description = "Configuración pública de Firebase para apps/admin."
  value       = module.firebase.admin_app_config
}

output "secrets" {
  description = "Secretos declarados (cargar sus valores con gcloud)."
  value       = module.secrets.ids
}
