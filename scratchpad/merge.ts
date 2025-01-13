import * as Arr from "effect/Array"
import * as Channel from "effect/Channel"
import * as Effect from "effect/Effect"

const a = Channel.fromIterable(Arr.makeBy(10_000, (_) => "a"))
const b = Channel.fromIterable(Arr.makeBy(10_000, (_) => "b"))

const ab = Channel.merge(a, b)

ab.pipe(
  Channel.runDrain,
  Effect.runSync
)

console.time("smol merge")
ab.pipe(
  Channel.runDrain,
  Effect.runSync
)
console.timeEnd("smol merge")
