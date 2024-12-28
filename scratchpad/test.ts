import * as Arr from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const channel = Channel.fromIterable(Arr.range(1, 10_000)).pipe(
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true }),
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true }),
  Channel.mapEffect((i) => Effect.succeed(i + 1), { concurrency: "unbounded", unordered: true })
)

Channel.runDrain(channel).pipe(Effect.runSync)

console.time("smol")
channel.pipe(
  Channel.runDrain,
  Effect.runSync
)
console.timeEnd("smol")
