#!/usr/bin/env bash
# Builds the learning engine for the browser into packages/engine/wasm and enforces its size budget.
# The bindings are regenerated only when the compiled engine or the tools changed.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/packages/engine/wasm"
budget_bytes=$((300 * 1024))

cargo build --manifest-path "$root/Cargo.toml" -p lt-domain-wasm --target wasm32-unknown-unknown --release
input="$root/target/wasm32-unknown-unknown/release/lt_domain_wasm.wasm"

checksum() {
  if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d ' ' -f 1
}
opt_version=$(command -v wasm-opt >/dev/null && wasm-opt --version || echo none)
stamp="$(checksum "$input") $(wasm-bindgen --version) $opt_version"
if [ -f "$out/.stamp" ] && [ "$(cat "$out/.stamp")" = "$stamp" ] && [ -f "$out/lt_domain_wasm_bg.wasm" ]; then
  echo "lt_domain_wasm_bg.wasm is up to date"
  exit 0
fi

rm -rf "$out"
wasm-bindgen "$input" --target web --out-dir "$out" --omit-default-module-path
if command -v wasm-opt >/dev/null; then
  wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
    "$out/lt_domain_wasm_bg.wasm" -o "$out/lt_domain_wasm_bg.wasm"
fi

size=$(gzip -9 -c "$out/lt_domain_wasm_bg.wasm" | wc -c | tr -d ' ')
echo "lt_domain_wasm_bg.wasm: $((size / 1024)) KiB gzip (budget $((budget_bytes / 1024)) KiB)"
if [ "$size" -gt "$budget_bytes" ]; then
  echo "The WebAssembly engine exceeds its size budget." >&2
  exit 1
fi
printf '%s\n' "$stamp" >"$out/.stamp"
