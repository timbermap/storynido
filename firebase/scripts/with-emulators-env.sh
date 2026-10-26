#!/usr/bin/env bash
# Ejecuta un comando apuntando el Admin SDK a los emuladores locales (nunca a la nube).
set -euo pipefail
export GCLOUD_PROJECT=demo-storynido
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8180
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
exec "$@"
