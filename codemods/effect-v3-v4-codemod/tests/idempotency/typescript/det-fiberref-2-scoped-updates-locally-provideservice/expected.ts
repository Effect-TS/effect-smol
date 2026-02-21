const program = Effect.provideService(
  myEffect,
  References.CurrentLogLevel,
  "Debug"
)
