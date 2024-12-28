import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as Request from "effect/Request"
import * as Resolver from "effect/RequestResolver"

class GetNameById extends Request.TaggedClass("GetNameById")<string, string, {
  readonly id: number
}> {}

const UserResolver = Resolver.make((requests: Array.NonEmptyArray<GetNameById>) =>
  Effect.forEach(requests, (request) => Request.succeed(request, `User ${request.id}`), { discard: true })
)

const effect = Effect.forEach(Array.range(1, 1000), (id) => Effect.request(new GetNameById({ id }), UserResolver), {
  concurrency: "unbounded"
})

for (let i = 0; i < 10; i++) {
  Effect.runSync(effect)
}

console.time("smol batching")
for (let i = 0; i < 100; i++) {
  Effect.runSync(effect)
}
console.timeEnd("smol batching")
