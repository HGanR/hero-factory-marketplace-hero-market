#!/usr/bin/env bash
# Always run the given command from the hero-market app root, no matter what
# the current working directory is (resolves from this file's location).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_ROOT"
if ! node -e "process.exit(require('./package.json').name === 'hero-market' ? 0 : 1)" 2>/dev/null; then
  echo "vercel-exec-in-app.sh: expected package.json with name hero-market in $APP_ROOT" >&2
  exit 1
fi
exec "$@"
