import * as Effect from "effect/Effect"
import * as Queue from "effect/Queue"

const program = Effect.gen(function*() {
  while (true) {
    const queue = yield* Queue.make<number>()

    console.time("Queue.offer")
    yield* Queue.offerAll(queue, Array.from({ length: 1_000_000 }, (_, i) => i))
    yield* Queue.end(queue)
    console.timeEnd("Queue.offer")

    console.time("Queue.take")
    yield* Effect.ignore(Effect.forever(Queue.take(queue), { autoYield: false }))
    console.timeEnd("Queue.take")
  }
})

Effect.runFork(program)
