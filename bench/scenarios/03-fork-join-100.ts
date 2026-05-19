/**
 * Scenario 3: fork/join 100 concurrent fibers.
 *
 * Exercises fiber spawn allocations, scheduler.scheduleTask, join coordination.
 */
import { Effect, Fiber } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const N = 100
const ITERS = 100

const program: Effect.Effect<number> = Effect.gen(function*() {
  const fibers: Array<Fiber.Fiber<number, never>> = []
  for (let i = 0; i < N; i++) {
    fibers.push(yield* Effect.forkChild(Effect.succeed(i)))
  }
  let sum = 0
  for (let i = 0; i < fibers.length; i++) {
    sum += yield* Fiber.join(fibers[i]!)
  }
  return sum
})

const EXPECTED = (N * (N - 1)) / 2 // sum 0..N-1

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "03-fork-join-100",
    description: `fork ${N} fibers (Effect.succeed), join all, runSync (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          if (result !== EXPECTED) {
            throw new Error(`scenario 03 expected ${EXPECTED}, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
