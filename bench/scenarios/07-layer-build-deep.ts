/**
 * Scenario 7: Layer build (deep dependency graph).
 *
 * Models a realistic app where many services compose through Layer.provide,
 * Layer.merge, and Layer.provideMerge. Each iteration provides the composed
 * layer to a small program and runs it — exercising:
 *   - Layer compilation / memoization
 *   - Context construction & service-key threading
 *   - service lookup chain at yield time (Context.getReferenceUnsafe)
 *   - the runtime's R-resolution path
 *
 * Graph:
 *   ServiceA  (Layer.succeed)
 *   ServiceB  depends on A
 *   ServiceC  depends on B   (provided via Layer.provide chain)
 *   ServiceD  depends on C
 *   ServiceE  depends on D + B (merged) so the graph branches
 *   ServiceF  depends on E + A (provideMerge — also publishes A)
 *
 * Program then yields E and F and sums their fields.
 */
import { Context, Effect, Layer } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const ITERS = 200

class ServiceA extends Context.Service<ServiceA, { readonly a: number }>()("BenchScenario07_A") {}
class ServiceB extends Context.Service<ServiceB, { readonly b: number }>()("BenchScenario07_B") {}
class ServiceC extends Context.Service<ServiceC, { readonly c: number }>()("BenchScenario07_C") {}
class ServiceD extends Context.Service<ServiceD, { readonly d: number }>()("BenchScenario07_D") {}
class ServiceE extends Context.Service<ServiceE, { readonly e: number }>()("BenchScenario07_E") {}
class ServiceF extends Context.Service<ServiceF, { readonly f: number }>()("BenchScenario07_F") {}

const LayerA = Layer.succeed(ServiceA, { a: 1 })

const LayerB = Layer.effect(
  ServiceB,
  Effect.gen(function*() {
    const a = yield* ServiceA
    return { b: a.a + 1 }
  })
).pipe(Layer.provide(LayerA))

const LayerC = Layer.effect(
  ServiceC,
  Effect.gen(function*() {
    const b = yield* ServiceB
    return { c: b.b + 1 }
  })
).pipe(Layer.provide(LayerB))

const LayerD = Layer.effect(
  ServiceD,
  Effect.gen(function*() {
    const c = yield* ServiceC
    return { d: c.c + 1 }
  })
).pipe(Layer.provide(LayerC))

// Branch: E needs both D and B; merge them as a single provide bundle
const LayerE = Layer.effect(
  ServiceE,
  Effect.gen(function*() {
    const d = yield* ServiceD
    const b = yield* ServiceB
    return { e: d.d + b.b }
  })
).pipe(Layer.provide(Layer.merge(LayerD, LayerB)))

// provideMerge: F is provided by composition of E + A, but also re-publishes A
const LayerF = Layer.effect(
  ServiceF,
  Effect.gen(function*() {
    const e = yield* ServiceE
    const a = yield* ServiceA
    return { f: e.e + a.a }
  })
).pipe(Layer.provideMerge(Layer.merge(LayerE, LayerA)))

const program: Effect.Effect<number, never, ServiceE | ServiceF> = Effect.gen(function*() {
  const e = yield* ServiceE
  const f = yield* ServiceF
  return e.e + f.f
})

// Each iteration provides the entire layer graph and runs the program.
// Layer.provide handles memoization automatically.
const provided: Effect.Effect<number> = program.pipe(Effect.provide(LayerF))

// E = (((1)+1)+1)+1 + (1+1) = 4 + 2 = 6
// F = 6 + 1 = 7
// total = 6 + 7 = 13
const EXPECTED = 13

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "07-layer-build-deep",
    description: `Layer graph A→B→C→D→{D,B}→E; F=provideMerge(E,A); program yields E+F (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(provided)
        if (!assertionDone) {
          if (result !== EXPECTED) {
            throw new Error(`scenario 07 expected ${EXPECTED}, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })
