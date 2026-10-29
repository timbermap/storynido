#!/usr/bin/env bash
# Registra el webhook de Lulu (cambios de estado de los trabajos de impresión). Lulu no tiene
# pantalla para esto: se hace por su API. Lee las claves de .env.local sin mostrarlas.
#
# Uso: infra/scripts/lulu-webhook.sh <sandbox|production> <url-de-la-api>
#   ej.: infra/scripts/lulu-webhook.sh sandbox https://api-kxfsarqx2q-uc.a.run.app
set -euo pipefail

MODE=${1:?Uso: $0 <sandbox|production> <url-de-la-api>}
API_URL=${2:?Uso: $0 <sandbox|production> <url-de-la-api>}
ENV_FILE="$(git rev-parse --show-toplevel)/.env.local"

case "$MODE" in
  sandbox) HOST=https://api.sandbox.lulu.com; PREFIX=LULU_SANDBOX_ ;;
  production) HOST=https://api.lulu.com; PREFIX=LULU_ ;;
  *) echo "Modo inválido: $MODE (sandbox o production)" >&2; exit 1 ;;
esac

# Lee una variable de .env.local sin ejecutar el archivo.
read_env() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
KEY=$(read_env "${PREFIX}CLIENT_KEY")
SECRET=$(read_env "${PREFIX}CLIENT_SECRET")
[ -n "$KEY" ] && [ -n "$SECRET" ] || { echo "Faltan ${PREFIX}CLIENT_KEY/SECRET en .env.local" >&2; exit 1; }

TOKEN=$(curl -sf -u "$KEY:$SECRET" -d grant_type=client_credentials \
  "$HOST/auth/realms/glasstree/protocol/openid-connect/token" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
TARGET="${API_URL%/}/v1/webhooks/print/lulu"

EXISTING=$(curl -sf "${AUTH[@]}" "$HOST/webhooks/" | python3 -c '
import json, sys
data = json.load(sys.stdin)
hooks = data.get("results", data) if isinstance(data, dict) else data
for hook in hooks:
    if hook.get("url") == sys.argv[1]:
        print(hook["id"])
' "$TARGET")

if [ -n "$EXISTING" ]; then
  echo "Ya existe el webhook $EXISTING → $TARGET"
  ID=$EXISTING
else
  ID=$(curl -sf "${AUTH[@]}" -X POST "$HOST/webhooks/" \
    -d "{\"topics\":[\"PRINT_JOB_STATUS_CHANGED\"],\"url\":\"$TARGET\"}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  echo "Webhook creado: $ID → $TARGET"
fi

# Envío de prueba: el trabajo de prueba no existe en nuestra base, así que la API lo rechaza
# (400). Sirve para ver en los logs que el aviso llega.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" -X POST \
  "$HOST/webhooks/$ID/test-submission/PRINT_JOB_STATUS_CHANGED/")
echo "Envío de prueba pedido a Lulu (HTTP $STATUS)."
