import { Deferred, Effect } from "effect"

const program = Effect.gen(function*() {
  const deferred = yield* Deferred.make<void>()
  yield* Deferred.await(deferred)
})

Effect.runPromise(program).then(console.log, console.error)
