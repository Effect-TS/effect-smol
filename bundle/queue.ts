import * as Effect from "#dist/effect/Effect"
import * as Queue from "#dist/effect/Queue"

const program = Effect.gen(function*() {
  const queue = yield* Queue.make<number>()

  yield* Effect.gen(function*() {
    yield* Queue.takeN(queue, 3)
  }).pipe(Effect.forever, Effect.fork)

  yield* Queue.offerAll(queue, [1, 2])
  yield* Queue.offerAll(queue, [3, 4]).pipe(Effect.delay("100 millis"), Effect.fork)
  yield* Queue.offerAll(queue, [5, 6, 7, 8]).pipe(Effect.delay("200 millis"), Effect.fork)

  yield* Effect.sleep("500 millis")
})

Effect.runFork(Effect.scoped(program))