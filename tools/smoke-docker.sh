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
docker run --detach --rm --publish "$port:3000" --name "$container" "$image" >/dev/null

attempt=1
while [ "$attempt" -le 10 ]; do
  if curl --fail --silent "http://127.0.0.1:$port/health/live" >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

curl --fail --silent "http://127.0.0.1:$port/health/live" >/dev/null
curl --fail --silent "http://127.0.0.1:$port/" >/dev/null
curl --fail --silent "http://127.0.0.1:$port/garden" >/dev/null

echo "Production image smoke test passed on port $port."
