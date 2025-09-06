/**
 * @since 4.0.0
 */
import * as Arr from "../../collections/Array.ts"
import type * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import { identity } from "../../Function.ts"
import * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import * as Layer from "../../Layer.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Clock from "../../time/Clock.ts"
import * as Duration from "../../time/Duration.ts"
import * as Persistable from "./Persistable.ts"

export const ErrorTypeId = "~effect/persistence/Persistence/PersistenceError" as const

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
    readonly timeToLive?: (key: Persistable.Any, exit: Exit.Exit<unknown, unknown>) => Duration.DurationInput
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
 * @category models
 */
export type TimeToLiveArgs<K extends Persistable.Any> = K extends Persistable.Persistable<infer _A, infer _E> ?
  [exit: Exit.Exit<_A["Type"], _E["Type"]>, request: K]
  : never

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
  readonly getMany: (key: Array<string>) => Effect.Effect<Array<object | undefined>, PersistenceError>
  readonly set: (
    key: string,
    value: object,
    ttl: Duration.Duration | undefined
  ) => Effect.Effect<void, PersistenceError>
  readonly setMany: (
    entries: ReadonlyArray<readonly [key: string, value: object, ttl: Duration.Duration | undefined]>
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
          const ttl = Duration.fromDurationInputUnsafe(timeToLive(key, value))
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
            const ttl = Duration.fromDurationInputUnsafe(timeToLive(key, value))
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
          if (encodedEntries.length === 0) return
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
            getMany: (keys) => Effect.sync(() => keys.map(unsafeGet)),
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

// /**
//  * @since 4.0.0
//  * @category layers
//  */
// export const layerKeyValueStore: Layer.Layer<BackingPersistence, never, KeyValueStore.KeyValueStore> = Layer.effect(
//   BackingPersistence,
//   Effect.gen(function*() {
//     const backing = yield* KeyValueStore.KeyValueStore
//     return BackingPersistence.of({
//       [BackingPersistenceTypeId]: BackingPersistenceTypeId,
//       make: (storeId) =>
//         Effect.map(Effect.clock, (clock) => {
//           const store = KeyValueStore.prefix(backing, storeId)
//           const get = (method: string, key: string) =>
//             Effect.flatMap(
//               Effect.mapError(
//                 store.get(key),
//                 (error) => PersistenceBackingError.make(method, error)
//               ),
//               Option.match({
//                 onNone: () => Effect.succeedNone,
//                 onSome: (s) =>
//                   Effect.flatMap(
//                     Effect.try({
//                       try: () => JSON.parse(s),
//                       catch: (error) => PersistenceBackingError.make(method, error)
//                     }),
//                     (_) => {
//                       if (!Array.isArray(_)) return Effect.succeedNone
//                       const [value, expires] = _ as [unknown, number | null]
//                       if (expires !== null && expires <= clock.unsafeCurrentTimeMillis()) {
//                         return Effect.as(Effect.ignore(store.remove(key)), Option.none())
//                       }
//                       return Effect.succeed(Option.some(value))
//                     }
//                   )
//               })
//             )
//           return identity<BackingPersistenceStore>({
//             get: (key) => get("get", key),
//             getMany: (keys) => Effect.forEach(keys, (key) => get("getMany", key), { concurrency: "unbounded" }),
//             set: (key, value, ttl) =>
//               Effect.flatMap(
//                 Effect.try({
//                   try: () => JSON.stringify([value, unsafeTtlToExpires(clock, ttl)]),
//                   catch: (error) => PersistenceBackingError.make("set", error)
//                 }),
//                 (u) =>
//                   Effect.mapError(
//                     store.set(key, u),
//                     (error) => PersistenceBackingError.make("set", error)
//                   )
//               ),
//             setMany: (entries) =>
//               Effect.forEach(entries, ([key, value, ttl]) => {
//                 const expires = unsafeTtlToExpires(clock, ttl)
//                 if (expires === null) return Effect.void
//                 const encoded = JSON.stringify([value, expires])
//                 return store.set(key, encoded)
//               }, { concurrency: "unbounded", discard: true }).pipe(
//                 Effect.mapError((error) => PersistenceBackingError.make("setMany", error))
//               ),
//             remove: (key) =>
//               Effect.mapError(
//                 store.remove(key),
//                 (error) => PersistenceBackingError.make("remove", error)
//               ),
//             clear: Effect.mapError(store.clear, (error) => PersistenceBackingError.make("clear", error))
//           })
//         })
//     })
//   })
// )

/**
 * @since 4.0.0
 * @category layers
 */
export const layerMemory: Layer.Layer<Persistence> = layer.pipe(
  Layer.provide(layerBackingMemory)
)

/**
 * @since 4.0.0
 */
export const unsafeTtlToExpires = (clock: Clock.Clock, ttl: Duration.Duration | undefined): number | null =>
  ttl ? clock.currentTimeMillisUnsafe() + Duration.toMillis(ttl) : null
