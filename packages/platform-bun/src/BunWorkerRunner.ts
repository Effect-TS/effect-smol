/**
 * @since 1.0.0
 */
import * as Cause from "effect/Cause"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import { WorkerError } from "effect/unstable/workers/WorkerError"
import * as WorkerRunner from "effect/unstable/workers/WorkerRunner"

declare const self: MessagePort

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<WorkerRunner.WorkerRunnerPlatform> = Layer.succeed(WorkerRunner.WorkerRunnerPlatform)({
  start: Effect.fnUntraced(function*<O = unknown, I = unknown>() {
    if (!("postMessage" in self)) {
      return yield* new WorkerError({ reason: "Spawn", message: "not in a Worker context" })
    }
    const port = self
    const run = <A, E, R>(
      handler: (portId: number, message: I) => Effect.Effect<A, E, R> | void
    ) =>
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

        function onMessage(event: MessageEvent) {
          const message = (event as MessageEvent).data as WorkerRunner.PlatformMessage<I>
          if (message[0] === 0) {
            const result = handler(0, message[1])
            if (Effect.isEffect(result)) {
              const fiber = runFork(result)
              fiber.addObserver(onExit)
              trackFiber(fiber)
            }
          } else {
            port.close()
            Deferred.doneUnsafe(closeLatch, Exit.void)
          }
        }
        function onMessageError(error: MessageEvent) {
          Deferred.doneUnsafe(
            closeLatch,
            new WorkerError({
              reason: "Receive",
              message: "received messageerror event",
              cause: error.data
            }).asEffect()
          )
        }
        function onError(error: MessageEvent) {
          Deferred.doneUnsafe(
            closeLatch,
            new WorkerError({ reason: "Receive", message: "received error event", cause: error.data }).asEffect()
          )
        }
        yield* Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            port.removeEventListener("message", onMessage)
            port.removeEventListener("messageerror", onError)
          })
        )
        port.addEventListener("message", onMessage)
        port.addEventListener("messageerror", onMessageError)
        port.postMessage([0])

        return yield* Deferred.await(closeLatch)
      }))

    const sendUnsafe = (_portId: number, message: O, transfer?: ReadonlyArray<unknown>) =>
      port.postMessage([1, message], {
        transfer: transfer as any
      })
    const send = (_portId: number, message: O, transfer?: ReadonlyArray<unknown>) =>
      Effect.sync(() => sendUnsafe(0, message, transfer))
    return identity<WorkerRunner.WorkerRunner<any, any>>({ run, send, sendUnsafe })
  })
})
