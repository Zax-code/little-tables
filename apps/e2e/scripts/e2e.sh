#!/usr/bin/env bash
# Runs the e2e CLI on a Node it supports (24.8 or newer, or 22.22.3 on Node 22), switching to the
# Node of .nvmrc through nvm when the current one is older.
set -eo pipefail
cd "$(dirname "$0")/.."

supported() {
  node -e '
    const [major, minor, patch] = process.versions.node.split(".").map(Number);
    const ok = major > 24 || (major === 24 && minor >= 8) || (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)));
    process.exit(ok ? 0 : 1);
  '
}

if ! supported; then
  nvm_script="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$nvm_script" ]; then
    # shellcheck source=/dev/null
    . "$nvm_script" --no-use
    nvm use --silent || {
      echo "Install the Node of apps/e2e/.nvmrc first: nvm install $(cat .nvmrc)" >&2
      exit 1
    }
  fi
  supported || {
    echo "e2e needs Node 24.8 or newer (found $(node --version))." >&2
    exit 1
  }
fi

exec node_modules/.bin/e2e "$@"
