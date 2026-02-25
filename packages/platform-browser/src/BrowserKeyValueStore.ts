/**
 * @since 1.0.0
 */
import { Effect } from "effect"
import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"
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

class IDBDatabaseService
  extends ServiceMap.Service<IDBDatabaseService, IDBDatabase>()("effect/persistence/KeyValueStore/IDBDatabase")
{
  static readonly acquire = (name: string, storeName: string, version: number) =>
    Effect.callback<IDBDatabase, KeyValueStore.KeyValueStoreError, never>((resume) => {
      if (!globalThis.indexedDB) {
        resume(Effect.fail(
          new KeyValueStore.KeyValueStoreError({
            message: "IndexedDB is not supported",
            method: "acquire",
            cause: new Error("IndexedDB is not supported")
          })
        ))
        return
      }
      const request = globalThis.indexedDB.open(name, version)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName)
        }
      }
      request.onsuccess = () => resume(Effect.succeed(request.result))
      request.onerror = (cause) => {
        resume(
          Effect.fail(
            new KeyValueStore.KeyValueStoreError({
              message: request.error?.message || "Error acquiring indexedDB database",
              method: "acquire",
              cause
            })
          )
        )
      }
    })

  static readonly release = (database: IDBDatabase) => Effect.sync(() => database.close())

  static readonly layer = (dbName: string, storeName: string, version: number) =>
    Layer.effect(this, Effect.acquireRelease(this.acquire(dbName, storeName, version), this.release))
}

type ReadMethod = "get" | "size"
type WriteMethod = "set" | "remove" | "clear"
type Method = ReadMethod | WriteMethod
type Mode = "readonly" | "readwrite"

const acquireTransaction = (database: IDBDatabase, storeName: string, method: Method, mode: Mode) =>
  Effect.try({
    try() {
      const transaction = database.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)

      return { transaction, store }
    },
    catch: (cause) =>
      new KeyValueStore.KeyValueStoreError({
        message: `Unable to create transaction on store ${storeName}`,
        method,
        cause
      })
  })

const makeRequest = <A>(
  database: IDBDatabase,
  storeName: string,
  method: Method,
  fn: (store: IDBObjectStore) => IDBRequest<A>,
  catchError: (event: Event) => KeyValueStore.KeyValueStoreError,
  mode: Mode
) =>
  acquireTransaction(database, storeName, method, mode).pipe(Effect.andThen(({ transaction, store }) =>
    Effect.try({
      try: () => ({ transaction, request: fn(store) }),
      catch: (cause) =>
        cause instanceof Event ? catchError(cause) : new KeyValueStore.KeyValueStoreError({
          message: `Unable to create request on store ${storeName}`,
          method,
          cause
        })
    })
  ))

function attachSignal<A>(
  method: Method,
  transaction: IDBTransaction,
  _resume: (effect: Effect.Effect<A, KeyValueStore.KeyValueStoreError>) => void,
  signal: AbortSignal
) {
  let done = false
  function abortHandler() {
    if (done) return
    done = true
    try {
      transaction.abort()
    } catch {
    } finally {
      signal.removeEventListener("abort", abortHandler)
    }
  }
  signal.addEventListener("abort", abortHandler)

  function resume(effect: Effect.Effect<A, KeyValueStore.KeyValueStoreError>) {
    if (done || signal.aborted) return
    signal.removeEventListener("abort", abortHandler)
    done = true
    _resume(effect)
  }

  transaction.onabort = () => {
    resume(Effect.fail(
      new KeyValueStore.KeyValueStoreError({
        message: "Transaction aborted",
        method,
        cause: transaction.error
      })
    ))
  }

  return resume
}

const fromRequest = <A>(
  method: Method,
  transaction: IDBTransaction,
  request: IDBRequest<A>,
  catchError: (event: Event) => KeyValueStore.KeyValueStoreError
): Effect.Effect<A, KeyValueStore.KeyValueStoreError> =>
  Effect.callback<A, KeyValueStore.KeyValueStoreError, never>((_resume, signal) => {
    const resume = attachSignal(method, transaction, _resume, signal)

    request.onsuccess = () => resume(Effect.succeed(request.result))
    request.onerror = (ev) => resume(Effect.fail(catchError(ev)))
  })

/**
 * Creates a `KeyValueStore` layer that uses the browser's `indexedDB` api.
 *
 * Values are stored between sessions.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerIndexedDb = (dbName: string, storeName: string, version: number) =>
  Layer.effect(
    KeyValueStore.KeyValueStore,
    Effect.gen(function*() {
      const database = yield* IDBDatabaseService

      const read = <A>(
        method: ReadMethod,
        fn: (store: IDBObjectStore) => IDBRequest<A>,
        catchError: (event: Event) => KeyValueStore.KeyValueStoreError
      ): Effect.Effect<A, KeyValueStore.KeyValueStoreError> =>
        makeRequest(database, storeName, method, fn, catchError, "readonly").pipe(
          Effect.andThen(({ transaction, request }) => fromRequest(method, transaction, request, catchError))
        )

      const write = (
        method: WriteMethod,
        fn: (store: IDBObjectStore) => IDBRequest,
        catchError: (event: Event) => KeyValueStore.KeyValueStoreError
      ): Effect.Effect<void, KeyValueStore.KeyValueStoreError> =>
        makeRequest(database, storeName, method, fn, catchError, "readwrite").pipe(Effect.andThen(({ transaction }) =>
          Effect.callback<void, KeyValueStore.KeyValueStoreError, never>((_resume, signal) => {
            const resume = attachSignal(method, transaction, _resume, signal)

            transaction.oncomplete = () => resume(Effect.void)
            transaction.onerror = (ev) => resume(Effect.fail(catchError(ev)))
          })
        ))

      return KeyValueStore.makeStringOnly({
        get: (key: string) =>
          read(
            "get",
            (store) =>
              store.get(key),
            (cause) =>
              new KeyValueStore.KeyValueStoreError({
                message: `Unable to get item with key ${key}`,
                method: "get",
                cause
              })
          ).pipe(Effect.map((value) => typeof value === "string" ? value : undefined)),

        set: (key: string, value: string) =>
          write(
            "set",
            (store) => store.put(value, key),
            (cause) =>
              new KeyValueStore.KeyValueStoreError({
                message: `Unable to set item with key ${key}`,
                method: "set",
                cause
              })
          ),

        remove: (key: string) =>
          write(
            "remove",
            (store) => store.delete(key),
            (cause) =>
              new KeyValueStore.KeyValueStoreError({
                message: `Unable to delete item with key ${key}`,
                method: "delete",
                cause
              })
          ),

        clear: write(
          "clear",
          (store) => store.clear(),
          (cause) =>
            new KeyValueStore.KeyValueStoreError({
              message: `Unable to clear storage`,
              method: "clear",
              cause
            })
        ),

        size: read(
          "size",
          (store) => store.count(),
          (cause) =>
            new KeyValueStore.KeyValueStoreError({
              message: `Unable to get size`,
              method: "size",
              cause
            })
        )
      })
    })
  ).pipe(Layer.provide(IDBDatabaseService.layer(dbName, storeName, version)))
