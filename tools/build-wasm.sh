#!/usr/bin/env bash
# Builds the learning engine for the browser into packages/domain/wasm and enforces its size budget.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/packages/engine/wasm"
budget_bytes=$((300 * 1024))

cargo build --manifest-path "$root/Cargo.toml" -p lt-domain-wasm --target wasm32-unknown-unknown --release
rm -rf "$out"
wasm-bindgen "$root/target/wasm32-unknown-unknown/release/lt_domain_wasm.wasm" \
  --target web --out-dir "$out" --omit-default-module-path
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
