/**
 * @since 1.0.0
 */
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Worker from "effect/unstable/workers/Worker"
import { WorkerError, WorkerReceiveError } from "effect/unstable/workers/WorkerError"

/**
 * Creates browser worker layers by combining the default `WorkerPlatform` with a spawner for `Worker`, `SharedWorker`, or `MessagePort` instances.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layer = (
  spawn: (id: number) => Worker | SharedWorker | MessagePort
): Layer.Layer<Worker.WorkerPlatform | Worker.Spawner> =>
  Layer.merge(
    layerPlatform,
    Worker.layerSpawner(spawn)
  )

/**
 * Layer that provides the browser `WorkerPlatform` for `Worker`, `SharedWorker`, and `MessagePort` communication.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layerPlatform: Layer.Layer<Worker.WorkerPlatform> = Layer.succeed(Worker.WorkerPlatform)(
  Worker.makePlatform<globalThis.SharedWorker | globalThis.Worker | MessagePort>()({
    setup({ scope, worker }) {
      const port = "port" in worker ? worker.port : worker
      return Effect.as(
        Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            port.postMessage([1])
          })
        ),
        port
      )
    },
    listen({ deferred, emit, port, scope }) {
      function onMessage(event: MessageEvent) {
        emit(event.data)
      }
      function onError(event: ErrorEvent) {
        Deferred.doneUnsafe(
          deferred,
          new WorkerError({
            reason: new WorkerReceiveError({
              message: "An error event was emitter",
              cause: event.error ?? event.message
            })
          })
        )
      }
      port.addEventListener("message", onMessage as any)
      port.addEventListener("error", onError as any)
      if ("start" in port) {
        port.start()
      }
      return Scope.addFinalizer(
        scope,
        Effect.sync(() => {
          port.removeEventListener("message", onMessage as any)
          port.removeEventListener("error", onError as any)
        })
      )
    }
  })
)
