#!/usr/bin/env bash
set -euo pipefail

readonly image="${1:-}"
readonly template="${2:-}"
readonly output="${3:-}"
readonly placeholder='@LITTLE_TABLES_IMAGE@'

if [[ ! $image =~ ^ghcr\.io/zax-code/little-tables:[0-9a-f]{40}$ ]]; then
  echo 'invalid Little Tables image reference' >&2
  exit 2
fi
if [[ ! -f $template || -z $output ]]; then
  echo 'usage: render-little-tables-quadlet IMAGE TEMPLATE OUTPUT' >&2
  exit 2
fi
if [[ $(grep -Fxc "Image=$placeholder" "$template") -ne 1 ]]; then
  echo 'Little Tables Quadlet template must contain exactly one image placeholder' >&2
  exit 2
fi

readonly output_dir=$(dirname "$output")
temporary=$(mktemp "$output_dir/.little-tables.container.XXXXXX")
trap 'rm -f "$temporary"' EXIT

sed "s|^Image=$placeholder$|Image=$image|" "$template" >"$temporary"
if grep -Fq "$placeholder" "$temporary"; then
  echo 'Little Tables Quadlet image placeholder was not fully rendered' >&2
  exit 2
fi

chmod 0644 "$temporary"
chown root:root "$temporary" 2>/dev/null || true
mv -f "$temporary" "$output"
trap - EXIT
