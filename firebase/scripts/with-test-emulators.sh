#!/usr/bin/env bash
# Corre un comando de tests con emuladores propios (firebase.test.json: otros puertos y
# el proyecto demo-storynido-test). Nunca choca con `pnpm emulators` ni toca sus datos.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(pwd)"
exec "$DIR/firebase.sh" emulators:exec \
  --config firebase.test.json \
  --only auth,firestore,storage \
  --project demo-storynido-test \
  "cd $(printf '%q' "$PKG_DIR") && $(printf '%q ' "$@")"
