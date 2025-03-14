import * as Effect from "../src/Effect.js"

const round = (num: number) => Math.round((num + Number.EPSILON) * 1000) / 1000

export const bench = (name: string, times: number) =>
  Effect.fnUntraced(
    function*<A, E, R>(effect: Effect.Effect<A, E, R>) {
      let total = 0
      yield* Effect.addFinalizer(() => Effect.log(`${name}: ${round(total / times)}ms (average)`))
      for (let i = 0; i < times; i++) {
        const start = performance.now()
        yield* effect
        const end = performance.now()
        const time = end - start
        total += time
        yield* Effect.logDebug(`${name}: ${round(time)}ms`)
        yield* Effect.sleep(0)
      }
    },
    Effect.scoped
  )
