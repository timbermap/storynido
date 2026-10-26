#!/usr/bin/env bash
# Carga (o rota) el valor de un secreto en Secret Manager leyéndolo de stdin,
# para que la clave no quede en el historial de la terminal.
#
# Uso: infra/scripts/set-secret.sh <project-id> <secret-id>
#   (pegá el valor y apretá Ctrl+D)
set -euo pipefail

PROJECT_ID=${1:?Uso: $0 <project-id> <secret-id>}
SECRET_ID=${2:?Uso: $0 <project-id> <secret-id>}

echo "Pegá el valor de $SECRET_ID y apretá Ctrl+D:" >&2
gcloud secrets versions add "$SECRET_ID" --project="$PROJECT_ID" --data-file=-
