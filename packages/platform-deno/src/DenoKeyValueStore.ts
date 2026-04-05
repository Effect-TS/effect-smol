/**
 * This module exposes database primitives.
 * @module
 *
 * @since 1.0.0
 */

import * as Layer from "effect/Layer"
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore"
import { makeKvStore } from "./internal/kv.ts"

/**
 * Creates a {@linkcode KeyValueStore} layer that uses the Web-native {@linkcode localStorage} API.
 *
 * Values are stored between sessions.
 *
 * @since 1.0.0
 * @category layer
 */
export const layerLocalStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  localStorage
)

/**
 * Creates a {@linkcode KeyValueStore} layer that uses the Web-native {@linkcode sessionStorage} API.
 *
 * Values are stored only for the current session.
 *
 * @since 1.0.0
 * @category layer
 */
export const layerSessionStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  sessionStorage
)

/**
 * Creates a {@linkcode KeyValueStore} layer that uses Deno’s cloud-native {@linkcode Deno.Kv} API.
 *
 * @remarks
 * This does not support gradual adoption,
 * and will fail semi-gracefully on non-`string` or {@linkcode Uint8Array} values.
 * kvStore
 * @since 1.0.0
 * @category layer
 */
export const layerKv: Layer.Layer<KeyValueStore.KeyValueStore> = Layer.effect(
  KeyValueStore.KeyValueStore
)(
  makeKvStore()
)
