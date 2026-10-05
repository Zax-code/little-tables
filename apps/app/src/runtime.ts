/**
 * The app's single Effect runtime (`docs/rewrite/TECHNICAL_SPEC.md` §4.1): the v2 API client,
 * the learning engine in WebAssembly and the device's stores. Tests build their own runtime
 * with doubles.
 */
import { FetchHttpClient } from '@effect/platform'
import { ApiClient } from '@little-tables/api-contract'
import { Engine } from '@little-tables/engine'
import init, { run } from '@little-tables/engine/wasm/lt_domain_wasm.js'
import wasmUrl from '@little-tables/engine/wasm/lt_domain_wasm_bg.wasm?url'
import { Layer, ManagedRuntime } from 'effect'

import { LocalStore } from './data/local-store.js'

export type AppServices = ApiClient | Engine | LocalStore

/** Loads the engine module once; later calls reuse it. */
const loadEngine = async () => {
  await init({ module_or_path: wasmUrl })
  return { run }
}

export const appLayer = Layer.mergeAll(
  ApiClient.layer(typeof window === 'undefined' ? '' : window.location.origin).pipe(
    Layer.provide(FetchHttpClient.layer),
  ),
  Engine.layer(loadEngine),
  LocalStore.layer,
)

export const createRuntime = (layer: Layer.Layer<AppServices, unknown> = appLayer) =>
  ManagedRuntime.make(layer)

export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, unknown>
