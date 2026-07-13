#!/usr/bin/env bash
set -euo pipefail

readonly image="${1:-}"
readonly env_dir=/etc/little-tables
readonly image_env="$env_dir/image.env"
readonly registry_auth="$env_dir/ghcr-auth.json"
readonly health_url=http://127.0.0.1:32140/health/ready

if [[ $EUID -ne 0 ]]; then
  echo 'deploy-little-tables must run as root' >&2
  exit 1
fi
if [[ ! $image =~ ^ghcr\.io/zax-code/little-tables:[0-9a-f]{40}$ ]]; then
  echo 'invalid Little Tables image reference' >&2
  exit 2
fi

exec 9>/run/lock/little-tables-deploy.lock
flock -n 9 || { echo 'another Little Tables deployment is running' >&2; exit 3; }

previous=''
if [[ -r $image_env ]]; then
  previous=$(sed -n 's/^LITTLE_TABLES_IMAGE=//p' "$image_env")
fi

write_image_env() {
  local value=$1
  local temporary
  temporary=$(mktemp "$env_dir/image.env.XXXXXX")
  printf 'LITTLE_TABLES_IMAGE=%s\n' "$value" >"$temporary"
  chmod 600 "$temporary"
  chown root:root "$temporary"
  mv -f "$temporary" "$image_env"
}

healthy() {
  local attempt
  for attempt in {1..45}; do
    if curl --fail --silent --show-error --max-time 2 "$health_url" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "Pulling $image"
podman pull --authfile "$registry_auth" "$image"
write_image_env "$image"
systemctl restart little-tables.service

if healthy; then
  echo "Deployed $image"
  exit 0
fi

echo "Deployment health check failed for $image" >&2
journalctl -u little-tables.service -n 80 --no-pager >&2 || true
if [[ -n $previous ]] && podman image exists "$previous"; then
  echo "Rolling back to $previous" >&2
  write_image_env "$previous"
  systemctl restart little-tables.service
  if healthy; then
    echo "Rollback to $previous succeeded" >&2
  else
    echo "Rollback to $previous also failed" >&2
  fi
fi
exit 4
