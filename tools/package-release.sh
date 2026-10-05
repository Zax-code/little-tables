#!/usr/bin/env bash
# Builds the server release archive from a checkout whose web app is already built:
#
#   tools/package-release.sh <commit> [output directory]
#
# Writes little-tables-<commit>.tar.gz and its .sha256 next to it. The archive holds, under
# little-tables-<commit>/, the binary and the web app in web/.
set -euo pipefail

readonly revision=${1:?usage: tools/package-release.sh <commit> [output directory]}
readonly output=${2:-target/release-archive}
if [[ ! $revision =~ ^[0-9a-f]{40}$ ]]; then
  echo 'the commit must be a full 40-character hash' >&2
  exit 2
fi
if [[ ! -f apps/app/dist/index.html ]]; then
  echo 'build the web app first (corepack pnpm build)' >&2
  exit 2
fi

APP_REVISION=$revision cargo build --release --locked -p lt-server

staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
readonly release=$staging/little-tables-$revision
mkdir -p "$release"
install -m 0755 target/release/little-tables "$release/little-tables"
cp -R apps/app/dist "$release/web"

mkdir -p "$output"
readonly archive=little-tables-$revision.tar.gz
tar -C "$staging" -czf "$output/$archive" "little-tables-$revision"
if command -v sha256sum >/dev/null; then
  (cd "$output" && sha256sum "$archive" >"$archive.sha256")
else
  (cd "$output" && shasum -a 256 "$archive" >"$archive.sha256")
fi
echo "$output/$archive"
