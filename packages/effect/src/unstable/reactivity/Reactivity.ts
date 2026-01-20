/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import * as FiberHandle from "../../FiberHandle.ts"
import { dual } from "../../Function.ts"
import * as Hash from "../../Hash.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../Stream.ts"

/**
 * @since 4.0.0
 * @category tags
 */
export class Reactivity extends ServiceMap.Service<
  Reactivity,
  {
    readonly invalidateUnsafe: (keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>) => void
    readonly registerUnsafe: (
      keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
      handler: () => void
    ) => () => void
    readonly invalidate: (
      keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
    ) => Effect.Effect<void>
    readonly mutation: <A, E, R>(
      keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>
    readonly query: <A, E, R>(
      keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope>
    readonly stream: <A, E, R>(
      keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
      effect: Effect.Effect<A, E, R>
    ) => Stream.Stream<A, E, Exclude<R, Scope.Scope>>
  }
>()("effect/experimental/Reactivity") {}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = Effect.sync(() => {
  const handlers = new Map<number | string, Set<() => void>>()

  const invalidateUnsafe = (keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>): void => {
    if (Array.isArray(keys)) {
      for (let i = 0; i < keys.length; i++) {
        const set = handlers.get(stringOrHash(keys[i]))
        if (set === undefined) continue
        for (const run of set) run()
      }
    } else {
      const record = keys as ReadonlyRecord<string, Array<unknown>>
      for (const key in record) {
        const hashes = idHashes(key, record[key])
        for (let i = 0; i < hashes.length; i++) {
          const set = handlers.get(hashes[i])
          if (set === undefined) continue
          for (const run of set) run()
        }

        const set = handlers.get(key)
        if (set !== undefined) {
          for (const run of set) run()
        }
      }
    }
  }

  const invalidate = (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): Effect.Effect<void> => Effect.sync(() => invalidateUnsafe(keys))

  const mutation = <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> => Effect.tap(effect, invalidate(keys))

  const registerUnsafe = (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    handler: () => void
  ): () => void => {
    const resolvedKeys = Array.isArray(keys) ? keys.map(stringOrHash) : recordHashes(keys as any)
    for (let i = 0; i < resolvedKeys.length; i++) {
      let set = handlers.get(resolvedKeys[i])
      if (set === undefined) {
        set = new Set()
        handlers.set(resolvedKeys[i], set)
      }
      set.add(handler)
    }
    return () => {
      for (let i = 0; i < resolvedKeys.length; i++) {
        const set = handlers.get(resolvedKeys[i])!
        set.delete(handler)
        if (set.size === 0) {
          handlers.delete(resolvedKeys[i])
        }
      }
    }
  }

  const query = <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope> =>
    Effect.gen(function*() {
      const scope = yield* Effect.scope
      const results = yield* Queue.make<A, E>()
      const runFork = yield* FiberHandle.makeRuntime<R>()

      let running = false
      let pending = false
      const handleExit = (exit: Exit.Exit<A, E>) => {
        if (exit._tag === "Failure") {
          Queue.failCauseUnsafe(results, exit.cause)
        } else {
          Queue.offerUnsafe(results, exit.value)
        }
        if (pending) {
          pending = false
          runFork(effect).addObserver(handleExit)
        } else {
          running = false
        }
      }

      function run() {
        if (running) {
          pending = true
          return
        }
        running = true
        runFork(effect).addObserver(handleExit)
      }

      const cancel = registerUnsafe(keys, run)
      yield* Scope.addFinalizer(scope, Effect.sync(cancel))
      run()

      return results as Queue.Dequeue<A, E>
    })

  const stream = <A, E, R>(
    tables: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>
  ): Stream.Stream<A, E, Exclude<R, Scope.Scope>> =>
    query(tables, effect).pipe(
      Effect.map(Stream.fromQueue),
      Stream.unwrap
    )

  return Reactivity.of({
    mutation,
    query,
    stream,
    invalidateUnsafe,
    invalidate,
    registerUnsafe
  })
})

/**
 * @since 4.0.0
 * @category accessors
 */
export const mutation: {
  (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R | Reactivity>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): Effect.Effect<A, E, R | Reactivity>
} = dual(2, <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
): Effect.Effect<A, E, R | Reactivity> => Reactivity.use((_) => _.mutation(keys, effect)))

/**
 * @since 4.0.0
 * @category accessors
 */
export const query: {
  (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope | Reactivity>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope | Reactivity>
} = dual(2, <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
): Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope | Reactivity> =>
  Reactivity.use((r) => r.query(keys, effect)))

/**
 * @since 4.0.0
 * @category accessors
 */
export const stream: {
  (
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Stream.Stream<A, E, Exclude<R, Scope.Scope> | Reactivity>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
  ): Stream.Stream<A, E, Exclude<R, Scope.Scope> | Reactivity>
} = dual(2, <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
): Stream.Stream<A, E, Exclude<R, Scope.Scope> | Reactivity> =>
  Reactivity.use((r) => r.query(keys, effect)).pipe(
    Effect.map(Stream.fromQueue),
    Stream.unwrap
  ))

/**
 * @since 4.0.0
 * @category accessors
 */
export const invalidate = (
  keys: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>>
): Effect.Effect<void, never, Reactivity> => Reactivity.use((r) => r.invalidate(keys))

/**
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<Reactivity> = Layer.effect(Reactivity)(make)

function stringOrHash(u: unknown): string | number {
  return typeof u === "string" ? u : Hash.hash(u)
}

const idHashes = (keyHash: number | string, ids: ReadonlyArray<unknown>): ReadonlyArray<string> => {
  const hashes: Array<string> = new Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    hashes[i] = `${keyHash}:${stringOrHash(ids[i])}`
  }
  return hashes
}

const recordHashes = (record: ReadonlyRecord<string, ReadonlyArray<unknown>>): ReadonlyArray<string> => {
  const hashes: Array<string> = []
  for (const key in record) {
    hashes.push(key)
    for (const idHash of idHashes(key, record[key])) {
      hashes.push(idHash)
    }
  }
  return hashes
}
