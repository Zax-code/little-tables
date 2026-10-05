import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Engine, makeEngine } from '@little-tables/engine'
import init, { run } from '@little-tables/engine/wasm/lt_domain_wasm.js'
import { Effect, Layer } from 'effect'

/** The real engine, loaded from the WebAssembly built by `tools/build-wasm.sh`. */
export const testEngine = Layer.effect(
  Engine,
  Effect.promise(async () => {
    await init({
      module_or_path: readFileSync(
        join(import.meta.dirname, '../../../../packages/engine/wasm/lt_domain_wasm_bg.wasm'),
      ),
    })
    return makeEngine({ run })
  }),
)
