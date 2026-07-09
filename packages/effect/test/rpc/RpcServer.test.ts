import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Fiber, Latch, Option, Queue, Schema } from "effect"
import { Headers } from "effect/unstable/http"
import { Rpc, RpcGroup, RpcServer } from "effect/unstable/rpc"
import type { FromServer } from "effect/unstable/rpc/RpcMessage"
import { RequestId } from "effect/unstable/rpc/RpcMessage"

const TestRpc = Rpc.make("RpcServerTest", { success: Schema.String })
const TestGroup = RpcGroup.make(TestRpc)

const request = {
  _tag: "Request" as const,
  id: RequestId("1"),
  tag: TestRpc._tag,
  payload: undefined,
  headers: Headers.empty
}

describe("RpcServer", () => {
  it.effect("write remains fire-and-forget", () => {
    const started = Latch.makeUnsafe()
    const release = Latch.makeUnsafe()
    const HandlersLive = TestGroup.toLayer({
      RpcServerTest: () => Effect.andThen(started.open, release.await).pipe(Effect.as("done"))
    })

    return Effect.scoped(
      Effect.gen(function*() {
        const responses = yield* Queue.unbounded<FromServer<typeof TestRpc>>()
        const server = yield* RpcServer.makeNoSerialization(TestGroup, {
          onFromServer: (response) => Queue.offer(responses, response)
        })
        const delivery = yield* server.write(1, request).pipe(Effect.forkChild({ startImmediately: true }))

        yield* started.await
        assert.isDefined(delivery.pollUnsafe())
        assert(Option.isNone(yield* Queue.poll(responses)))

        yield* release.open
        const response = yield* Queue.take(responses)
        assert(response._tag === "Exit")
        assert.deepStrictEqual(response.exit, Exit.succeed("done"))
      })
    ).pipe(Effect.provide(HandlersLive))
  })

  it.effect("writeAndAwaitCompletion waits for the terminal response", () => {
    const started = Latch.makeUnsafe()
    const release = Latch.makeUnsafe()
    const HandlersLive = TestGroup.toLayer({
      RpcServerTest: () => Effect.andThen(started.open, release.await).pipe(Effect.as("done"))
    })

    return Effect.scoped(
      Effect.gen(function*() {
        const responses = yield* Queue.unbounded<FromServer<typeof TestRpc>>()
        const server = yield* RpcServer.makeNoSerialization(TestGroup, {
          onFromServer: (response) => Queue.offer(responses, response)
        })
        const delivery = yield* server.writeAndAwaitCompletion(1, request).pipe(
          Effect.forkChild({ startImmediately: true })
        )

        yield* started.await
        assert.isUndefined(delivery.pollUnsafe())

        yield* release.open
        yield* Fiber.join(delivery)
        const response = yield* Queue.take(responses)
        assert(response._tag === "Exit")
        assert.deepStrictEqual(response.exit, Exit.succeed("done"))
      })
    ).pipe(Effect.provide(HandlersLive))
  })

  it.effect("writeAndAwaitCompletion interrupts the request handler", () => {
    const started = Latch.makeUnsafe()
    const interrupted = Latch.makeUnsafe()
    const HandlersLive = TestGroup.toLayer({
      RpcServerTest: () =>
        Effect.andThen(started.open, Effect.never).pipe(
          Effect.onInterrupt(() => interrupted.open)
        )
    })

    return Effect.scoped(
      Effect.gen(function*() {
        const responses = yield* Queue.unbounded<FromServer<typeof TestRpc>>()
        const server = yield* RpcServer.makeNoSerialization(TestGroup, {
          onFromServer: (response) => Queue.offer(responses, response)
        })
        const delivery = yield* server.writeAndAwaitCompletion(1, request).pipe(
          Effect.forkChild({ startImmediately: true })
        )

        yield* started.await
        yield* Fiber.interrupt(delivery)

        assert(Exit.hasInterrupts(delivery.pollUnsafe()!))
        assert.isTrue(interrupted.isOpen())
        const response = yield* Queue.take(responses)
        assert(response._tag === "Exit")
        assert(Exit.hasInterrupts(response.exit))
      })
    ).pipe(Effect.provide(HandlersLive))
  })
})
