import * as Config from "#dist/effect/Config"
import * as Effect from "#dist/effect/Effect"
import * as Schema from "#dist/effect/Schema"

const schema = Schema.Struct({
  API_KEY: Schema.String,
  PORT: Schema.Int,
  LOCALHOST: Schema.URL
})

const config = Config.schema(schema)

Effect.runFork(config.asEffect())
