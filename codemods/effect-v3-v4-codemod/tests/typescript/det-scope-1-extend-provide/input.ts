const program = Effect.gen(function*() {
  const scope = yield* Scope.make()
  yield* Scope.extend(myEffect, scope)
})
