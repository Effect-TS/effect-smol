import * as Effect from "#dist/effect/Effect"
import * as Metric from "#dist/effect/observability/Metric"

const program = Effect.gen(function*() {
  yield* Effect.succeed(1).pipe(
    Effect.fork({ startImmediately: true })
  )
})

program.pipe(
  Metric.enableRuntimeMetrics,
  Effect.runFork
)
