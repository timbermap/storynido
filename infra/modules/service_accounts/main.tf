variable "project_id" {
  type        = string
  description = "ID del proyecto de Google Cloud."
}

variable "accounts" {
  type = map(object({
    display_name  = string
    description   = string
    project_roles = list(string)
  }))
  description = "Cuentas de servicio por account_id, con los roles que reciben a nivel proyecto."
}

resource "google_service_account" "this" {
  for_each = var.accounts

  project      = var.project_id
  account_id   = each.key
  display_name = each.value.display_name
  description  = each.value.description
}

locals {
  bindings = flatten([
    for id, account in var.accounts : [
      for role in account.project_roles : { key = "${id}/${role}", account = id, role = role }
    ]
  ])
}

resource "google_project_iam_member" "this" {
  for_each = { for b in local.bindings : b.key => b }

  project = var.project_id
  role    = each.value.role
  member  = google_service_account.this[each.value.account].member
}

output "emails" {
  description = "Email de cada cuenta de servicio."
  value       = { for id, sa in google_service_account.this : id => sa.email }
}

output "members" {
  description = "Miembro IAM (serviceAccount:...) de cada cuenta de servicio."
  value       = { for id, sa in google_service_account.this : id => sa.member }
}

output "names" {
  description = "Nombre completo de recurso de cada cuenta de servicio."
  value       = { for id, sa in google_service_account.this : id => sa.name }
}
