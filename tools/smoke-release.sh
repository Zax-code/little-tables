#!/usr/bin/env bash
# Starts a release archive the way production does and probes its public behaviour:
#
#   tools/smoke-release.sh <archive> <commit>
set -euo pipefail

readonly archive=${1:?usage: tools/smoke-release.sh <archive> <commit>}
readonly revision=${2:?usage: tools/smoke-release.sh <archive> <commit>}
readonly port=${PORT:-4318}
readonly base=http://127.0.0.1:$port

workspace=$(mktemp -d)
server=''
cleanup() {
  [[ -n $server ]] && kill "$server" 2>/dev/null || true
  rm -rf "$workspace"
}
trap cleanup EXIT INT TERM

tar -xzf "$archive" -C "$workspace"
readonly release=$workspace/little-tables-$revision
test "$("$release/little-tables" --version)" = "little-tables 0.1.0"

DATABASE_PATH=$workspace/state/little-tables.db "$release/little-tables" admin migrate >/dev/null
env -i PATH="$PATH" LT_ENV=smoke HOST=127.0.0.1 PORT="$port" \
  DATABASE_PATH="$workspace/state/little-tables.db" WEB_DIST_PATH="$release/web" \
  GOOGLE_ALLOWED_EMAILS=learner@example.com GOOGLE_CLIENT_ID=smoke.apps.googleusercontent.com \
  SESSION_SECRET=smoke-session-secret-at-least-32-bytes \
  "$release/little-tables" serve 2>"$workspace/server.log" &
server=$!

for _ in {1..20}; do
  curl --fail --silent "$base/health/live" >/dev/null 2>&1 && break
  sleep 0.5
done

status() { curl --silent --output /dev/null --write-out '%{http_code}' "$@"; }
header() { curl --silent --dump-header - --output /dev/null "$2" | tr -d '\r' | sed -n "s/^$1: //Ip"; }

ready=$(curl --fail --silent "$base/health/ready")
test "$ready" = "{\"revision\":\"$revision\",\"status\":\"ready\"}"
test "$(status "$base/")" = 302
test "$(header location "$base/")" = /sign-in
test "$(status "$base/garden")" = 302
test "$(status "$base/api/v2/family/profiles")" = 401
test "$(status "$base/api/v2/notifications/config")" = 401
test "$(status "$base/api/v1/bootstrap")" = 404
test "$(status "$base/sign-in")" = 200
test "$(header cache-control "$base/sign-in")" = no-store
asset=$(cd "$release/web" && find assets -type f -name '*.js' | head -n 1)
test "$(status "$base/$asset")" = 200
curl --fail --silent "$base/api/v2/auth/status" | grep -q '"authenticationRequired":true'
test "$(status --header 'content-type: application/json' --data '{}' "$base/api/v2/family/profiles")" = 403

echo "Release $revision smoke test passed on port $port."
