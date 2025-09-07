/**
 * @since 1.0.0
 */
import type { RedisOptions as BunRedisOptions } from "bun"
import { RedisClient } from "bun"
import type { NonEmptyArray } from "effect/collections/Array"
import * as Config from "effect/config/Config"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Duration from "effect/time/Duration"
import * as Persistence from "effect/unstable/persistence/Persistence"

/**
 * @since 1.0.0
 * @category Models
 */
export interface RedisOptions extends BunRedisOptions {
  readonly url?: string | undefined
}

/**
 * @since 1.0.0
 * @category Constructors
 */
export const makeRedis: (
  options: RedisClient | RedisOptions
) => Effect.Effect<
  Persistence.BackingPersistence["Service"],
  never,
  Scope.Scope
> = Effect.fnUntraced(function*(options: RedisOptions | RedisClient) {
  const redis = options instanceof RedisClient ? options : yield* Effect.acquireRelease(
    Effect.sync(() => new RedisClient(options.url, options)),
    (redis) => Effect.sync(() => redis.close())
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
                try: () => redis.mget(...keys.map(prefixed)),
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
              // TODO: switch to multi/exec and mset when supported in Bun
              let lastPromise: Promise<unknown>
              for (const [key, value, ttl] of entries) {
                if (ttl) {
                  lastPromise = redis.set(prefixed(key), JSON.stringify(value), "PX", Duration.toMillis(ttl))
                } else {
                  lastPromise = redis.set(prefixed(key), JSON.stringify(value))
                }
              }
              return Effect.tryPromise({
                try: () => lastPromise!,
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
            try: () => redis.keys(`${prefix}:*`).then((keys) => redis.del(...keys)),
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
  options: RedisOptions | RedisClient
) => Layer.Layer<Persistence.BackingPersistence> = Layer.effect(Persistence.BackingPersistence)(makeRedis)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerRedis = (options: RedisOptions | RedisClient): Layer.Layer<Persistence.Persistence> =>
  Persistence.layer.pipe(
    Layer.provide(layerBackingRedis(options))
  )

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerRedisConfig = (
  options: Config.Wrap<RedisOptions>
): Layer.Layer<Persistence.Persistence, Config.ConfigError> =>
  Persistence.layer.pipe(
    Layer.provide(
      Layer.effect(Persistence.BackingPersistence)(Effect.flatMap(
        Config.unwrap(options).asEffect(),
        makeRedis
      ))
    )
  )
