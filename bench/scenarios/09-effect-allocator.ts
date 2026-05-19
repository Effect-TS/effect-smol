/**
 * Scenario 9: Effect AST construction only (no run).
 *
 * Pure allocation benchmark — builds a deep Effect tree using
 * map / flatMap / tap and intentionally does NOT runSync it.
 *
 * Measures:
 *   - per-primitive construction cost
 *   - hidden-class stability for the unified SharedComputationProto
 *   - GC pressure / heap delta of the AST itself
 *
 * V1.3's per-instance [evaluate] adds one own-property write per
 * construction. This scenario quantifies that allocation overhead in
 * isolation from the run loop.
 */
import { Effect } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const DEPTH = 1000
const ITERS = 500

const buildTree = (): Effect.Effect<number> => {
  let e: Effect.Effect<number> = Effect.succeed(0)
  for (let i = 0; i < DEPTH; i++) {
    // Cycle through three primitives so we exercise OnSuccess, plain map,
    // and tap (no continuation).
    const phase = i % 3
    if (phase === 0) {
      e = e.pipe(Effect.flatMap((n) => Effect.succeed(n + 1)))
    } else if (phase === 1) {
      e = e.pipe(Effect.map((n) => n + 1))
    } else {
      e = e.pipe(Effect.tap(() => Effect.succeed(undefined)))
    }
  }
  return e
}

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "09-effect-allocator",
    description: `build Effect tree depth=${DEPTH}, NO runSync (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const tree = buildTree()
        if (!assertionDone) {
          // sanity-check that the tree was built and is an Effect
          if (tree === undefined || tree === null) {
            throw new Error(`scenario 09 expected non-null Effect tree`)
          }
          assertionDone = true
        }
        blackhole(tree)
      }
    }
  })
