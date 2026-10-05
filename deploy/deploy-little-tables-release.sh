#!/usr/bin/env bash
# Installed as /usr/local/sbin/deploy-little-tables-release (root). Reads a release archive on
# standard input, as streamed by CI through the restricted deployment key:
#
#   deploy-little-tables-release <commit> <sha256> < little-tables-<commit>.tar.gz
#
# Verifies the archive, stops the service, backs the database up, migrates it with the new
# binary, switches /opt/little-tables/current atomically and requires /health/ready to report
# the new commit. Any failure restores the backup and the previous release.
set -euo pipefail
umask 022

readonly revision=${1:-}
readonly checksum=${2:-}
readonly root=/opt/little-tables
readonly releases=$root/releases
readonly current=$root/current
readonly state=/var/lib/little-tables
readonly database=$state/little-tables.db
readonly backups=$state/backups
readonly health_url=http://127.0.0.1:32140/health/ready
readonly service=little-tables.service
readonly max_archive_bytes=$((200 * 1024 * 1024))
readonly kept_releases=5

if [[ $EUID -ne 0 ]]; then
  echo 'deploy-little-tables-release must run as root' >&2
  exit 1
fi
if [[ ! $revision =~ ^[0-9a-f]{40}$ || ! $checksum =~ ^[0-9a-f]{64}$ ]]; then
  echo 'usage: deploy-little-tables-release <commit> <sha256> < archive' >&2
  exit 2
fi

exec 9>/run/lock/little-tables-deploy.lock
flock -n 9 || { echo 'another Little Tables deployment is running' >&2; exit 3; }

install -d -m 0755 "$root" "$releases"
incoming=$(mktemp -d "$root/incoming.XXXXXX")
trap 'rm -rf "$incoming"' EXIT

head -c $((max_archive_bytes + 1)) >"$incoming/release.tar.gz"
if (($(stat -c %s "$incoming/release.tar.gz") > max_archive_bytes)); then
  echo 'release archive is too large' >&2
  exit 2
fi
if ! printf '%s  %s\n' "$checksum" "$incoming/release.tar.gz" | sha256sum --check --status; then
  echo 'release archive checksum mismatch' >&2
  exit 2
fi
mkdir "$incoming/extract"
tar -xzf "$incoming/release.tar.gz" -C "$incoming/extract" --no-same-owner --no-same-permissions
readonly unpacked=$incoming/extract/little-tables-$revision
if [[ ! -x $unpacked/little-tables || ! -f $unpacked/web/index.html || ! -f $unpacked/web-v1/index.html ]]; then
  echo 'release archive is incomplete' >&2
  exit 2
fi

readonly target=$releases/$revision
if [[ ! -d $target ]]; then
  chown -R root:root "$unpacked"
  chmod -R u=rwX,go=rX "$unpacked"
  mv -T "$unpacked" "$target"
fi

as_service() {
  runuser -u little-tables -- env DATABASE_PATH="$database" "$@"
}

# The binary must run on this host before anything is stopped.
as_service "$target/little-tables" --version

previous=$(readlink -f "$current" 2>/dev/null || true)

ready() {
  local expected=$1 body
  for _ in {1..30}; do
    if body=$(curl --fail --silent --max-time 2 "$health_url") &&
      [[ $body == *'"status":"ready"'* && ($expected == any || $body == *"\"revision\":\"$expected\""*) ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

switch_to() {
  ln -sfn "$1" "$root/current.next"
  mv -T "$root/current.next" "$current"
}

install -d -o little-tables -g little-tables -m 0750 "$state" "$backups"
systemctl stop "$service"
backup=''
if [[ -f $database ]]; then
  backup=$backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}.db
  as_service "$target/little-tables" admin backup "$backup"
fi

if as_service "$target/little-tables" admin migrate && switch_to "$target" &&
  systemctl start "$service" && ready "$revision"; then
  # Keep the newest releases, always including the active and the previous one.
  find "$releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2- |
    tail -n +$((kept_releases + 1)) | while read -r old; do
      [[ $old == "$target" || $old == "$previous" ]] || rm -rf -- "$old"
    done
  echo "Deployed $revision"
  exit 0
fi

echo "Deployment of $revision failed" >&2
journalctl -u "$service" -n 80 --no-pager >&2 || true
systemctl stop "$service" || true
if [[ -n $backup ]]; then
  install -o little-tables -g little-tables -m 0640 "$backup" "$database"
  rm -f "$database-wal" "$database-shm"
  echo "Restored $backup" >&2
fi
if [[ -n $previous && -d $previous ]]; then
  switch_to "$previous"
  if systemctl start "$service" && ready any; then
    echo "Rolled back to $(basename "$previous")" >&2
  else
    echo "Rollback to $(basename "$previous") also failed" >&2
  fi
fi
exit 4
