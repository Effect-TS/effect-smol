/**
 * @since 1.0.0
 */
import type * as Arr from "effect/Array"
import * as Clock from "effect/Clock"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Persistence from "effect/unstable/persistence/Persistence"

const defaultDatabase = "effect_persistence"
const databaseVersion = 1
const entriesStoreName = "entries"
const storeIdIndexName = "storeId"

interface EntryRow {
  readonly storeId: string
  readonly id: string
  readonly value: object
  readonly expires: number | null
}

/**
 * @since 1.0.0
 */
export interface Options {
  readonly database?: string | undefined
}

/**
 * @since 1.0.0
 * @category layers
 */
export const layerBackingIndexedDb = (options?: Options): Layer.Layer<Persistence.BackingPersistence> =>
  Layer.effect(Persistence.BackingPersistence)(Effect.gen(function*() {
    const db = yield* Effect.acquireRelease(
      openDatabase(options?.database ?? defaultDatabase),
      (db) => Effect.sync(() => db.close())
    ).pipe(Effect.orDie)

    return Persistence.BackingPersistence.of({
      make: Effect.fnUntraced(function*(storeId) {
        const clock = yield* Clock.Clock
        return {
          get: (key) => get(db, clock, storeId, key),
          getMany: (keys) => getMany(db, clock, storeId, keys),
          set: (key, value, ttl) => set(db, clock, storeId, key, value, ttl),
          setMany: (entries) => setMany(db, clock, storeId, entries),
          remove: (key) => remove(db, storeId, key),
          clear: clear(db, storeId)
        }
      })
    })
  }))

const openDatabase = (database: string): Effect.Effect<IDBDatabase, Persistence.PersistenceError> =>
  Effect.gen(function*() {
    const openRequest = yield* Effect.try({
      try: () => globalThis.indexedDB.open(database, databaseVersion),
      catch: (cause) =>
        new Persistence.PersistenceError({
          message: "Failed to open backing store database",
          cause
        })
    })

    openRequest.onupgradeneeded = () => {
      const db = openRequest.result
      const entries = db.objectStoreNames.contains(entriesStoreName)
        ? openRequest.transaction?.objectStore(entriesStoreName)
        : db.createObjectStore(entriesStoreName, { keyPath: ["storeId", "id"] })
      if (entries && !entries.indexNames.contains(storeIdIndexName)) {
        entries.createIndex(storeIdIndexName, storeIdIndexName, { unique: false })
      }
    }

    return yield* idbRequest("Failed to open backing store database", () => openRequest)
  })

const isExpired = (row: EntryRow, now: number): boolean => row.expires !== null && row.expires <= now

const makeEmptyResults = (keys: Arr.NonEmptyArray<string>): Arr.NonEmptyArray<object | undefined> => {
  const out: Arr.NonEmptyArray<object | undefined> = [undefined]
  for (let i = 1; i < keys.length; i++) {
    out[i] = undefined
  }
  return out
}

const get = (
  db: IDBDatabase,
  clock: Clock.Clock,
  storeId: string,
  key: string
): Effect.Effect<object | undefined, Persistence.PersistenceError> =>
  withEntriesTransaction<object | undefined>(
    db,
    "readwrite",
    `Failed to get key ${key} from backing store`,
    undefined,
    (
      entries,
      setResult,
      fail
    ) => {
      const now = clock.currentTimeMillisUnsafe()
      const id: [string, string] = [storeId, key]
      const request = entries.get(id)
      request.onerror = () => fail(request.error)
      request.onsuccess = () => {
        const row = request.result as EntryRow | undefined
        if (!row || !isExpired(row, now)) {
          setResult(row?.value)
          return
        }

        const deleteRequest = entries.delete(id)
        deleteRequest.onerror = () => fail(deleteRequest.error)
        deleteRequest.onsuccess = () => setResult(undefined)
      }
    }
  )

const getMany = (
  db: IDBDatabase,
  clock: Clock.Clock,
  storeId: string,
  keys: Arr.NonEmptyArray<string>
): Effect.Effect<Arr.NonEmptyArray<object | undefined>, Persistence.PersistenceError> =>
  withEntriesTransaction(
    db,
    "readwrite",
    "Failed to getMany from backing store",
    makeEmptyResults(keys),
    (entries, setResult, fail) => {
      const now = clock.currentTimeMillisUnsafe()
      const results = makeEmptyResults(keys)

      const loop = (index: number): void => {
        if (index >= keys.length) {
          setResult(results)
          return
        }

        const key = keys[index]
        const id: [string, string] = [storeId, key]
        const request = entries.get(id)
        request.onerror = () => fail(request.error)
        request.onsuccess = () => {
          const row = request.result as EntryRow | undefined
          if (!row || !isExpired(row, now)) {
            results[index] = row?.value
            loop(index + 1)
            return
          }

          const deleteRequest = entries.delete(id)
          deleteRequest.onerror = () => fail(deleteRequest.error)
          deleteRequest.onsuccess = () => {
            results[index] = undefined
            loop(index + 1)
          }
        }
      }

      loop(0)
    }
  )

