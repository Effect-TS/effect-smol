import { Effect, Schema } from "effect"

const schema = Schema.String.annotations({
  decodingFallback: () => Effect.succeed("a")
})
