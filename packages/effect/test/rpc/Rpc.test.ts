import { assert, describe, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { Headers } from "effect/unstable/http"
import { Rpc, RpcGroup } from "effect/unstable/rpc"
import { RequestId } from "effect/unstable/rpc/RpcMessage"

const TestGroup = RpcGroup.make(
  Rpc.make("one"),
  Rpc.make("two", {
    success: Schema.String
  })
)

describe("Rpc", () => {
  it.effect("can implement a single handler", () =>
    Effect.gen(function*() {
      const TwoHandler = TestGroup.toLayerHandler("two", () => Effect.succeed("two"))
      const handler = yield* TestGroup.accessHandler("two").pipe(
        Effect.provide(TwoHandler)
      )
      const result = yield* handler(void 0, {
        clientId: 1,
        requestId: RequestId(1n),
        headers: Headers.empty
      })
      assert.strictEqual(result, "two")
    }))
})
