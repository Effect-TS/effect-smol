const program = Effect.gen(function*() {
  const level = yield* FiberRef.get(FiberRef.currentLogLevel)
  console.error(level)
})
