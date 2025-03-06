import * as Effect from "#dist/Effect"
import * as TxRef from "#dist/TxRef"

const program = Effect.gen(function*() {
  const ref = yield* TxRef.make(0)

  yield* Effect.forkScoped(Effect.forever(
    TxRef.update(ref, (n) => n + 1).pipe(Effect.delay("100 millis"))
  ))

  yield* Effect.transaction(Effect.gen(function*() {
    const value = yield* TxRef.get(ref)
    if (value < 10) {
      yield* Effect.log(`retry due to value: ${value}`)
      return yield* Effect.retryTransaction
    }
    yield* Effect.log(`transaction done with value: ${value}`)
  }))
})

Effect.runPromise(program).catch(console.error)
