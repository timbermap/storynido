variable "billing_account" {
  type        = string
  description = "ID de la cuenta de facturación (XXXXXX-XXXXXX-XXXXXX)."
}

variable "project_number" {
  type        = string
  description = "Número del proyecto al que se limita el presupuesto."
}

variable "display_name" {
  type        = string
  description = "Nombre del presupuesto."
}

variable "amount" {
  type        = number
  description = "Monto mensual del presupuesto."
}

variable "currency" {
  type        = string
  default     = "USD"
  description = "Moneda (tiene que coincidir con la de la cuenta de facturación)."
}

variable "notification_channels" {
  type        = list(string)
  description = "Canales de Cloud Monitoring que reciben los avisos."
}

resource "google_billing_budget" "this" {
  billing_account = var.billing_account
  display_name    = var.display_name

  budget_filter {
    projects = ["projects/${var.project_number}"]
  }

  amount {
    specified_amount {
      currency_code = var.currency
      units         = tostring(var.amount)
    }
  }

  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content {
      threshold_percent = threshold_rules.value
    }
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = var.notification_channels
    disable_default_iam_recipients   = false
  }
}
