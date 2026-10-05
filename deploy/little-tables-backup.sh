#!/usr/bin/env bash
# Installed as /usr/local/libexec/little-tables-backup; run by little-tables-backup.service.
set -euo pipefail

readonly backups=/var/lib/little-tables/backups
readonly keep_days=14

install -d -m 0750 "$backups"
/opt/little-tables/current/little-tables admin backup "$backups/daily-$(date -u +%Y%m%dT%H%M%SZ).db"
find "$backups" -maxdepth 1 -type f -name '*.db' -mtime +"$keep_days" -delete
