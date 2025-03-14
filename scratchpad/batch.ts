import * as Array from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Request from "effect/Request"
import * as Resolver from "effect/RequestResolver"

class GetNameById extends Request.TaggedClass("GetNameById")<{
  readonly id: number
}, string> {}

const UserResolver = Resolver.make<GetNameById>((entries) =>
  Effect.sync(() => {
    for (const entry of entries) {
      entry.unsafeComplete(Effect.succeed(`User ${entry.request.id}`))
    }
  })
)

const effect = Effect.forEach(
  Array.range(1, 100_000),
  (id) => Effect.request(new GetNameById({ id }), UserResolver),
  { concurrency: "unbounded" }
)

Effect.gen(function*() {
  let count = 0
  let totalTime = 0
  yield* Effect.addFinalizer(() => Effect.log(`batching: ${Math.round(totalTime / count)}ms (average)`))
  while (true) {
    const start = yield* DateTime.now
    yield* effect
    const end = yield* DateTime.now
    const time = end.epochMillis - start.epochMillis
    count++
    totalTime += time
    yield* Effect.log(`batching: ${time}ms`)
    yield* Effect.yieldNow
  }
}).pipe(
  Effect.scoped,
  Effect.timeout("5 seconds"),
  Effect.runFork
)
