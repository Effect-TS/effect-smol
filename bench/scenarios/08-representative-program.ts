/**
 * Scenario 8: representative real-world Effect program.
 *
 * Combines the moving parts typically present in production:
 *   - 2 services injected via Layer + provideService
 *   - a Stream of input items
 *   - mapEffect that yields services and does small work
 *   - one item triggers a typed failure that is caught and recovered
 *   - fork N worker children that join via Fiber.join
 *   - sum + assertion at the end
 *
 * Intentionally NOT a microbenchmark — exercises the full runtime surface
 * the way an application would. Per-iteration cost in the few-ms range.
 */
import { Cause, Context, Data, Effect, Fiber, Stream } from "../../packages/effect/src/index.ts"
import { benchmark, blackhole, type BenchScenarioResult } from "../harness.ts"

const STREAM_N = 200
const FORK_N = 16
const ITERS = 250

class Multiplier extends Context.Service<Multiplier, {
  readonly factor: number
  readonly multiply: (n: number) => Effect.Effect<number>
}>()("BenchScenario08_Multiplier") {}

class Adder extends Context.Service<Adder, {
  readonly delta: number
  readonly add: (n: number) => Effect.Effect<number>
}>()("BenchScenario08_Adder") {}

class BoomError extends Data.TaggedError("BoomError")<{ readonly at: number }> {}

const program: Effect.Effect<number> = Effect.gen(function*() {
  const mult = yield* Multiplier
  const add = yield* Adder

  // Stream of STREAM_N items → mapEffect → fold sum.
  // One item triggers a typed failure that is caught and recovered to 0.
  const streamSum = yield* Stream.range(0, STREAM_N).pipe(
    Stream.mapEffect((n) =>
      Effect.gen(function*() {
        const x = yield* mult.multiply(n)
        if (n === Math.floor(STREAM_N / 2)) {
          return yield* Effect.fail(new BoomError({ at: n }))
        }
        return yield* add.add(x)
      })
    ),
    Stream.catchCause(() => Stream.fromIterable([0])),
    Stream.runFold(() => 0, (acc, n) => acc + n)
  )

  // Fork FORK_N children that each do a service-yielding computation.
  const children: Array<Fiber.Fiber<number, never>> = []
  for (let i = 0; i < FORK_N; i++) {
    children.push(
      yield* Effect.forkChild(
        Effect.gen(function*() {
          const m = yield* mult.multiply(i)
          const a = yield* add.add(m)
          return a
        })
      )
    )
  }

  let forkSum = 0
  for (let i = 0; i < FORK_N; i++) {
    forkSum += yield* Fiber.join(children[i]!)
  }

  return streamSum + forkSum
}).pipe(
  Effect.provideService(Multiplier, {
    factor: 3,
    multiply: (n: number) => Effect.succeed(n * 3)
  }),
  Effect.provideService(Adder, {
    delta: 7,
    add: (n: number) => Effect.succeed(n + 7)
  })
)

// Compute expected value deterministically.
// Items 0..midpoint-1 succeed and contribute (n*3 + 7). At midpoint the
// mapped Effect fails; Stream.catchCause then replaces the *remainder* of
// the stream with [0], which contributes a single 0 to the fold.
const midpoint = Math.floor(STREAM_N / 2)
let expectedStream = 0
for (let n = 0; n < midpoint; n++) {
  expectedStream += n * 3 + 7
}
expectedStream += 0 // the recovery value
let expectedFork = 0
for (let i = 0; i < FORK_N; i++) expectedFork += i * 3 + 7
const EXPECTED = expectedStream + expectedFork

let assertionDone = false

export const run = (): Promise<BenchScenarioResult> =>
  benchmark({
    name: "08-representative-program",
    description: `2 svcs + Stream(N=${STREAM_N})+mapEffect+catchCause + ${FORK_N} fork/join (${ITERS} iters/run)`,
    iterationsPerRun: ITERS,
    setup: () => ({}),
    run: () => {
      for (let i = 0; i < ITERS; i++) {
        const result = Effect.runSync(program)
        if (!assertionDone) {
          if (result !== EXPECTED) {
            throw new Error(`scenario 08 expected ${EXPECTED}, got ${result}`)
          }
          assertionDone = true
        }
        blackhole(result)
      }
    }
  })

// Avoid unused-import warning on Cause when wiring later.
void Cause
