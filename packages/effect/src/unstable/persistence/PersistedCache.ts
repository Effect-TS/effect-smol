/**
 * @since 1.0.0
 */
import * as Cache from "../../caching/Cache.ts"
import * as Effect from "../../Effect.ts"
import type { Exit } from "../../Exit.ts"
import { constant, identity } from "../../Function.ts"
import type * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as Duration from "../../time/Duration.ts"
import type * as Persistable from "./Persistable.ts"
import * as Persistence from "./Persistence.js"

const TypeId = "~effect/persistence/PersistedCache" as const

/**
 * @since 1.0.0
 * @category Models
 */
export interface PersistedCache<K extends Persistable.Any> {
  readonly [TypeId]: typeof TypeId
  readonly inMemory: Cache.Cache<
    K,
    Persistable.Success<K>,
    Persistable.Error<K> | Persistence.PersistenceError | Schema.SchemaError,
    Persistable.Services<K>
  >
  readonly get: (key: K) => Effect.Effect<
    Persistable.Success<K>,
    Persistable.Error<K> | Persistence.PersistenceError | Schema.SchemaError,
    Persistable.Services<K>
  >
  readonly invalidate: (key: K) => Effect.Effect<void, Persistence.PersistenceError>
}

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make: <K extends Persistable.Any, R>(options: {
  readonly storeId: string
  readonly lookup: (key: K) => Effect.Effect<Persistable.Success<K>, Persistable.Error<K>, R>
  readonly timeToLive: Persistable.TimeToLiveFn<K>
  readonly inMemoryCapacity?: number | undefined
  readonly inMemoryTTL?: Persistable.TimeToLiveFn<K> | undefined
}) => Effect.Effect<
  PersistedCache<K>,
  never,
  R | Persistence.Persistence | Scope.Scope
> = Effect.fnUntraced(function*<K extends Persistable.Any, R>(options: {
  readonly storeId: string
  readonly lookup: (key: K) => Effect.Effect<Persistable.Success<K>, Persistable.Error<K>, R>
  readonly timeToLive: Persistable.TimeToLiveFn<K>
  readonly inMemoryCapacity?: number | undefined
  readonly inMemoryTTL?: Persistable.TimeToLiveFn<K> | undefined
}) {
  const store = yield* (yield* Persistence.Persistence).make({
    storeId: options.storeId,
    timeToLive: options.timeToLive as any
  })
  const inMemory = yield* Cache.makeWith({
    lookup: Effect.fnUntraced(function*(key: K) {
      const exit = yield* (store.get(key) as Effect.Effect<Exit<Persistable.Success<K>, Persistable.Error<K>>>)
      if (exit) {
        return yield* exit
      }
      const result = yield* Effect.exit(options.lookup(key))
      yield* (store.set(key, result) as Effect.Effect<void>)
      return yield* result
    }),
    timeToLive: options.inMemoryTTL ?? constant(Duration.seconds(10)),
    capacity: options.inMemoryCapacity ?? 1024
  })
  return identity<PersistedCache<K>>({
    [TypeId]: TypeId,
    inMemory,
    get: (key) => Cache.get(inMemory, key),
    invalidate: (key) => Effect.flatMap(store.remove(key), () => Cache.invalidate(inMemory, key))
  })
})
