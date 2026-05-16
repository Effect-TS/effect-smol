/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore"

/**
 * Creates a `KeyValueStore` layer that uses the browser's `localStorage` api.
 *
 * Values are stored between sessions.
 *
 * @since 1.0.0
 * @category Layers
 */
export const layerLocalStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  globalThis.localStorage
)

/**
 * Creates a `KeyValueStore` layer that uses the browser's `sessionStorage` api.
 *
 * Values are stored only for the current session.
 *
 * @since 1.0.0
 * @category Layers
 */
export const layerSessionStorage: Layer.Layer<KeyValueStore.KeyValueStore> = KeyValueStore.layerStorage(() =>
  globalThis.sessionStorage
)

/**
 * Creates a `KeyValueStore` layer backed by the runtime's `globalThis.indexedDB` implementation.
 *
 * Values are stored between sessions.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerIndexedDb = (options?: {
  readonly database?: string | undefined
}): Layer.Layer<KeyValueStore.KeyValueStore> =>
  Layer.effect(KeyValueStore.KeyValueStore)(
    Effect.gen(function*() {
      const db = yield* Effect.acquireRelease(
        openDatabase(options?.database ?? defaultDatabase),
        (db) => Effect.sync(() => db.close())
      ).pipe(Effect.orDie)
      return KeyValueStore.make({
        clear: Effect.gen(function*() {
          const store = getKvsEntriesStore(db, "readwrite")
          yield* idbRequest({ method: "clear", message: "Failed to clear backing store" }, () => store.clear())
        }),
        get: Effect.fnUntraced(function*(key: string) {
          const store = getKvsEntriesStore(db, "readonly")
          const found = yield* idbRequest<{ key: string; value: string } | undefined>({
            method: "get",
            message: "Failed to get value from backing store",
            key
          }, () => store.get(key))
          return found?.value
        }),
        getUint8Array: Effect.fnUntraced(function*(key: string) {
          const store = getKvsEntriesStore(db, "readonly")
          const found = yield* idbRequest<{ key: string; value: Uint8Array } | undefined>({
            method: "getUint8Array",
            message: "Failed to get value from backing store",
            key
          }, () => store.get(key))
          return found?.value
        }),
        set: Effect.fnUntraced(function*(key: string, value: string | Uint8Array) {
          const store = getKvsEntriesStore(db, "readwrite")
          yield* idbRequest({ method: "set", message: "Failed to set value in backing store", key }, () =>
            store.put({ key, value }))
        }),
        size: Effect.gen(function*() {
          const store = getKvsEntriesStore(db, "readonly")
          return yield* idbRequest<number>({ method: "size", message: "Failed to get backing store size" }, () =>
            store.count())
        }),
        remove: Effect.fnUntraced(function*(key: string) {
          const store = getKvsEntriesStore(db, "readwrite")
          yield* idbRequest({ method: "remove", message: "Failed to remove value from backing store", key }, () =>
            store.delete(key))
        })
      })
    })
  )
const defaultDatabase = "effect_browser_key_value_store"
const databaseVersion = 1
const entriesStoreName = "entries"
const openDatabase = Effect.fnUntraced(function*(database: string) {
  const openRequest = yield* Effect.try({
    try: () => globalThis.indexedDB.open(database, databaseVersion),
    catch: (cause) =>
      new KeyValueStore.KeyValueStoreError({
        method: "open",
        message: "Failed to open backing store database",
        cause
      })
  })
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result
    if (!db.objectStoreNames.contains(entriesStoreName)) {
      db.createObjectStore(entriesStoreName, { keyPath: "key" })
    }
  }
  return yield* idbRequest({ method: "open", message: "Failed to open backing store database" }, () => openRequest)
})
const idbRequest = <A>(
  failArgs: { method: string; message: string; key?: string },
  evaluate: () => IDBRequest<A>
): Effect.Effect<A, KeyValueStore.KeyValueStoreError> =>
  Effect.callback<A, KeyValueStore.KeyValueStoreError>((resume) => {
    const request = evaluate()
    const fail = (cause: unknown) => {
      resume(Effect.fail(new KeyValueStore.KeyValueStoreError({ ...failArgs, cause })))
    }
    if (request.readyState === "done") {
      resume(Effect.succeed(request.result))
    }
    request.onsuccess = () => {
      resume(Effect.succeed(request.result))
    }
    request.onerror = () => fail(request.error)
  })
const getKvsEntriesStore = (db: IDBDatabase, mode: IDBTransactionMode) => {
  const transaction = db.transaction(entriesStoreName, mode)
  return transaction.objectStore(entriesStoreName)
}
