import { ServiceMap, Effect } from "effect"

class FeatureFlag extends ServiceMap.Reference("FeatureFlag", {
  defaultValue: () => false
}) {}

const program = Effect.gen(function*() {
  if (yield* FeatureFlag) {
    yield* Effect.log("Feature Flag enabled")
  } else {
    yield* Effect.log("Feature Flag disabled")
  }
})

const runnable = Effect.gen(function*() {
  yield* Effect.log("Run with default:")
  yield* program
  yield* Effect.log("Run with provided:")
  yield* program.pipe(Effect.provideService(FeatureFlag, true))
})

Effect.runFork(runnable)
