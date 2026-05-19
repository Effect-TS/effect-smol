/**
 * Scenario 2: mixed-primitive chain (depth=1000 ops, interleaved).
 *
 * Forces multiple primitive types through the [evaluate] dispatch site
 * (Sync, Map, Tap, FlatMap). Compared against scenario 1, the delta
 * reveals whether scenario 1 was already megamorphic.
 */
import { Effect } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const BLOCKS = 250 // 4 ops per block = 1000 ops total
const ITERS = 500

const buildChain = (): Effect.Effect<number> => {
  let e: Effect.Effect<number> = Effect.succeed(0)
  for (let i = 0; i < BLOCKS; i++) {
    e = e.pipe(
      Effect.flatMap((n) => Effect.succeed(n + 1)),
      Effect.map((n) => n + 1),
      Effect.tap(() => Effect.succeed(undefined)),
      Effect.flatMap((n) => Effect.succeed(n + 1))
    )
  }
  return e
}

const program = buildChain()
const EXPECTED = BLOCKS * 3 // flatMap (+1), map (+1), tap (no inc), flatMap (+1) → 3 per block

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "02-mixed-primitive-chain-1000",
    description: `succeed → (flatMap, map, tap, flatMap) × ${BLOCKS} blocks, runSync (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          if (result !== EXPECTED) {
            throw new Error(`scenario 02 expected ${EXPECTED}, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
