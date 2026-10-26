#!/usr/bin/env bash
# Crea el environment de GitHub Actions y carga sus variables desde los outputs de Terraform.
# No hay secretos: la autenticación es por Workload Identity Federation.
#
# Uso: infra/scripts/github-vars.sh <staging|production>
set -euo pipefail

ENVIRONMENT=${1:?Uso: $0 <staging|production>}
ENV_DIR="$(cd "$(dirname "$0")/../envs/$ENVIRONMENT" && pwd)"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

echo "==> Environment '$ENVIRONMENT' en $REPO"
gh api --method PUT "repos/$REPO/environments/$ENVIRONMENT" >/dev/null

terraform -chdir="$ENV_DIR" output -json github_actions |
  jq -r 'to_entries[] | "\(.key)\t\(.value)"' |
  while IFS=$'\t' read -r key value; do
    gh variable set "$key" --env "$ENVIRONMENT" --repo "$REPO" --body "$value"
    echo "    $key"
  done

cat <<MSG

Listo. Para activar los deploys automáticos (una sola vez):
  gh variable set DEPLOY_ENABLED --repo $REPO --body true
MSG
