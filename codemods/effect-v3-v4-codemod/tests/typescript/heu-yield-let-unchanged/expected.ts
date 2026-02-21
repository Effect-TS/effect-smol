import { Effect, Ref } from "effect"

const program = Effect.gen(function*() {
  let ref = yield* Ref.make(0)
  const value = yield* ref
  ref = yield* Ref.make(1)
  return value
})
