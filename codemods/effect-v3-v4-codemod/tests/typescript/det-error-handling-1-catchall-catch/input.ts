const program = Effect.fail("error").pipe(
  Effect.catchAll((error) => Effect.succeed(`recovered: ${error}`))
)
