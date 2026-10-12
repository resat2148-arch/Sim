#!/bin/bash
# Bulut oturumu başlarken bağımlılıkları kurar; testler ve typecheck hemen çalışır.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
