terraform {
  required_version = ">= 1.17"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.8"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 8.8"
    }
  }

  # El bucket se pasa con: terraform init -backend-config=backend.hcl
  backend "gcs" {
    prefix = "terraform/state"
  }
}
