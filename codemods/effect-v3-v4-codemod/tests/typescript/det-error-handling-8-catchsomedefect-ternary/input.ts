import { Effect, Option } from "effect"

const recovered = Effect.catchSomeDefect((defect) =>
  defect instanceof Error
    ? Option.some(Effect.succeed("recovered"))
    : Option.none()
)
