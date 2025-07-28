import * as Config from "#dist/effect/config/Config"
import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"

Effect.runFork(Config.schema({ ENV: Schema.String }).asEffect())
