import * as Effect from "effect/Effect"

const round = (num: number) => Math.round((num + Number.EPSILON) * 1000) / 1000

export const bench = (name: string, times: number) =>
  Effect.fnUntraced(
    function*<A, E, R>(effect: Effect.Effect<A, E, R>) {
      let total = 0
      let count = 0
      yield* Effect.addFinalizer(() => Effect.log(`${name}: ${round(total / count)}ms (average)`))
      for (let i = 0; i < times; i++) {
        const start = performance.now()
        yield* effect
        const end = performance.now()
        const time = end - start
        total += time
        count += 1
        yield* Effect.logDebug(`${name}: ${round(time)}ms`)
        yield* Effect.yieldNow
      }
    },
    Effect.scoped
  )
