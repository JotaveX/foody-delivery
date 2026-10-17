#!/bin/sh
# Runs a binary installed in frontend/node_modules with frontend/ as the working directory.
set -e
cd "$(dirname "$0")/../frontend"
if [ ! -d node_modules ]; then
  echo "frontend/node_modules not found; run 'npm install' in frontend/ first." >&2
  exit 1
fi
exec npx --no-install "$@"
