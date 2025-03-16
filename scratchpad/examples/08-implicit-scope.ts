import { Context, Effect, Layer } from "effect"

class BackgroundCounter extends Context.Tag<BackgroundCounter, {
  getCount: Effect.Effect<number>
}>()("BackgroundCounter") {
  static layer = Layer.effect(
    this,
    Effect.gen(function*() {
      let count = 0
      yield* Effect.forkScoped(Effect.gen(function*() {
        while (true) {
          count++
          yield* Effect.sleep("100 millis")
        }
      }))
      return {
        getCount: Effect.sync(() => count)
      }
    })
  )
}

const program = Effect.gen(function*() {
  const backgroundCounter = yield* BackgroundCounter

  yield* Effect.log(`count: ${yield* backgroundCounter.getCount}`)
  yield* Effect.sleep("500 millis")
  yield* Effect.log(`count: ${yield* backgroundCounter.getCount}`)
})

Effect.runFork(program.pipe(Effect.provide(BackgroundCounter.layer)))
