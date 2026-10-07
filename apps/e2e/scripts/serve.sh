#!/usr/bin/env bash
# Serves the stack the end-to-end tests run against: the production build of the app from the
# Rust server, without Google sign-in, on a throwaway database. e2e passes the port in PORT.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
state="$root/apps/e2e/.e2e/server"
rm -rf "$state"
mkdir -p "$state"

cd "$root"
corepack pnpm --filter @little-tables/engine build:wasm
corepack pnpm --filter @little-tables/app exec vite build --logLevel warn
cargo build --quiet -p lt-server

AUTH_MODE=disabled \
  DATABASE_PATH="$state/little-tables.db" \
  WEB_DIST_PATH="$root/apps/app/dist" \
  exec "$root/target/debug/little-tables" serve
