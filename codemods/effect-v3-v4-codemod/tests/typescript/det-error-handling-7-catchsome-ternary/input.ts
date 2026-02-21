import { Effect, Option } from "effect"

const recovered = Effect.catchSome((error) =>
  error._tag === "NotFound"
    ? Option.some(Effect.succeed("fallback"))
    : Option.none()
)
