import { Effect, Option } from "effect"

const recovered = Effect.catchDefect((defect) => defect instanceof Error ? Effect.succeed("recovered") : Effect.die(defect))
