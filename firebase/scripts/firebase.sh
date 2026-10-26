#!/usr/bin/env bash
# Corre la firebase-tools del proyecto desde la raíz del repo (donde está firebase.json)
# y se asegura de que haya Java 21+, que necesitan los emuladores.
set -euo pipefail

if ! java -version >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/openjdk@21/bin /usr/local/opt/openjdk@21/bin; do
    if [[ -x "$candidate/java" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! java -version >/dev/null 2>&1; then
  echo "Falta Java 21+ para los emuladores de Firebase: brew install openjdk@21" >&2
  exit 1
fi

cd "$(dirname "$0")/../.."
exec firebase "$@"
