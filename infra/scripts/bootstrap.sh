#!/usr/bin/env bash
# Prepara un proyecto de Google Cloud para que Terraform pueda administrarlo.
# Se corre UNA vez por ambiente, con una cuenta de usuario con permisos de owner y de facturación.
#
# Uso: infra/scripts/bootstrap.sh <staging|production> <project-id> <billing-account-id> [region]
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Uso: $0 <staging|production> <project-id> <billing-account-id> [region]" >&2
  exit 1
fi

ENVIRONMENT=$1
PROJECT_ID=$2
BILLING_ACCOUNT=$3
REGION=${4:-us-central1}
ENV_DIR="$(cd "$(dirname "$0")/../envs/$ENVIRONMENT" && pwd)"
STATE_BUCKET="$PROJECT_ID-tfstate"

echo "==> Proyecto $PROJECT_ID ($ENVIRONMENT)"
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud projects create "$PROJECT_ID" --name="StoryNido $ENVIRONMENT" --labels="app=storynido,env=$ENVIRONMENT"
fi

echo "==> Vinculando facturación"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

echo "==> APIs mínimas para que Terraform funcione"
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  storage.googleapis.com \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  --project="$PROJECT_ID"

echo "==> Bucket del state de Terraform: gs://$STATE_BUCKET"
if ! gcloud storage buckets describe "gs://$STATE_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$STATE_BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi
gcloud storage buckets update "gs://$STATE_BUCKET" --versioning

printf 'bucket = "%s"\n' "$STATE_BUCKET" >"$ENV_DIR/backend.hcl"
echo "==> Escrito $ENV_DIR/backend.hcl"

cat <<MSG

Listo. Próximos pasos:
  gcloud auth application-default login   # si todavía no tenés ADC
  cd infra/envs/$ENVIRONMENT
  cp terraform.tfvars.example terraform.tfvars   # completar billing_account y alert_email
  terraform init -backend-config=backend.hcl
  terraform plan
  terraform apply
MSG
