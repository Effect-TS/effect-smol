/**
 * @since 1.0.0
 */
import type { Array } from "effect/collections"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import type * as Exit from "effect/Exit"
import * as FiberSet from "effect/FiberSet"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Channel from "effect/stream/Channel"
import * as Socket from "effect/unstable/socket/Socket"
import * as Net from "node:net"
import type { Duplex } from "node:stream"

/**
 * @since 1.0.0
 * @category re-exports
 */
export * as NodeWS from "ws"

/**
 * @since 1.0.0
 * @category tags
 */
export class NetSocket extends ServiceMap.Key<NetSocket, Net.Socket>()("@effect/platform-node/NodeSocket/NetSocket") {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeNet = (
  options: Net.NetConnectOpts & {
    readonly forwardErrorsToWrite?: boolean | undefined
  }
): Effect.Effect<Socket.Socket, Socket.SocketError> =>
  fromDuplex(
    Effect.acquireRelease(
      Effect.callback<Net.Socket, Socket.SocketError, never>((resume) => {
        const conn = Net.createConnection(options)
        conn.on("connect", () => {
          conn.removeAllListeners()
          resume(Effect.succeed(conn))
        })
        conn.on("error", (cause) => {
          conn.removeAllListeners()
          resume(Effect.fail(new Socket.SocketGenericError({ reason: "Open", cause })))
        })
        return Effect.sync(() => {
          conn.destroy()
        })
      }),
      (conn) =>
        Effect.sync(() => {
          if (conn.closed === false) {
            if ("destroySoon" in conn) {
              conn.destroySoon()
            } else {
              ;(conn as Net.Socket).destroy()
            }
          }
          conn.removeAllListeners()
        })
    ),
    options
  )

/**
 * @since 1.0.0
 * @category constructors
 */
export const fromDuplex = <RO>(
  open: Effect.Effect<Duplex, Socket.SocketError, RO>,
  options?: {
    readonly forwardErrorsToWrite?: boolean | undefined
  }
): Effect.Effect<Socket.Socket, never, Exclude<RO, Scope.Scope>> =>
  Effect.withFiber<Socket.Socket, never, Exclude<RO, Scope.Scope>>((fiber) => {
    let currentSocket: Duplex | undefined
    const latch = Effect.makeLatchUnsafe(false)
    const openServices = fiber.services as ServiceMap.ServiceMap<RO>

    const forwardErrorsToWrite = options?.forwardErrorsToWrite ?? false
    let currentErrorExit: Exit.Exit<never, Socket.SocketError> | undefined

    const run = <R, E, _>(handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void) =>
      Effect.scopedWith(Effect.fnUntraced(function*(scope) {
        const fiberSet = yield* FiberSet.make<any, E | Socket.SocketError>().pipe(
          Scope.provide(scope)
        )
        const conn = yield* Scope.provide(open, scope)
        const run = yield* Effect.provideService(FiberSet.runtime(fiberSet)<R>(), NetSocket, conn as Net.Socket)

        function onData(chunk: Uint8Array) {
          const result = handler(chunk)
          if (Effect.isEffect(result)) {
            run(result)
          }
        }
        function onEnd() {
          Deferred.doneUnsafe(fiberSet.deferred, Effect.void)
        }
        function onError(cause: Error) {
          Deferred.doneUnsafe(
            fiberSet.deferred,
            Effect.fail(new Socket.SocketGenericError({ reason: "Read", cause }))
          )
        }
        function onClose(hadError: boolean) {
          Deferred.doneUnsafe(
            fiberSet.deferred,
            Effect.fail(new Socket.SocketCloseError({ code: hadError ? 1006 : 1000 }))
          )
        }
        yield* Scope.addFinalizer(
          scope,
          Effect.sync(() => {
            conn.off("data", onData)
            conn.off("end", onEnd)
            conn.off("error", onError)
            conn.off("close", onClose)
          })
        )
        conn.on("data", onData)
        conn.on("end", onEnd)
        conn.on("error", onError)
        conn.on("close", onClose)

        currentSocket = conn
        currentErrorExit = undefined
        latch.openUnsafe()

        return yield* FiberSet.join(fiberSet)
      })).pipe(
        Effect.updateServices((input: ServiceMap.ServiceMap<R>) => ServiceMap.merge(openServices, input)),
        Effect.onExit((exit) => {
          if (forwardErrorsToWrite && exit._tag === "Failure") {
            currentErrorExit = exit as any
          } else {
            latch.closeUnsafe()
          }
          currentSocket = undefined
        })
      )

    const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
      latch.whenOpen(Effect.callback<void, Socket.SocketError>((resume) => {
        if (currentErrorExit) {
          return resume(currentErrorExit)
        }
        const conn = currentSocket!
        if (Socket.isCloseEvent(chunk)) {
          conn.destroy(chunk.code > 1000 ? new Error(`closed with code ${chunk.code}`) : undefined)
          return resume(Effect.void)
        }
        currentSocket!.write(chunk, (cause) => {
          resume(
            cause
              ? Effect.fail(new Socket.SocketGenericError({ reason: "Write", cause }))
              : Effect.void
          )
        })
      }))

    const writer = Effect.acquireRelease(
      Effect.succeed(write),
      () =>
        Effect.sync(() => {
          if (!currentSocket || currentSocket.writableEnded) return
          currentSocket.end()
        })
    )

    return Effect.succeed(Socket.Socket.of({
      [Socket.TypeId]: Socket.TypeId,
      run,
      runRaw: run,
      writer
    }))
  })

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeNetChannel = <IE = never>(
  options: Net.NetConnectOpts
): Channel.Channel<
  Array.NonEmptyReadonlyArray<Uint8Array>,
  Socket.SocketError | IE,
  void,
  Array.NonEmptyReadonlyArray<Uint8Array | string | Socket.CloseEvent>,
  IE
> =>
  Channel.unwrap(
    Effect.map(makeNet(options), Socket.toChannelWith<IE>())
  )

/**
 * @since 1.0.0
 * @category layers
 */
export const layerNet: (options: Net.NetConnectOpts) => Layer.Layer<
  Socket.Socket,
  Socket.SocketError
> = Layer.effect(Socket.Socket)(makeNet)
