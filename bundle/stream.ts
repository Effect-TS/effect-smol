import * as Effect from "#dist/effect/Effect"
import * as Stream from "#dist/effect/stream/Stream"

Stream.range(1, 100_000).pipe(
  Stream.runDrain,
  Effect.runSync
)
