/**
 * @since 1.0.0
 */
import type * as Layer from "effect/Layer"
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore"

/**
 * Creates a `KeyValueStore` layer that uses the browser's `localStorage` api.
 *
 * Values are stored between sessions.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerLocalStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  globalThis.localStorage
)

/**
 * Creates a `KeyValueStore` layer that uses the browser's `sessionStorage` api.
 *
 * Values are stored only for the current session.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerSessionStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  globalThis.sessionStorage
)
