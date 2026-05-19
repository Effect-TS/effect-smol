/**
 * Scenario 1: succeed + flatMap chain (depth=1000).
 *
 * Isolates the run-loop dispatch IC at `[evaluate]` plus per-step
 * Success Exit allocation. Main signal for megamorphic dispatch at the
 * primary call site (packages/effect/src/internal/effect.ts:633).
 */
import { Effect } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const DEPTH = 1000
const ITERS = 500

// Build the effect tree ONCE, outside the timed region. We are
// measuring runSync (the run loop), not the construction cost.
const buildChain = (): Effect.Effect<number> => {
  let e: Effect.Effect<number> = Effect.succeed(0)
  for (let i = 0; i < DEPTH; i++) {
    e = e.pipe(Effect.flatMap((n) => Effect.succeed(n + 1)))
  }
  return e
}

const program = buildChain()
const EXPECTED = DEPTH

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "01-succeed-flatmap-1000",
    description: `succeed -> flatMap x ${DEPTH}, runSync (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          if (result !== EXPECTED) {
            throw new Error(`scenario 01 expected ${EXPECTED}, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
