/**
 * @since 1.0.0
 */
import type { Cause } from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberSet from "effect/FiberSet"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as References from "effect/References"
import * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Socket from "effect/unstable/socket/Socket"
import * as SocketServer from "effect/unstable/socket/SocketServer"
import type * as Http from "node:http"
import * as Net from "node:net"
import * as NodeSocket from "./NodeSocket.ts"
import { NodeWS } from "./NodeSocket.ts"

/**
 * @since 1.0.0
 * @category tags
 */
export class IncomingMessage extends ServiceMap.Key<
  IncomingMessage,
  Http.IncomingMessage
>()("@effect/platform-node-shared/NodeSocketServer/IncomingMessage") {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*(
  options: Net.ServerOpts & Net.ListenOptions
) {
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => Net.createServer(options)),
    (server) =>
      Effect.callback<void>((resume) => {
        server.close(() => resume(Effect.void))
      })
  )

  yield* Effect.callback<void, SocketServer.SocketServerError>((resume) => {
    server.once("error", (cause) => {
      resume(Effect.fail(
        new SocketServer.SocketServerError({
          reason: "Open",
          cause
        })
      ))
    })
    server.listen(options, () => {
      resume(Effect.void)
    })
  })

  const run = Effect.fnUntraced(function*<R, E, _>(handler: (socket: Socket.Socket) => Effect.Effect<_, E, R>) {
    const scope = yield* Scope.make()
    const fiberSet = yield* FiberSet.make().pipe(
      Scope.provide(scope)
    )
    const run = yield* FiberSet.runtime(fiberSet)<R>()
    function onConnection(conn: Net.Socket) {
      pipe(
        NodeSocket.fromDuplex(
          Effect.acquireRelease(
            Effect.succeed(conn),
            (conn) =>
              Effect.sync(() => {
                if (conn.closed === false) {
                  conn.destroySoon()
                }
              })
          )
        ),
        Effect.flatMap(handler),
        Effect.catchCause(reportUnhandledError),
        Effect.provideService(NodeSocket.NetSocket, conn),
        run
      )
    }
    return yield* Effect.callback<never>((_resume) => {
      server.on("connection", onConnection)
      return Effect.sync(() => {
        server.off("connection", onConnection)
      })
    }).pipe(
      Effect.ensuring(Scope.close(scope, Exit.void))
    )
  })

  const address = server.address()!
  return SocketServer.SocketServer.of({
    address: typeof address === "string" ?
      {
        _tag: "UnixAddress",
        path: address
      } :
      {
        _tag: "TcpAddress",
        hostname: address.address,
        port: address.port
      },
    run
  })
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: (
  options: Net.ServerOpts & Net.ListenOptions
) => Layer.Layer<
  SocketServer.SocketServer,
  SocketServer.SocketServerError
> = Layer.effect(SocketServer.SocketServer)(make)

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeWebSocket: (
  options: NodeWS.ServerOptions<typeof NodeWS.WebSocket, typeof Http.IncomingMessage>
) => Effect.Effect<
  SocketServer.SocketServer["Service"],
  SocketServer.SocketServerError,
  Scope.Scope
> = Effect.fnUntraced(function*(
  options: NodeWS.ServerOptions
) {
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => new NodeWS.WebSocketServer(options)),
    (server) =>
      Effect.callback<void>((resume) => {
        server.close(() => resume(Effect.void))
      })
  )

  yield* Effect.callback<void, SocketServer.SocketServerError>((resume) => {
    server.once("error", (error) => {
      resume(Effect.fail(
        new SocketServer.SocketServerError({
          reason: "Open",
          cause: error
        })
      ))
    })
    server.once("listening", () => {
      resume(Effect.void)
    })
  })

  const run = Effect.fnUntraced(function*<R, E, _>(handler: (socket: Socket.Socket) => Effect.Effect<_, E, R>) {
    const scope = yield* Scope.make()
    const fiberSet = yield* FiberSet.make().pipe(
      Scope.provide(scope)
    )
    const run = yield* FiberSet.runtime(fiberSet)<R>()
    function onConnection(conn: Net.Socket, req: Http.IncomingMessage) {
      pipe(
        Socket.fromWebSocket(
          Effect.acquireRelease(
            Effect.succeed(conn as unknown as globalThis.WebSocket),
            (conn) =>
              Effect.sync(() => {
                conn.close()
              })
          )
        ),
        Effect.flatMap(handler),
        Effect.catchCause(reportUnhandledError),
        Effect.provideService(Socket.WebSocket, conn as any),
        Effect.provideService(IncomingMessage, req),
        run
      )
    }
    return yield* Effect.callback<never>((_resume) => {
      server.on("connection", onConnection)
      return Effect.sync(() => {
        server.off("connection", onConnection)
      })
    }).pipe(
      Effect.ensuring(Scope.close(scope, Exit.void))
    )
  })

  const address = server.address()!
  return SocketServer.SocketServer.of({
    address: typeof address === "string" ?
      {
        _tag: "UnixAddress",
        path: address
      } :
      {
        _tag: "TcpAddress",
        hostname: address.address,
        port: address.port
      },
    run
  })
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layerWebSocket: (
  options: NodeSocket.NodeWS.ServerOptions<typeof NodeSocket.NodeWS.WebSocket, typeof Http.IncomingMessage>
) => Layer.Layer<
  SocketServer.SocketServer,
  SocketServer.SocketServerError
> = Layer.effect(SocketServer.SocketServer)(makeWebSocket)

const reportUnhandledError = <E>(cause: Cause<E>) =>
  Effect.withFiber<void>((fiber) => {
    const unhandledLogLevel = fiber.getRef(References.UnhandledLogLevel)
    if (unhandledLogLevel) {
      return Effect.logWithLevel(unhandledLogLevel)(cause, "Unhandled error in SocketServer")
    }
    return Effect.void
  })
