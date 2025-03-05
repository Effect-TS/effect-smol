import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as TxRef from "effect/TxRef"

const program = Effect.gen(function*() {
  const ref1 = yield* TxRef.make(Option.none())
  const ref2 = yield* TxRef.make(Option.none())

  yield* Effect.fork(Effect.transaction(Effect.all([
    TxRef.set(ref1, Option.some(`a`)).pipe(Effect.delay("100 millis")),
    TxRef.set(ref2, Option.some(`b`)).pipe(Effect.delay("200 millis"))
  ], { concurrency: "unbounded" })))

  let attempt = 0
  yield* Effect.transaction(Effect.gen(function*() {
    const [a, b] = [yield* TxRef.get(ref1), yield* TxRef.get(ref2)]
    yield* Effect.log(`(attempt ${++attempt}) a: ${a._tag}, b: ${b._tag}`)
    if (a._tag === "None" || b._tag === "None") {
      return yield* Effect.retryTransaction
    }
  }))
})

Effect.runPromise(program).catch(console.error)
