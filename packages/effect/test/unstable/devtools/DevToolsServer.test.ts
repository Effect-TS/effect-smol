import { assert, describe, it } from "@effect/vitest"
import { Deferred, Effect, Option, Queue, Schema, Stream } from "effect"
import * as DevToolsSchema from "effect/unstable/devtools/DevToolsSchema"
import * as DevToolsServer from "effect/unstable/devtools/DevToolsServer"
import * as Ndjson from "effect/unstable/encoding/Ndjson"
import * as Socket from "effect/unstable/socket/Socket"
import * as SocketServer from "effect/unstable/socket/SocketServer"

const RequestSchema = Schema.toCodecJson(DevToolsSchema.Request)
const ResponseSchema = Schema.toCodecJson(DevToolsSchema.Response)

const makeSocketPair = Effect.gen(function*() {
  const clientIncoming = yield* Queue.unbounded<string | Uint8Array>()
  const serverIncoming = yield* Queue.unbounded<string | Uint8Array>()

  const makeSocket = (
    incoming: Queue.Dequeue<string | Uint8Array>,
    outgoing: Queue.Enqueue<string | Uint8Array>
  ): Socket.Socket => {
    const runRaw: Socket.Socket["runRaw"] = (handler, options) =>
      Effect.gen(function*() {
        if (options?.onOpen) {
          yield* options.onOpen
        }
        while (true) {
          const data = yield* Queue.take(incoming)
          const result = handler(data)
          if (Effect.isEffect(result)) {
            yield* result
          }
        }
      }).pipe(Effect.catchCause(() => Effect.void))

    const run: Socket.Socket["run"] = (handler, options) => {
      const encoder = new TextEncoder()
      return runRaw((data) => typeof data === "string" ? handler(encoder.encode(data)) : handler(data), options)
    }

    const writer = Effect.succeed((chunk: Uint8Array | string | Socket.CloseEvent) =>
      Socket.isCloseEvent(chunk) ? Effect.void : Queue.offer(outgoing, chunk).pipe(Effect.asVoid)
    )

    return Socket.Socket.of({
      [Socket.TypeId]: Socket.TypeId,
      run,
      runRaw,
      writer
    })
  }

  return {
    client: makeSocket(clientIncoming, serverIncoming),
    server: makeSocket(serverIncoming, clientIncoming)
  }
})

describe("DevToolsServer", () => {
  it.effect("responds to ping and enqueues requests", () =>
    Effect.gen(function*() {
      const { client, server } = yield* makeSocketPair
      const requestDeferred = yield* Deferred.make<DevToolsSchema.Request.WithoutPing>()

      const serverLayer = SocketServer.SocketServer.of({
        address: {
          _tag: "TcpAddress",
          hostname: "localhost",
          port: 0
        },
        run: (handler) =>
          handler(server).pipe(
            Effect.mapError((cause) =>
              new SocketServer.SocketServerError({
                reason: new SocketServer.SocketServerUnknownError({ cause })
              })
            ),
            Effect.andThen(Effect.never)
          )
      })

      yield* DevToolsServer.run((clientConnection) =>
        Queue.take(clientConnection.queue).pipe(
          Effect.flatMap((request) => Deferred.succeed(requestDeferred, request))
        )
      ).pipe(
        Effect.provideService(SocketServer.SocketServer, serverLayer),
        Effect.forkScoped
      )

      const responses = yield* Queue.unbounded<DevToolsSchema.Response>()
      const requests = yield* Queue.unbounded<DevToolsSchema.Request>()

      yield* Stream.fromQueue(requests).pipe(
        Stream.pipeThroughChannel(
          Ndjson.duplexSchemaString(Socket.toChannelString(client), {
            inputSchema: RequestSchema,
            outputSchema: ResponseSchema
          })
        ),
        Stream.runForEach((response) => Queue.offer(responses, response).pipe(Effect.asVoid)),
        Effect.forkScoped
      )

      const span: DevToolsSchema.Span = {
        _tag: "Span",
        spanId: "span-1",
        traceId: "trace-1",
        name: "test-span",
        sampled: true,
        attributes: new Map(),
        status: {
          _tag: "Started",
          startTime: 10n
        },
        parent: Option.none()
      }

      yield* Queue.offer(requests, { _tag: "Ping" })
      yield* Queue.offer(requests, span)

      const pong = yield* Queue.take(responses)
      assert.strictEqual(pong._tag, "Pong")

      const queued = yield* Deferred.await(requestDeferred)
      if (queued._tag !== "Span") {
        assert.fail(`Expected Span, got ${queued._tag}`)
      }
      assert.strictEqual(queued.spanId, span.spanId)
    }))
})
