import { assert, describe, it } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import { RpcServer, RpcWorker } from "effect/unstable/rpc"

const InitialPayload = Schema.Struct({
  workerId: Schema.String,
  count: Schema.Number
})

const makeProtocolLayer = (
  encodedInitialMessage: Option.Option<unknown>
): Layer.Layer<RpcServer.Protocol> =>
  Layer.effect(RpcServer.Protocol)(
    Effect.gen(function*() {
      const disconnects = yield* Queue.unbounded<number>()
      return RpcServer.Protocol.of({
        run: () => Effect.never,
        disconnects,
        send: () => Effect.void,
        end: () => Effect.void,
        clientIds: Effect.succeed(new Set<number>()),
        initialMessage: Effect.succeed(encodedInitialMessage),
        supportsAck: false,
        supportsTransferables: false,
        supportsSpanPropagation: false
      })
    })
  )

describe("RpcWorker", () => {
  describe("initialMessage", () => {
    it.effect("decodes the encoded initial message produced by the provided Protocol", () =>
      Effect.gen(function*() {
        const encoded = { workerId: "alpha", count: 7 }
        const decoded = yield* RpcWorker.initialMessage(InitialPayload)
        assert.deepStrictEqual(decoded, { workerId: "alpha", count: 7 })
        return encoded
      }).pipe(
        Effect.provide(makeProtocolLayer(Option.some({ workerId: "alpha", count: 7 })))
      ))

    it.effect("fails with NoSuchElementError when the Protocol has no initial message", () =>
      Effect.gen(function*() {
        const exit = yield* Effect.exit(RpcWorker.initialMessage(InitialPayload))
        assert.isTrue(Exit.isFailure(exit))
        if (Exit.isFailure(exit)) {
          const error = Cause.squash(exit.cause)
          assert.isTrue(Cause.isNoSuchElementError(error))
        }
      }).pipe(
        Effect.provide(makeProtocolLayer(Option.none()))
      ))
  })
})
