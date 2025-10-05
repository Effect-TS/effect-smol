/**
 * @since 1.0.0
 */
import * as Cause from "effect/Cause"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import { WorkerError } from "effect/unstable/workers/WorkerError"
import * as WorkerRunner from "effect/unstable/workers/WorkerRunner"
import * as WorkerThreads from "node:worker_threads"

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<WorkerRunner.WorkerRunnerPlatform> = Layer.succeed(WorkerRunner.WorkerRunnerPlatform)({
  start<O = unknown, I = unknown>() {
    return Effect.gen(function*() {
      if (!WorkerThreads.parentPort && !process.send) {
        return yield* new WorkerError({
          reason: "Spawn",
          message: "not in a worker"
        })
      }

      const sendUnsafe = WorkerThreads.parentPort
        ? (_portId: number, message: any, transfers?: any) => WorkerThreads.parentPort!.postMessage(message, transfers)
        : (_portId: number, message: any, _transfers?: any) => process.send!(message)
      const send = (_portId: number, message: O, transfers?: ReadonlyArray<unknown>) =>
        Effect.sync(() => sendUnsafe(_portId, [1, message], transfers as any))

      const run = <A, E, R>(
        handler: (portId: number, message: I) => Effect.Effect<A, E, R> | void
      ): Effect.Effect<void, WorkerError, R> =>
        Effect.scopedWith(Effect.fnUntraced(function*(scope) {
          const closeLatch = Deferred.makeUnsafe<void, WorkerError>()
          const trackFiber = Fiber.runIn(scope)
          const services = yield* Effect.services<R>()
          const runFork = Effect.runForkWith(services)
          const onExit = (exit: Exit.Exit<any, E>) => {
            if (exit._tag === "Failure" && !Cause.isInterruptedOnly(exit.cause)) {
              runFork(Effect.logError("unhandled error in worker", exit.cause))
            }
          }
          ;(WorkerThreads.parentPort ?? process).on("message", (message: WorkerRunner.PlatformMessage<I>) => {
            if (message[0] === 0) {
              const result = handler(0, message[1])
              if (Effect.isEffect(result)) {
                const fiber = runFork(result)
                fiber.addObserver(onExit)
                trackFiber(fiber)
              }
            } else {
              if (WorkerThreads.parentPort) {
                WorkerThreads.parentPort.close()
              } else {
                process.channel?.unref()
              }
              Deferred.doneUnsafe(closeLatch, Exit.void)
            }
          })

          if (WorkerThreads.parentPort) {
            WorkerThreads.parentPort.on("messageerror", (cause) => {
              Deferred.doneUnsafe(
                closeLatch,
                new WorkerError({
                  reason: "Receive",
                  message: "received messageerror event",
                  cause
                }).asEffect()
              )
            })
            WorkerThreads.parentPort.on("error", (cause) => {
              Deferred.doneUnsafe(
                closeLatch,
                new WorkerError({
                  reason: "Receive",
                  message: "received messageerror event",
                  cause
                }).asEffect()
              )
            })
          }

          sendUnsafe(0, [0])

          return yield* Deferred.await(closeLatch)
        }))

      return { run, send, sendUnsafe }
    })
  }
})
