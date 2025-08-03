import * as Config2 from "#dist/effect/config/Config2"
import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"

Effect.runFork(Config2.schema(Schema.Struct({ ENV: Schema.String })).asEffect())
