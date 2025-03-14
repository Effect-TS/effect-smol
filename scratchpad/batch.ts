import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import * as References from "effect/References"
import * as Request from "effect/Request"
import * as Resolver from "effect/RequestResolver"
import { bench } from "./bench.js"

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

effect.pipe(
  bench("batching", 100),
  Effect.provideService(References.MinimumLogLevel, "Debug"),
  Effect.runFork
)
