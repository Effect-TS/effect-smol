import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { HttpEffect } from "effect/unstable/http"
import { Rpc, RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc"

const TestGroup = RpcGroup.make(
  Rpc.make("Ping", { success: Schema.String })
)

describe("RpcServer", () => {
  it.effect("toHttpEffect keeps non-framed json-rpc server alive outside construction scope", () =>
    Effect.gen(function*() {
      const httpEffect = yield* RpcServer.toHttpEffect(TestGroup).pipe(
        Effect.provide(TestGroup.toLayer({
          Ping: () => Effect.succeed("pong")
        })),
        Effect.provideService(RpcSerialization.RpcSerialization, RpcSerialization.jsonRpc()),
        Effect.scoped
      )

      const handler = HttpEffect.toWebHandler(httpEffect)
      const response = yield* Effect.promise(() =>
        handler(
          new Request("http://localhost/rpc", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "Ping"
            })
          })
        )
      )

      assert.strictEqual(response.status, 200)
      assert.deepStrictEqual(yield* Effect.promise(() => response.json()), {
        jsonrpc: "2.0",
        id: 1,
        result: "pong"
      })
    }).pipe(Effect.timeout("2 seconds")))
})
