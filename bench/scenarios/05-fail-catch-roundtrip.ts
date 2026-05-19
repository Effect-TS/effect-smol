/**
 * Scenario 5: fail / catch roundtrip.
 *
 * Exercises Cause allocation (Fail reason + CauseImpl wrapper, ~2 heap
 * objects per failure) plus the failure-path dispatch.
 *
 * Note: effect-smol does not export `catchAll`. The broadest analog is
 * `catchCause`, which catches the whole cause regardless of tag and is
 * the closest equivalent for the audit hypothesis.
 */
import { Effect } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const ITERS = 20_000

const program: Effect.Effect<number, never> = Effect.fail("boom" as const).pipe(
  Effect.catchCause(() => Effect.succeed(1))
)

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "05-fail-catchCause-roundtrip",
    description: `Effect.fail -> catchCause -> succeed(1), runSync (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          if (result !== 1) {
            throw new Error(`scenario 05 expected 1, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
