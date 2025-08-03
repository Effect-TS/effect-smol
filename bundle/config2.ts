import * as Config2 from "#dist/effect/config/Config2"
import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/schema/Schema"

const schema = Schema.Struct({
  API_KEY: Schema.String,
  PORT: Schema.Int,
  LOCALHOST: Schema.URL
})

const config = Config2.schema(schema)

Effect.runFork(config.asEffect())
