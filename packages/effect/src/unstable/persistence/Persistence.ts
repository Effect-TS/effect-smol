/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { identity } from "../../Function.ts"
import * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import * as Layer from "../../Layer.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Clock from "../../time/Clock.ts"
import * as Duration from "../../time/Duration.ts"
import * as SqlClient from "../sql/SqlClient.ts"
import type { SqlError } from "../sql/SqlError.ts"
import * as KeyValueStore from "./KeyValueStore.ts"
import * as Persistable from "./Persistable.ts"

const ErrorTypeId = "~effect/persistence/Persistence/PersistenceError" as const

/**
 * @since 4.0.0
 * @category errors
 */
export class PersistenceError extends Schema.ErrorClass(ErrorTypeId)({
  _tag: Schema.tag("PersistenceError"),
  message: Schema.String,
  cause: Schema.optional(Schema.Defect)
}) {
  /**
   * @since 4.0.0
   */
  readonly [ErrorTypeId]: typeof ErrorTypeId = ErrorTypeId
}

/**
 * @since 4.0.0
 * @category Models
 */
export class Persistence extends ServiceMap.Key<Persistence, {
  readonly make: (options: {
    readonly storeId: string
    readonly timeToLive?: (exit: Exit.Exit<unknown, unknown>, key: Persistable.Any) => Duration.DurationInput
  }) => Effect.Effect<PersistenceStore, never, Scope.Scope>
}>()("effect/persistence/Persistence") {}

/**
 * @since 4.0.0
 * @category models
 */
export interface PersistenceStore {
  readonly get: <A extends Schema.Top, E extends Schema.Top>(
    key: Persistable.Persistable<A, E>
  ) => Effect.Effect<
    Exit.Exit<A["Type"], E["Type"]> | undefined,
    PersistenceError | Schema.SchemaError,
    A["DecodingServices"] | E["DecodingServices"]
  >
  readonly getMany: <A extends Schema.Top, E extends Schema.Top>(
    keys: Iterable<Persistable.Persistable<A, E>>
  ) => Effect.Effect<
    Array<Exit.Exit<A["Type"], E["Type"]> | undefined>,
    PersistenceError | Schema.SchemaError,
    A["DecodingServices"] | E["DecodingServices"]
  >
  readonly set: <A extends Schema.Top, E extends Schema.Top>(
    key: Persistable.Persistable<A, E>,
    value: Exit.Exit<A["Type"], E["Type"]>
  ) => Effect.Effect<void, PersistenceError | Schema.SchemaError, A["EncodingServices"] | E["EncodingServices"]>
  readonly setMany: <A extends Schema.Top, E extends Schema.Top>(
    entries: Iterable<readonly [Persistable.Persistable<A, E>, Exit.Exit<A["Type"], E["Type"]>]>
  ) => Effect.Effect<void, PersistenceError | Schema.SchemaError, A["EncodingServices"] | E["EncodingServices"]>
  readonly remove: <A extends Schema.Top, E extends Schema.Top>(
    key: Persistable.Persistable<A, E>
  ) => Effect.Effect<void, PersistenceError>
  readonly clear: Effect.Effect<void, PersistenceError>
}

/**
 * @since 4.0.0
 * @category BackingPersistence
 */
export class BackingPersistence extends ServiceMap.Key<BackingPersistence, {
  readonly make: (storeId: string) => Effect.Effect<BackingPersistenceStore, never, Scope.Scope>
}>()("effect/persistence/BackingPersistence") {}

/**
 * @since 4.0.0
 * @category BackingPersistence
 */
