import { assert, describe, it } from "@effect/vitest"
import { Deferred, Effect, Option, Queue, Schema } from "effect"
import { Rpc, RpcClient, RpcGroup, RpcServer } from "effect/unstable/rpc"
import type { FromClientEncoded, FromServerEncoded } from "effect/unstable/rpc/RpcMessage"

const ParseOptionsGroup = RpcGroup.make(
  Rpc.make("Ping", {
    payload: Schema.Struct({
      value: Schema.String
    }),
    success: Schema.String,
    defect: Schema.String
  })
)

describe("Rpc parseOptions", () => {
  it.effect("RpcClient.make forwards only parseOptions concurrency", () =>
    Effect.gen(function*() {
      const sent = yield* Deferred.make<FromClientEncoded>()
      const parseOptionsWithExcessProperty = {
        concurrency: "unbounded" as const,
        onExcessProperty: "error" as const
      }
      const client = yield* RpcClient.make(ParseOptionsGroup, {
        parseOptions: parseOptionsWithExcessProperty
      }).pipe(
        Effect.provideService(
          RpcClient.Protocol,
          RpcClient.Protocol.of({
            run: () => Effect.never,
            send: (_clientId, request) => Deferred.succeed(sent, request),
            supportsAck: true,
            supportsTransferables: false
          })
        )
      )
      const payloadWithExcessProperty = { value: "ok", extra: "x" }
      const exit = yield* Effect.exit(client.Ping(payloadWithExcessProperty, { discard: true }))
      assert.strictEqual(exit._tag, "Success")
      const request = yield* Deferred.await(sent)
      assert.strictEqual(request._tag, "Request")
      assert.strictEqual(Object.hasOwn(request.payload, "extra"), false)
    }).pipe(Effect.scoped))

  it.effect("RpcServer.make forwards only parseOptions concurrency", () =>
    Effect.gen(function*() {
      const sent = yield* Deferred.make<FromServerEncoded>()
      const disconnects = yield* Queue.unbounded<number>()
      const parseOptionsWithExcessProperty = {
        concurrency: "unbounded" as const,
        onExcessProperty: "error" as const
      }

      const request = {
        _tag: "Request",
        id: "1",
        tag: "Ping",
        payload: { value: "ok", extra: "x" },
        headers: []
      } as const

      const server = RpcServer.make(ParseOptionsGroup, {
        parseOptions: parseOptionsWithExcessProperty
      }).pipe(
        Effect.provideService(
          RpcServer.Protocol,
          RpcServer.Protocol.of({
            run: (f) => Effect.andThen(f(0, request), Effect.never),
            disconnects,
            send: (_clientId, response) => Deferred.succeed(sent, response),
            end: () => Effect.void,
            clientIds: Effect.succeed(new Set()),
            initialMessage: Effect.succeed(Option.none()),
            supportsAck: true,
            supportsTransferables: false,
            supportsSpanPropagation: true
          })
        ),
        Effect.provide(ParseOptionsGroup.toLayerHandler("Ping", () => Effect.succeed("ok"))),
        Effect.forkScoped
      )
      yield* server

      const response = yield* Effect.raceFirst(
        Deferred.await(sent),
        Effect.fail("Timed out waiting for RPC response").pipe(Effect.delay("1 second"))
      )
      if (response._tag !== "Exit") {
        assert.fail(`Expected Exit response, got ${response._tag}`)
      }
      assert.deepStrictEqual(response.exit, { _tag: "Success", value: "ok" })
    }).pipe(Effect.scoped))
})
