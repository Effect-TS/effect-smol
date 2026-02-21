import { Effect, Option, Filter } from "effect"

const recovered = Effect.catchFilter(Filter.fromPredicate((error) => error._tag === "NotFound"), (error) => Effect.succeed("fallback"))
