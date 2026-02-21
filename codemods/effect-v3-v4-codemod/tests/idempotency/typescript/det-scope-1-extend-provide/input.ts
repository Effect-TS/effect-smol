const program = Effect.gen(function*() {
  const scope = yield* Scope.make()
  yield* Scope.provide(scope)(myEffect)
})
