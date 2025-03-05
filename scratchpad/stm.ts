import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as TxRef from "effect/TxRef"

const program = Effect.gen(function*() {
  const ref1 = yield* TxRef.make(Option.none())
  const ref2 = yield* TxRef.make(Option.none())

  yield* Effect.gen(function*() {
    yield* TxRef.set(ref1, Option.some(`a`))
    yield* TxRef.set(ref2, Option.some(`b`))
  }).pipe(
    Effect.transaction,
    Effect.delay("1 second"),
    Effect.fork
  )

  let attempt = 0
  yield* Effect.gen(function*() {
    const [a, b] = [yield* TxRef.get(ref1), yield* TxRef.get(ref2)]
    yield* Effect.log(`(attempt ${++attempt}) a: ${a._tag}, b: ${b._tag}`)
    if (a._tag === "None" || b._tag === "None") {
      return yield* Effect.retryTransaction
    }
  }).pipe(
    Effect.transaction
  )
})

Effect.runPromise(program).catch(console.error)
