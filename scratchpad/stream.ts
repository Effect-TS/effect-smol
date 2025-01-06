import * as Effect from "../dist/Effect"
import * as Stream from "../dist/Stream"

Stream.range(1, 100_000).pipe(
  Stream.runDrain,
  Effect.runSync
)
