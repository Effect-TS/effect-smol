import * as Cache from "#dist/effect/caching/Cache"
import * as Effect from "#dist/effect/Effect"

Cache.make({
  capacity: 1024,
  lookup: (key: string) => Effect.succeed(key)
}).pipe(
  Effect.flatMap(Cache.get("1")),
  Effect.runFork
)
