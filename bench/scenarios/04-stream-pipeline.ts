/**
 * Scenario 4: Stream pipeline — range × map × filter × runDrain.
 *
 * Realistic mixed workload. Many small effects under the hood,
 * exercising the Channel/Stream machinery on top of the core runtime.
 */
import { Effect, Stream } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const N = 10_000
const ITERS = 300

// Build the program once; runDrain is the boundary.
const program: Effect.Effect<void> = Stream.range(0, N).pipe(
  Stream.map((n: number) => n * 2),
  Stream.filter((n: number) => n % 3 === 0),
  Stream.runDrain
)

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "04-stream-range-map-filter-drain",
    description: `Stream.range(0, ${N}).map(*2).filter(%3==0).runDrain (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          // runDrain returns undefined on success; just confirm it executed
          if (result !== undefined) {
            throw new Error(`scenario 04 expected undefined, got ${String(result)}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
