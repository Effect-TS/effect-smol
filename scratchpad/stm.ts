import * as Effect from "effect/Effect"
import * as TxRef from "effect/TxRef"

const program = Effect.gen(function*() {
  const ref = yield* TxRef.make(0)

  yield* Effect.fork(Effect.gen(function*() {
    while (true) {
      yield* Effect.sleep("1 second")
      yield* Effect.tx(TxRef.update(ref, (n) => n + 1))
    }
  }))

  const value = yield* Effect.tx(Effect.gen(function*() {
    const value = yield* TxRef.get(ref)
    yield* Effect.log(`check: ${value}`)
    if (value < 10) {
      return yield* Effect.txRetry
    }
    return value
  }))

  yield* Effect.log(`final: ${value}`)
})

Effect.runPromise(program).catch(console.error)