export interface BackingPersistenceStore {
  readonly get: (key: string) => Effect.Effect<object | undefined, PersistenceError>
  readonly getMany: (
    keys: Arr.NonEmptyArray<string>
  ) => Effect.Effect<Arr.NonEmptyArray<object | undefined>, PersistenceError>
  readonly set: (
    key: string,
    value: object,
    ttl: Duration.Duration | undefined
  ) => Effect.Effect<void, PersistenceError>
  readonly setMany: (
    entries: Arr.NonEmptyArray<readonly [key: string, value: object, ttl: Duration.Duration | undefined]>
  ) => Effect.Effect<void, PersistenceError>
  readonly remove: (key: string) => Effect.Effect<void, PersistenceError>
  readonly clear: Effect.Effect<void, PersistenceError>
}

/**
 * @since 4.0.0
 * @category layers
 */
export const layer = Layer.effect(Persistence)(Effect.gen(function*() {
  const backing = yield* BackingPersistence
  const scope = yield* Effect.scope
  return Persistence.of({
    make: Effect.fnUntraced(function*(options) {
      const storage = yield* backing.make(options.storeId)
      const timeToLive = options.timeToLive ?? (() => Duration.infinity)

      return identity<PersistenceStore>({
        get: (key) =>
          Effect.flatMap(
            storage.get(PrimaryKey.value(key)),
            (result) => result ? Persistable.deserializeExit(key, result) : Effect.undefined
          ),
        getMany: Effect.fnUntraced(function*(keys) {
          const primaryKeys = Arr.empty<string>()
          const persistables = Arr.empty<Persistable.Any>()
          for (const key of keys) {
            primaryKeys.push(PrimaryKey.value(key))
            persistables.push(key)
          }
          if (!Arr.isArrayNonEmpty(primaryKeys)) return []

          const results = yield* storage.getMany(primaryKeys)
          if (results.length !== primaryKeys.length) {
            return yield* Effect.fail(
              new PersistenceError({
                message: `Expected ${primaryKeys.length} results but got ${results.length} from backing store`
              })
            )
          }
          const out = new Array<Exit.Exit<unknown, unknown> | undefined>(primaryKeys.length)
          let toRemove: Array<string> | undefined
          for (let i = 0; i < results.length; i++) {
            const key = persistables[i]
            const result = results[i]
            if (result === undefined) {
              out[i] = undefined
              continue
            }
            const eff = Persistable.deserializeExit(key, result)
            const exit = Exit.isExit(eff)
              ? eff as Exit.Exit<Exit.Exit<any, any>, Schema.SchemaError>
              : yield* Effect.exit(eff)
            if (Exit.isFailure(exit)) {
              toRemove ??= []
              toRemove.push(PrimaryKey.value(key))
              out[i] = undefined
              continue
            }
            out[i] = exit.value
          }
          if (toRemove) {
            for (let i = 0; i < toRemove.length; i++) {
              yield* Effect.forkIn(storage.remove(toRemove[i]), scope)
            }
          }
          return out
        }),
        set(key, value) {
          const ttl = Duration.fromDurationInputUnsafe(timeToLive(value, key))
          if (Duration.isZero(ttl)) return Effect.void
          return Persistable.serializeExit(key, value).pipe(
            Effect.flatMap((encoded) =>
              storage.set(PrimaryKey.value(key), encoded as object, Duration.isFinite(ttl) ? ttl : undefined)
            )
          )
        },
        setMany: Effect.fnUntraced(function*(entries) {
          const encodedEntries = Arr.empty<readonly [string, object, Duration.Duration | undefined]>()
          for (const [key, value] of entries) {
            const ttl = Duration.fromDurationInputUnsafe(timeToLive(value, key))
            if (Duration.isZero(ttl)) continue
            const encoded = Persistable.serializeExit(key, value)
            const exit = Exit.isExit(encoded)
              ? encoded as Exit.Exit<unknown, Schema.SchemaError>
              : yield* Effect.exit(encoded)
            if (Exit.isFailure(exit)) {
              return yield* exit
            }
            encodedEntries.push([PrimaryKey.value(key), exit.value as object, Duration.isFinite(ttl) ? ttl : undefined])
          }
          if (!Arr.isArrayNonEmpty(encodedEntries)) return
          return yield* storage.setMany(encodedEntries)
        }),
        remove: (key) => storage.remove(PrimaryKey.value(key)),
        clear: storage.clear
      })
    })
  })
}))

