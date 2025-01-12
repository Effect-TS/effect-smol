import * as Effect from "#dist/Effect"
import * as Mailbox from "#dist/Mailbox"

const program = Effect.gen(function*() {
  const queue = yield* Mailbox.make<number>()

  yield* Effect.gen(function*() {
    yield* queue.takeN(3)
  }).pipe(Effect.forever, Effect.forkScoped)

  yield* queue.offerAll([1, 2])
  yield* queue.offerAll([3, 4]).pipe(Effect.delay("100 millis"), Effect.forkScoped)
  yield* queue.offerAll([5, 6, 7, 8]).pipe(Effect.delay("200 millis"), Effect.forkScoped)

  yield* Effect.sleep("500 millis")
})

Effect.runFork(Effect.scoped(program))
