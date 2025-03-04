import * as Effect from "effect/Effect"
import * as STM from "effect/STM"

const program = Effect.gen(function*() {
  const ref = yield* STM.makeTRef(0)

  yield* Effect.fork(Effect.gen(function*() {
    while (true) {
      yield* Effect.sleep("1 second")
      yield* STM.transaction(STM.modifyTRef(ref, (n) => n + 1))
    }
  }))

  const value = yield* STM.transaction(Effect.gen(function*() {
    const value = yield* STM.getTRef(ref)
    yield* Effect.log(`check: ${value}`)
    if (value < 10) {
      return yield* STM.retry
    }
    return value
  }))

  yield* Effect.log(`final: ${value}`)
})

Effect.runPromise(program).catch(console.error)