/**
 * @since 4.0.0
 * @category layers
 */
export const layerBackingMemory: Layer.Layer<BackingPersistence> = Layer.sync(BackingPersistence)(
  () => {
    const stores = new Map<string, Map<string, readonly [object, expires: number | null]>>()
    const getStore = (storeId: string) => {
      let store = stores.get(storeId)
      if (store === undefined) {
        store = new Map<string, readonly [object, expires: number | null]>()
        stores.set(storeId, store)
      }
      return store
    }
    return BackingPersistence.of({
      make: (storeId) =>
        Effect.clockWith((clock) => {
          const map = getStore(storeId)
          const unsafeGet = (key: string): object | undefined => {
            const value = map.get(key)
            if (value === undefined) {
              return undefined
            } else if (value[1] !== null && value[1] <= clock.currentTimeMillisUnsafe()) {
              map.delete(key)
              return undefined
            }
            return value[0]
          }
          return Effect.succeed<BackingPersistenceStore>({
            get: (key) => Effect.sync(() => unsafeGet(key)),
            getMany: (keys) => Effect.sync(() => Arr.map(keys, unsafeGet)),
            set: (key, value, ttl) => Effect.sync(() => map.set(key, [value, unsafeTtlToExpires(clock, ttl)])),
            setMany: (entries) =>
              Effect.sync(() => {
                for (const [key, value, ttl] of entries) {
                  map.set(key, [value, unsafeTtlToExpires(clock, ttl)])
                }
              }),
            remove: (key) => Effect.sync(() => map.delete(key)),
            clear: Effect.sync(() => map.clear())
          })
        })
    })
  }
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layerBackingSql: Layer.Layer<
  BackingPersistence,
  never,
  SqlClient.SqlClient
> = Layer.effect(BackingPersistence)(Effect.gen(function*() {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms()
  return BackingPersistence.of({
    make: Effect.fnUntraced(function*(storeId) {
      const clock = yield* Clock.Clock
      const table = sql(`effect_persistence_${storeId}`)
      yield* sql.onDialectOrElse({
        mysql: () =>
          sql`
            CREATE TABLE IF NOT EXISTS ${table} (
              id VARCHAR(191) PRIMARY KEY,
              value TEXT NOT NULL,
              expires BIGINT
            )
          `,
        pg: () =>
          sql`
            CREATE TABLE IF NOT EXISTS ${table} (
              id TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              expires BIGINT
            )
          `,
        mssql: () =>
          sql`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=${table} AND xtype='U')
            CREATE TABLE ${table} (
              id NVARCHAR(450) PRIMARY KEY,
              value NVARCHAR(MAX) NOT NULL,
              expires BIGINT
            )
          `,
        // sqlite
        orElse: () =>
          sql`
            CREATE TABLE IF NOT EXISTS ${table} (
              id TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              expires INTEGER
            )
          `
      }).pipe(Effect.orDie)

      // Cleanup expired entries on startup
      yield* Effect.ignore(
        sql`DELETE FROM ${table} WHERE expires IS NOT NULL AND expires <= ${clock.currentTimeMillisUnsafe()}`
      )

      type UpsertFn = (
        entries: Array<{ id: string; value: string; expires: number | null }>
      ) => Effect.Effect<unknown, SqlError>

      const upsert = sql.onDialectOrElse({
        pg: (): UpsertFn => (entries) =>
          sql`
            INSERT INTO ${table} ${sql.insert(entries)}
            ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value, expires=EXCLUDED.expires
          `.unprepared,
        mysql: (): UpsertFn => (entries) =>
          sql`
            INSERT INTO ${table} ${sql.insert(entries)}
            ON DUPLICATE KEY UPDATE value=VALUES(value), expires=VALUES(expires)
          `.unprepared,
        // sqlite
        orElse: (): UpsertFn => (entries) =>
          sql`
            INSERT INTO ${table} ${sql.insert(entries)}
            ON CONFLICT(id) DO UPDATE SET value=excluded.value, expires=excluded.expires
          `.unprepared
      })

      const wrapString = sql.onDialectOrElse({
        mssql: () => (s: string) => `N'${s}'`,
        orElse: () => (s: string) => `'${s}'`
      })

      return identity<BackingPersistenceStore>({
        get: (key) =>
          sql<
            { value: string }
          >`SELECT value FROM ${table} WHERE id = ${key} AND (expires IS NULL OR expires > ${clock.currentTimeMillisUnsafe()})`
            .pipe(
              Effect.mapError((cause) =>
                new PersistenceError({
                  message: `Failed to get key ${key} from backing store`,
                  cause
                })
              ),
              Effect.flatMap((rows) => {
                if (rows.length === 0) {
                  return Effect.undefined
                }
                try {
                  return Effect.succeed(JSON.parse(rows[0].value))
                } catch (cause) {
                  return Effect.fail(
                    new PersistenceError({
                      message: `Failed to parse value for key ${key} from backing store`,
                      cause
                    })
                  )
                }
              })
            ),
        getMany: (keys) =>
          sql<{ id: string; value: string }>`SELECT id, value FROM ${table} WHERE id IN (${
            sql.literal(keys.map(wrapString).join(", "))
          }) AND (expires IS NULL OR expires > ${clock.currentTimeMillisUnsafe()})`.unprepared.pipe(
            Effect.mapError((cause) =>
              new PersistenceError({
                message: `Failed to getMany from backing store`,
                cause
              })
            ),
            Effect.flatMap((rows) => {
              const out = new Array<object | undefined>(keys.length)
              for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                const index = keys.indexOf(row.id)
                if (index === -1) continue
                try {
                  out[index] = JSON.parse(row.value)
                } catch {
                  // ignore
                }
              }
              return Effect.succeed(out as Arr.NonEmptyArray<object | undefined>)
            })
          ),
        set: (key, value, ttl) =>
          Effect.suspend(() => {
            try {
              return upsert([{ id: key, value: JSON.stringify(value), expires: unsafeTtlToExpires(clock, ttl) }]).pipe(
                Effect.mapError((cause) =>
                  new PersistenceError({
                    message: `Failed to set key ${key} in backing store`,
                    cause
                  })
                ),
                Effect.asVoid
              )
            } catch (cause) {
              return Effect.fail(
                new PersistenceError({
                  message: `Failed to serialize value for key ${key} to backing store`,
                  cause
                })
              )
            }
          }),
        setMany: (entries) =>
          Effect.suspend(() => {
            try {
              const encoded = entries.map(([key, value, ttl]) => ({
                id: key,
                value: JSON.stringify(value),
                expires: unsafeTtlToExpires(clock, ttl)
              }))
              return upsert(encoded).pipe(
                Effect.mapError((cause) =>
                  new PersistenceError({
                    message: `Failed to setMany in backing store`,
                    cause
                  })
                ),
                Effect.asVoid
              )
            } catch (cause) {
              return Effect.fail(
                new PersistenceError({
                  message: `Failed to serialize values into backing store`,
                  cause
                })
              )
            }
          }),
        remove: (key) =>
          sql`DELETE FROM ${table} WHERE id = ${key}`.pipe(
            Effect.mapError((cause) =>
              new PersistenceError({
                message: `Failed to remove key ${key} from backing store`,
                cause
              })
            ),
            Effect.asVoid
          ),
        clear: sql`DELETE FROM ${table}`.pipe(
          Effect.mapError((cause) =>
            new PersistenceError({
              message: `Failed to clear backing store`,
              cause
            })
          ),
          Effect.asVoid
        )
      })
    })
  })
}))

