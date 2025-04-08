import * as Effect from "#dist/Effect"
import * as Metric from "#dist/Metric"

const program = Effect.gen(function*() {
  yield* Effect.succeed(1).pipe(
    Effect.fork({ startImmediately: true })
  )
})

program.pipe(
  Metric.enableRuntimeMetrics,
  Effect.runFork
)
