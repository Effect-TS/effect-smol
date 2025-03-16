import * as Array from "effect/Array"
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

const getUserById = (id: number) => Effect.request(new GetNameById({ id }), UserResolver)

const program = Effect.gen(function*() {
  const result = yield* Effect.forEach(
    Array.range(1, 100_000),
    (id) => getUserById(id),
    { concurrency: "unbounded" }
  )

  yield* Effect.log(`Result: ${result.length}`)
})

Effect.runFork(program)
