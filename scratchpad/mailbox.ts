import * as Effect from "effect/Effect"
import * as Mailbox from "effect/Mailbox"

const program = Effect.gen(function*() {
  while (true) {
    const queue = yield* Mailbox.make<number>()

    yield* Mailbox.offerAll(queue, Array.from({ length: 1_000_000 }, (_, i) => i))
    yield* Mailbox.end(queue)

    console.time("Mailbox.take")
    yield* Effect.ignore(Effect.forever(Mailbox.take(queue), { autoYield: false }))
    console.timeEnd("Mailbox.take")
  }
})

Effect.runFork(program)