const set = (
  db: IDBDatabase,
  clock: Clock.Clock,
  storeId: string,
  key: string,
  value: object,
  ttl: Duration.Duration | undefined
): Effect.Effect<void, Persistence.PersistenceError> =>
  withEntriesTransaction(
    db,
    "readwrite",
    `Failed to set key ${key} in backing store`,
    undefined,
    (entries, _setResult, fail) => {
      const request = entries.put(
        {
          storeId,
          id: key,
          value,
          expires: Persistence.unsafeTtlToExpires(clock, ttl)
        } satisfies EntryRow
      )
      request.onerror = () => fail(request.error)
    }
  )

const setMany = (
  db: IDBDatabase,
  clock: Clock.Clock,
  storeId: string,
  entries: Arr.NonEmptyArray<readonly [key: string, value: object, ttl: Duration.Duration | undefined]>
): Effect.Effect<void, Persistence.PersistenceError> =>
  withEntriesTransaction(
    db,
    "readwrite",
    "Failed to setMany in backing store",
    undefined,
    (store, _setResult, fail) => {
      for (const [key, value, ttl] of entries) {
        const request = store.put(
          {
            storeId,
            id: key,
            value,
            expires: Persistence.unsafeTtlToExpires(clock, ttl)
          } satisfies EntryRow
        )
        request.onerror = () => fail(request.error)
      }
    }
  )

const remove = (
  db: IDBDatabase,
  storeId: string,
  key: string
): Effect.Effect<void, Persistence.PersistenceError> =>
  withEntriesTransaction(
    db,
    "readwrite",
    `Failed to remove key ${key} from backing store`,
    undefined,
    (entries, _setResult, fail) => {
      const request = entries.delete([storeId, key])
      request.onerror = () => fail(request.error)
    }
  )

const clear = (db: IDBDatabase, storeId: string): Effect.Effect<void, Persistence.PersistenceError> =>
  withEntriesTransaction(db, "readwrite", "Failed to clear backing store", undefined, (entries, _setResult, fail) => {
    const index = entries.index(storeIdIndexName)
    const cursorRequest = index.openCursor(storeId)
    cursorRequest.onerror = () => fail(cursorRequest.error)
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) {
        return
      }

      const deleteRequest = cursor.delete()
      deleteRequest.onerror = () => fail(deleteRequest.error)
      deleteRequest.onsuccess = () => cursor.continue()
    }
  })

const withEntriesTransaction = <A>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  message: string,
  initial: A,
  run: (
    entries: IDBObjectStore,
    setResult: (result: A) => void,
    fail: (cause: unknown) => void
  ) => void
): Effect.Effect<A, Persistence.PersistenceError> =>
  Effect.flatMap(
    Effect.try({
      try: () => {
        const tx = db.transaction(entriesStoreName, mode)
        return [tx, tx.objectStore(entriesStoreName)] as const
      },
      catch: (cause) => new Persistence.PersistenceError({ message, cause })
    }),
    ([tx, entries]) =>
      Effect.callback<A, Persistence.PersistenceError>((resume) => {
        let done = false
        let result = initial
        const fail = (cause: unknown) => {
          if (done) {
            return
          }
          done = true
          resume(Effect.fail(new Persistence.PersistenceError({ message, cause })))
        }

        tx.oncomplete = () => {
          if (done) {
            return
          }
          done = true
          resume(Effect.succeed(result))
        }
        tx.onerror = () => fail(tx.error)
        tx.onabort = () => fail(tx.error)

        run(entries, (next) => {
          result = next
        }, fail)

        return Effect.sync(() => {
          if (!done) {
            tx.abort()
          }
        })
      })
  )

const idbRequest = <A>(
  message: string,
  evaluate: () => IDBRequest<A>
): Effect.Effect<A, Persistence.PersistenceError> =>
  Effect.flatMap(
    Effect.try({
      try: evaluate,
      catch: (cause) => new Persistence.PersistenceError({ message, cause })
    }),
    (request) =>
      Effect.callback<A, Persistence.PersistenceError>((resume) => {
        let done = false
        const fail = (cause: unknown) => {
          if (done) {
            return
          }
          done = true
          resume(Effect.fail(new Persistence.PersistenceError({ message, cause })))
        }

        if (request.readyState === "done") {
          done = true
          resume(Effect.succeed(request.result))
          return
        }

        request.onsuccess = () => {
          if (done) {
            return
          }
          done = true
          resume(Effect.succeed(request.result))
        }
        request.onerror = () => fail(request.error)
      })
  )
