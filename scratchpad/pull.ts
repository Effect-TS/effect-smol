import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"
import * as Queue from "effect/Queue"

const abc = Channel.async<string>(
  Effect.fnUntraced(function*(queue) {
    yield* Effect.addFinalizer(() => Effect.sync(() => console.log("finalizer")))
    Queue.unsafeOffer(queue, "a")
    Queue.unsafeOffer(queue, "b")
    Queue.unsafeOffer(queue, "c")
    Queue.unsafeEnd(queue)
  })
)

const merged = Channel.mergeAll(
  Channel.fromIterable([abc, abc, abc, abc, abc]),
  { concurrency: 2 }
)

Effect.gen(function*() {
  const pull = yield* Channel.toPull(merged)
  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  console.log(yield* pull)
  console.log(yield* pull)
  console.log(yield* pull)

  yield* pull.pipe(
    Effect.catch((error) => Effect.sync(() => console.log("error", error)))
  )
}).pipe(Effect.scoped, Effect.runPromise)
