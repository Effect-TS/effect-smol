import * as Config from "#dist/effect/config/Config"
import * as Effect from "#dist/effect/Effect"

const config = Config.all({
  API_KEY: Config.String("API_KEY"),
  PORT: Config.Integer("PORT"),
  LOCALHOST: Config.Url("LOCALHOST")
})

Effect.runFork(config.asEffect())
