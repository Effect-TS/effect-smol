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
import * as Queue from "effect/Queue"
import * as Scope from "effect/Scope"
import { WorkerError } from "effect/unstable/workers/WorkerError"
import * as WorkerRunner from "effect/unstable/workers/WorkerRunner"

const cachedPorts = new Set<MessagePort>()
function globalHandleConnect(event: MessageEvent) {
  cachedPorts.add((event as MessageEvent).ports[0])
}
if (typeof self !== "undefined" && "onconnect" in self) {
  self.onconnect = globalHandleConnect
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = (self: MessagePort | Window): WorkerRunner.WorkerRunnerPlatform["Service"] => ({
  start: Effect.fnUntraced(function*<O = unknown, I = unknown>() {
    const disconnects = yield* Queue.make<number>()
    let currentPortId = 0

    const ports = new Map<number, readonly [MessagePort, Scope.Closeable]>()
    const sendUnsafe = (portId: number, message: O, transfer?: ReadonlyArray<unknown>) =>
      (ports.get(portId)?.[0] ?? self).postMessage([1, message], {
        transfer: transfer as any
      })
    const send = (portId: number, message: O, transfer?: ReadonlyArray<unknown>) =>
      Effect.sync(() => sendUnsafe(portId, message, transfer))

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

        function onMessage(portId: number) {
          return function(event: MessageEvent) {
            const message = event.data as WorkerRunner.PlatformMessage<I>
            if (message[0] === 0) {
              const result = handler(portId, message[1])
              if (Effect.isEffect(result)) {
                const fiber = runFork(result)
                fiber.addObserver(onExit)
                trackFiber(fiber)
              }
            } else {
              const port = ports.get(portId)
              if (!port) {
                return
              } else if (ports.size === 1) {
                // let the last port close with the outer scope
                return Deferred.doneUnsafe(closeLatch, Exit.void)
              }
              ports.delete(portId)
              Effect.runFork(Scope.close(port[1], Exit.void))
            }
          }
        }
        function onMessageError(error: MessageEvent) {
          Deferred.doneUnsafe(
            closeLatch,
            new WorkerError({
              reason: "Receive",
              message: "An messageerror event was emitted",
              cause: error.data
            }).asEffect()
          )
        }
        function onError(error: any) {
          Deferred.doneUnsafe(
            closeLatch,
            new WorkerError({
              reason: "Receive",
              message: "An error event was emitted",
              cause: error.data
            }).asEffect()
          )
        }
        function handlePort(port: MessagePort) {
          const fiber = Scope.fork(scope).pipe(
            Effect.flatMap((scope) => {
              const portId = currentPortId++
              ports.set(portId, [port, scope])
              const onMsg = onMessage(portId)
              port.addEventListener("message", onMsg)
              port.addEventListener("messageerror", onMessageError)
              if ("start" in port) {
                port.start()
              }
              port.postMessage([0])
              return Scope.addFinalizer(
                scope,
                Effect.sync(() => {
                  port.removeEventListener("message", onMsg)
                  port.removeEventListener("messageerror", onError)
                  port.close()
                })
              )
            }),
            runFork
          )
          fiber.addObserver(onExit)
          trackFiber(fiber)
        }
        self.addEventListener("error", onError)
        let prevOnConnect: unknown | undefined
        if ("onconnect" in self) {
          prevOnConnect = self.onconnect
          self.onconnect = function(event: MessageEvent) {
            const port = (event as MessageEvent).ports[0]
            handlePort(port)
          }
          for (const port of cachedPorts) {
            handlePort(port)
          }
          cachedPorts.clear()
          yield* Scope.addFinalizer(
            scope,
            Effect.sync(() => self.close())
          )
        } else {
          handlePort(self as any)
        }
        yield* Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            self.removeEventListener("error", onError)
            if ("onconnect" in self) {
              self.onconnect = prevOnConnect
            }
          })
        )
      }))

    return identity<WorkerRunner.WorkerRunner<O, I>>({ run, send, sendUnsafe, disconnects })
  }) as any
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<WorkerRunner.WorkerRunnerPlatform> = Layer.sync(WorkerRunner.WorkerRunnerPlatform)(() =>
  make(self)
)

/**
 * @since 1.0.0
 * @category layers
 */
export const layerMessagePort = (port: MessagePort | Window): Layer.Layer<WorkerRunner.WorkerRunnerPlatform> =>
  Layer.succeed(WorkerRunner.WorkerRunnerPlatform)(make(port))
