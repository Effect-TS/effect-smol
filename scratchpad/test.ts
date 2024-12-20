import * as Arr from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

console.time("smol")
Channel.fromIterable(Arr.range(1, 10_000)).pipe(
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded" }),
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded" }),
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded" }),
  Channel.runDrain,
  Effect.runSync
)
console.timeEnd("smol")
