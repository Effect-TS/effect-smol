/**
 * Browser-backed `KeyValueStore` layers for Effect programs.
 *
 * This module provides `KeyValueStore` implementations backed by the browser's
 * synchronous Web Storage APIs: `localStorage` for origin-scoped data that
 * persists across page reloads and browser sessions, and `sessionStorage` for
 * page-session data that is cleared when that tab or window's page session
 * ends. They are useful for small client-side values such as user preferences,
 * feature flags, lightweight caches, persisted drafts, or session-only workflow
 * state.
 *
 * Web Storage is only available in browser environments and is scoped by origin.
 * Browsers may deny access in private modes or restricted contexts, and writes
 * can fail when storage quotas are exceeded. The API stores strings and runs
 * synchronously on the main thread, so prefer it for small payloads and avoid
 * treating it as a database or a secure place for sensitive data.
 *
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
