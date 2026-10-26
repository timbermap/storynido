#!/usr/bin/env bash
# Levanta los emuladores y guarda los datos locales en firebase/.emulator-data al salir.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$DIR/.emulator-data"
ARGS=(emulators:start --project demo-storynido --export-on-exit "$DATA")
if [[ -f "$DATA/firebase-export-metadata.json" ]]; then
  ARGS+=(--import "$DATA")
fi
exec "$DIR/scripts/firebase.sh" "${ARGS[@]}"