/**
 * @since 4.0.0
 * @category layers
 */
export const layerBackingKvs: Layer.Layer<
  BackingPersistence,
  never,
  KeyValueStore.KeyValueStore
> = Layer.effect(BackingPersistence)(Effect.gen(function*() {
  const backing = yield* KeyValueStore.KeyValueStore
  const clock = yield* Clock.Clock
  return BackingPersistence.of({
    make: (storeId) =>
      Effect.sync(() => {
        const store = KeyValueStore.prefix(backing, storeId)
        const get = (key: string) =>
          Effect.flatMap(
            Effect.mapError(
              store.get(key),
              (error) =>
                new PersistenceError({
                  message: `Failed to get key ${key} from backing store`,
                  cause: error
                })
            ),
            (str) => {
              if (str === undefined) {
                return Effect.undefined
              }
              try {
                const parsed = JSON.parse(str)
                if (!Array.isArray(parsed)) return Effect.undefined
                const [value, expires] = parsed as [object, number | null]
                if (expires !== null && expires <= clock.currentTimeMillisUnsafe()) {
                  return Effect.as(Effect.ignore(store.remove(key)), undefined)
                }
                return Effect.succeed(value)
              } catch (cause) {
                return Effect.fail(
                  new PersistenceError({
                    message: `Failed to parse value for key ${key} from backing store`,
                    cause
                  })
                )
              }
            }
          )
        return identity<BackingPersistenceStore>({
          get,
          getMany: (keys) => Effect.forEach(keys, get, { concurrency: "unbounded" }),
          set: (key, value, ttl) =>
            Effect.suspend(() => {
              try {
                return Effect.mapError(
                  store.set(key, JSON.stringify([value, unsafeTtlToExpires(clock, ttl)])),
                  (cause) =>
                    new PersistenceError({
                      message: `Failed to set key ${key} in backing store`,
                      cause
                    })
                )
              } catch (cause) {
                return Effect.fail(
                  new PersistenceError({
                    message: `Failed to serialize value for key ${key} to backing store`,
                    cause
                  })
                )
              }
            }),
          setMany: (entries) =>
            Effect.forEach(entries, ([key, value, ttl]) => {
              const expires = unsafeTtlToExpires(clock, ttl)
              if (expires === null) return Effect.void
              const encoded = JSON.stringify([value, expires])
              return store.set(key, encoded)
            }, { concurrency: "unbounded", discard: true }).pipe(
              Effect.mapError((cause) =>
                new PersistenceError({
                  message: `Failed to setMany in backing store`,
                  cause
                })
              )
            ),
          remove: (key) =>
            Effect.mapError(
              store.remove(key),
              (cause) => new PersistenceError({ message: `Failed to remove key ${key} from backing store`, cause })
            ),
          clear: Effect.mapError(store.clear, (cause) =>
            new PersistenceError({ message: `Failed to clear backing store`, cause }))
        })
      })
  })
}))

/**
 * @since 4.0.0
 * @category layers
 */
export const layerKvs: Layer.Layer<Persistence, never, KeyValueStore.KeyValueStore> = layer.pipe(
  Layer.provide(layerBackingKvs)
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layerMemory: Layer.Layer<Persistence> = layer.pipe(
  Layer.provide(layerBackingMemory)
)

/**
 * @since 4.0.0
 * @category layers
 */
export const layerSql: Layer.Layer<Persistence, never, SqlClient.SqlClient> = layer.pipe(
  Layer.provide(layerBackingSql)
)

/**
 * @since 4.0.0
 */
export const unsafeTtlToExpires = (clock: Clock.Clock, ttl: Duration.Duration | undefined): number | null =>
  ttl ? clock.currentTimeMillisUnsafe() + Duration.toMillis(ttl) : null
