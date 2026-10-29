output "api_url" {
  description = "URL de la API."
  value       = module.environment.api_url
}

output "worker_url" {
  description = "URL del worker (privado)."
  value       = module.environment.worker_url
}

output "artifact_registry" {
  description = "Prefijo de las imágenes Docker."
  value       = module.environment.artifact_registry
}

output "buckets" {
  description = "Buckets de Cloud Storage."
  value       = module.environment.buckets
}

output "service_accounts" {
  description = "Cuentas de servicio."
  value       = module.environment.service_accounts
}

output "github_actions" {
  description = "Variables para el environment de GitHub Actions (ver infra/scripts/github-vars.sh)."
  value       = module.environment.github_actions
}

output "firebase_web_config" {
  description = "Configuración pública de Firebase para apps/web."
  value       = module.environment.firebase_web_config
}

output "firebase_admin_config" {
  description = "Configuración pública de Firebase para apps/admin."
  value       = module.environment.firebase_admin_config
}

output "secrets" {
  description = "Secretos declarados."
  value       = module.environment.secrets
}

output "recaptcha_site_key" {
  description = "Clave pública de reCAPTCHA Enterprise de la web (va en apphosting*.yaml)."
  value       = module.environment.recaptcha_site_key
}
