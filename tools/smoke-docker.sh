#!/usr/bin/env sh
set -eu

image="${1:-little-tables:smoke}"
port="${PORT:-4317}"
container="little-tables-smoke-$$"

cleanup() {
  docker rm --force "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "$image" .
docker run --detach --rm --publish "$port:3000" \
  --env GOOGLE_ALLOWED_EMAILS=learner@example.com \
  --env GOOGLE_CLIENT_ID=smoke.apps.googleusercontent.com \
  --env LITTLE_TABLES_UNSAFE_EPHEMERAL=true \
  --env SESSION_SECRET=smoke-session-secret-at-least-32-bytes \
  --name "$container" "$image" >/dev/null

attempt=1
while [ "$attempt" -le 10 ]; do
  if curl --fail --silent "http://127.0.0.1:$port/health/live" >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

curl --fail --silent "http://127.0.0.1:$port/health/live" >/dev/null
root_headers=$(curl --silent --dump-header - --output /dev/null "http://127.0.0.1:$port/")
root_status=$(printf '%s' "$root_headers" | sed -n '1s/.* \([0-9][0-9][0-9]\).*/\1/p')
root_location=$(printf '%s' "$root_headers" | tr -d '\r' | sed -n 's/^location: //Ip')
test "$root_status" = 302
test "$root_location" = /sign-in

garden_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$port/garden")
bootstrap_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$port/api/v1/bootstrap")
notification_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$port/api/v1/notifications/config")
invite_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header 'content-type: application/json' --data '{}' \
  "http://127.0.0.1:$port/api/v1/invites/claim")
test "$garden_status" = 302
test "$bootstrap_status" = 401
test "$notification_status" = 401
test "$invite_status" = 404
sign_in_headers=$(curl --fail --silent --dump-header - --output /dev/null "http://127.0.0.1:$port/sign-in")
sign_in_cache_control=$(printf '%s' "$sign_in_headers" | tr -d '\r' | sed -n 's/^cache-control: //Ip')
test "$sign_in_cache_control" = no-store

echo "Production image authentication smoke test passed on port $port."
