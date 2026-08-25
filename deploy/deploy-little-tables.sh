#!/usr/bin/env bash
set -euo pipefail

readonly image="${1:-}"
readonly env_dir=/etc/little-tables
readonly registry_auth="$env_dir/ghcr-auth.json"
readonly health_url=http://127.0.0.1:32140/health/ready
readonly quadlet_dir=/etc/containers/systemd
readonly app_quadlet="$quadlet_dir/little-tables.container"
readonly app_template=/usr/local/share/little-tables/little-tables.container.in
readonly renderer=/usr/local/libexec/render-little-tables-quadlet

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
if [[ -r $app_quadlet ]]; then
  previous=$(sed -n 's/^Image=//p' "$app_quadlet")
fi

render_app_quadlet() {
  local value=$1
  "$renderer" "$value" "$app_template" "$app_quadlet"
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

running_expected_image() {
  local expected=$1
  local actual
  actual=$(podman inspect little-tables-app --format '{{.ImageName}}' 2>/dev/null) || return 1
  [[ $actual == "$expected" ]]
}

activate_image() {
  local value=$1
  render_app_quadlet "$value"
  systemctl daemon-reload
  [[ $(systemctl show little-tables.service --property=SourcePath --value) == "$app_quadlet" ]]
  systemctl restart little-tables.service
}

echo "Pulling $image"
podman pull --authfile "$registry_auth" "$image"

if activate_image "$image" && healthy && running_expected_image "$image"; then
  echo "Deployed $image"
  exit 0
fi

echo "Deployment health check failed for $image" >&2
journalctl -u little-tables.service -n 80 --no-pager >&2 || true
if [[ -n $previous ]] && podman image exists "$previous"; then
  echo "Rolling back to $previous" >&2
  if activate_image "$previous" && healthy && running_expected_image "$previous"; then
    echo "Rollback to $previous succeeded" >&2
  else
    echo "Rollback to $previous also failed" >&2
  fi
fi
exit 4
