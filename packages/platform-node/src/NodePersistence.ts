/**
 * @since 1.0.0
 */
import type { NonEmptyArray } from "effect/collections/Array"
import * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Duration from "effect/time/Duration"
import * as Persistence from "effect/unstable/persistence/Persistence"
import * as IoRedis from "ioredis"

export {
  /**
   * @since 1.0.0
   * @category Re-exports
   */
  IoRedis
}

/**
 * @since 1.0.0
 * @category Constructors
 */
export const makeRedis: (
  options: IoRedis.RedisOptions | IoRedis.Redis
) => Effect.Effect<
  Persistence.BackingPersistence["Service"],
  never,
  Scope.Scope
> = Effect.fnUntraced(function*(options: IoRedis.RedisOptions | IoRedis.Redis) {
  const redis = options instanceof IoRedis.Redis ? options : yield* Effect.acquireRelease(
    Effect.sync(() => new IoRedis.Redis(options)),
    (redis) => Effect.promise(() => redis.quit())
  )
  return Persistence.BackingPersistence.of({
    make: (prefix) =>
      Effect.sync(() => {
        const prefixed = (key: string) => `${prefix}:${key}`
        const parse = (str: string | null) => {
          if (str === null) {
            return Effect.undefined
          }
          try {
            return Effect.succeed(JSON.parse(str))
          } catch (cause) {
            return Effect.fail(
              new Persistence.PersistenceError({
                message: `Failed to parse value from Redis`,
                cause
              })
            )
          }
        }
        return identity<Persistence.BackingPersistenceStore>({
          get: (key) =>
            Effect.flatMap(
              Effect.tryPromise({
                try: () => redis.get(prefixed(key)),
                catch: (cause) =>
                  new Persistence.PersistenceError({
                    message: `Failed to get key ${key} from Redis`,
                    cause
                  })
              }),
              parse
            ),
          getMany: (keys) =>
            Effect.flatMap(
              Effect.tryPromise({
                try: () => redis.mget(keys.map(prefixed)),
                catch: (cause) =>
                  new Persistence.PersistenceError({
                    message: `Failed to getMany from Redis`,
                    cause
                  })
              }),
              (values) => {
                const out = new Array<object | undefined>(keys.length) as NonEmptyArray<object | undefined>
                for (let i = 0; i < keys.length; i++) {
                  const value = values[i]
                  try {
                    out[i] = value === null ? undefined : JSON.parse(value)
                  } catch {
                    // TODO: remove bad entries?
                    out[i] = undefined
                  }
                }
                return Effect.succeed(out)
              }
            ),
          set: (key, value, ttl) =>
            Effect.tryPromise({
              try: () =>
                ttl === undefined
                  ? redis.set(prefixed(key), JSON.stringify(value))
                  : redis.set(prefixed(key), JSON.stringify(value), "PX", Duration.toMillis(ttl)),
              catch: (cause) =>
                new Persistence.PersistenceError({
                  message: `Failed to set key ${key} in Redis`,
                  cause
                })
            }),
          setMany: (entries) =>
            Effect.suspend(() => {
              const sets = new Map<string, string>()
              const expires: Array<[string, number]> = []
              for (const [key, value, ttl] of entries) {
                const pkey = prefixed(key)
                sets.set(pkey, JSON.stringify(value))
                if (ttl) {
                  expires.push([pkey, Duration.toMillis(ttl)])
                }
              }
              const multi = redis.multi()
              multi.mset(sets)
              for (const [key, ms] of expires) {
                multi.pexpire(key, ms)
              }
              return Effect.tryPromise({
                try: () => multi.exec(),
                catch: (cause) =>
                  new Persistence.PersistenceError({
                    message: `Failed to setMany in Redis`,
                    cause
                  })
              })
            }),
          remove: (key) =>
            Effect.tryPromise({
              try: () => redis.del(prefixed(key)),
              catch: (cause) =>
                new Persistence.PersistenceError({
                  message: `Failed to remove key ${key} from Redis`,
                  cause
                })
            }),
          clear: Effect.tryPromise({
            try: () => redis.keys(`${prefix}:*`).then((keys) => redis.del(keys)),
            catch: (error) =>
              new Persistence.PersistenceError({
                message: `Failed to clear keys from Redis`,
                cause: error
              })
          })
        })
      })
  })
})

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerBackingRedis: (
  options: IoRedis.RedisOptions | IoRedis.Redis
) => Layer.Layer<Persistence.BackingPersistence> = Layer.effect(Persistence.BackingPersistence)(makeRedis)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerRedis = (options: IoRedis.RedisOptions | IoRedis.Redis): Layer.Layer<Persistence.Persistence> =>
  Persistence.layer.pipe(
    Layer.provide(layerBackingRedis(options))
  )

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerRedisConfig = (
  options: Config.Wrap<IoRedis.RedisOptions>
): Layer.Layer<Persistence.Persistence, Config.ConfigError> =>
  Persistence.layer.pipe(
    Layer.provide(
      Layer.effect(Persistence.BackingPersistence)(Effect.flatMap(
        Config.unwrap(options).asEffect(),
        makeRedis
      ))
    )
  )
