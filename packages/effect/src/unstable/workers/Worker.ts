/**
 * @since 4.0.0
 */
import type * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as FiberSet from "../../FiberSet.ts"
import * as Layer from "../../Layer.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import { WorkerError } from "./WorkerError.ts"

/**
 * @since 4.0.0
 * @category models
 */
export class WorkerPlatform extends ServiceMap.Key<WorkerPlatform, {
  readonly spawn: (id: number) => Effect.Effect<Worker, WorkerError, Spawner>
}>()("effect/workers/Worker/WorkerPlatform") {}

/**
 * @since 4.0.0
 * @category models
 */
export interface Worker {
  readonly send: (message: unknown, transfers?: ReadonlyArray<unknown>) => Effect.Effect<void, WorkerError>
  readonly run: <A, E, R>(
    handler: (message: unknown) => Effect.Effect<A, E, R>,
    options?: {
      readonly onSpawn?: Effect.Effect<void> | undefined
    } | undefined
  ) => Effect.Effect<never, E | WorkerError, R>
}

/**
 * @since 4.0.0
 * @category models
 */
export const makeUnsafe = (options: {
  readonly send: (message: unknown, transfers?: ReadonlyArray<unknown>) => Effect.Effect<void, WorkerError>
  readonly run: <A, E, R>(
    handler: (message: PlatformMessage) => Effect.Effect<A, E, R>
  ) => Effect.Effect<never, E | WorkerError, R>
}): Worker => ({
  send: options.send,
  run(handler, options_) {
    const onSpawn = options_?.onSpawn ?? Effect.void
    return options.run((msg) => {
      if (msg[0] === 0) return onSpawn
      return handler(msg[1])
    })
  }
})

/**
 * @since 4.0.0
 * @category models
 */
export type PlatformMessage = readonly [ready: 0] | readonly [data: 1, unknown]

/**
 * @since 4.0.0
 * @category models
 */
export interface Spawner {
  readonly _: unique symbol
}

/**
 * @since 4.0.0
 * @category tags
 */
export const Spawner: ServiceMap.Key<Spawner, SpawnerFn<unknown>> = ServiceMap.Key("effect/workers/Worker/Spawner")

/**
 * @since 4.0.0
 * @category models
 */
export interface SpawnerFn<W = unknown> {
  (id: number): W
}

/**
 * @since 4.0.0
 * @category layers
 */
export const layerSpawner: <W = unknown>(spawner: SpawnerFn<W>) => Layer.Layer<Spawner> = Layer.succeed(Spawner)

/**
 * @since 4.0.0
 */
export const makePlatform = <W>() =>
<
  P extends {
    readonly postMessage: (message: any, transfers?: any | undefined) => void
  }
>(options: {
  readonly setup: (options: {
    readonly worker: W
    readonly scope: Scope.Scope
  }) => Effect.Effect<P, WorkerError>
  readonly listen: (options: {
    readonly port: P
    readonly emit: (data: any) => void
    readonly deferred: Deferred.Deferred<never, WorkerError>
    readonly scope: Scope.Scope
  }) => Effect.Effect<void>
}): WorkerPlatform["Service"] =>
  WorkerPlatform.of({
    spawn(id: number) {
      return Effect.gen(function*() {
        const spawn = (yield* Spawner) as SpawnerFn<W>
        let currentPort: P | undefined
        const buffer: Array<[unknown, ReadonlyArray<unknown> | undefined]> = []

        const run = <A, E, R>(
          handler: (_: PlatformMessage) => Effect.Effect<A, E, R>
        ) =>
          Effect.uninterruptibleMask((restore) =>
            Effect.scopedWith(Effect.fnUntraced(function*(scope) {
              const port = yield* options.setup({ worker: spawn(id), scope })
              yield* Scope.addFinalizer(
                scope,
                Effect.sync(() => {
                  currentPort = undefined
                })
              )
              const fiberSet = yield* FiberSet.make<any, WorkerError | E>().pipe(
                Scope.provide(scope)
              )
              const run = yield* FiberSet.runtime(fiberSet)<R>()
              yield* options.listen({
                port,
                scope,
                emit(data) {
                  run(handler(data))
                },
                deferred: fiberSet.deferred as any
              })
              currentPort = port
              if (buffer.length > 0) {
                for (const [message, transfers] of buffer) {
                  port.postMessage([0, message], transfers as any)
                }
                buffer.length = 0
              }
              return (yield* restore(FiberSet.join(fiberSet))) as never
            }))
          )

        const send = (message: unknown, transfers?: ReadonlyArray<unknown>) =>
          Effect.suspend(() => {
            if (currentPort === undefined) {
              buffer.push([message, transfers])
              return Effect.void
            }
            try {
              currentPort.postMessage([0, message], transfers as any)
              return Effect.void
            } catch (cause) {
              return Effect.fail(
                new WorkerError({ reason: "Send", message: "Failed to send message to worker", cause })
              )
            }
          })

        return { run, send }
      })
    }
  })
