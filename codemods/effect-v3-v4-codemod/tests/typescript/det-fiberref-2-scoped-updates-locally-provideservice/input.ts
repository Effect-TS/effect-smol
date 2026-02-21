const program = Effect.locally(
  myEffect,
  FiberRef.currentLogLevel,
  LogLevel.Debug
)
