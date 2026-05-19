/**
 * Scenario 6: service provide + yield (heavy).
 *
 * Exercises Context.getReferenceUnsafe (the two-probe pattern at
 * packages/effect/src/Context.ts:839-844) plus setContext's repeated
 * lookups during fiber initialisation.
 *
 * Two variants:
 *   shallow: one service, one yield → minimal lookup
 *   deep:    one service, many yields under a deep `provideService` stack
 */
import { Context, Effect } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const ITERS_SHALLOW = 5000
const ITERS_DEEP = 1500
const DEEP_YIELDS = 200

interface SShape {
  readonly v: number
}
class S extends Context.Service<S, SShape>()("BenchScenario06_S") {}

const shallow: Effect.Effect<number> = Effect.gen(function*() {
  const s = yield* S
  return s.v
}).pipe(Effect.provideService(S, { v: 42 }))

const deep: Effect.Effect<number> = Effect.gen(function*() {
  let sum = 0
  for (let i = 0; i < DEEP_YIELDS; i++) {
    const s = yield* S
    sum += s.v
  }
  return sum
}).pipe(Effect.provideService(S, { v: 1 }))

const EXPECTED_SHALLOW = 42
const EXPECTED_DEEP = DEEP_YIELDS

let shallowAsserted = false
let deepAsserted = false

export const runShallow = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "06a-service-provide-yield-shallow",
    description: `provideService(S, {v:42}); gen yield* S; runSync (${ITERS_SHALLOW} iters/run)`,
    iterationsPerRun: ITERS_SHALLOW,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS_SHALLOW; i++) {
        const r = Effect.runSync(shallow)
        if (!shallowAsserted) {
          if (r !== EXPECTED_SHALLOW) throw new Error(`scenario 06a expected ${EXPECTED_SHALLOW}, got ${r}`)
          shallowAsserted = true
        }
        blackhole(r)
      }
    }
  })

export const runDeep = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "06b-service-provide-yield-deep",
    description: `provideService + ${DEEP_YIELDS} yields of S; runSync (${ITERS_DEEP} iters/run)`,
    iterationsPerRun: ITERS_DEEP,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS_DEEP; i++) {
        const r = Effect.runSync(deep)
        if (!deepAsserted) {
          if (r !== EXPECTED_DEEP) throw new Error(`scenario 06b expected ${EXPECTED_DEEP}, got ${r}`)
          deepAsserted = true
        }
        blackhole(r)
      }
    }
  })
