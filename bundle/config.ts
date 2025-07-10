import * as Config from "#dist/effect/config/Config"
import * as Effect from "#dist/effect/Effect"

Effect.runFork(Config.String("ENV"))
