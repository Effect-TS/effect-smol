import { Array, Effect, Stream } from "effect"

const stream = Stream.fromIterable(Array.range(0, 100_000)).pipe(
  Stream.mapEffect((n) => Effect.succeed(n + 1), { concurrency: 10 })
)

console.time("Stream.mapEffect")
Effect.runSync(Stream.runCount(stream))
console.timeEnd("Stream.mapEffect")
