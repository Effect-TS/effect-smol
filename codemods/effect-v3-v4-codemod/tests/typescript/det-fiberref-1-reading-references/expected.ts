const program = Effect.gen(function*() {
  const level = yield* References.CurrentLogLevel
  console.error(level)
})
