import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as References from "effect/References"
import { bench } from "./bench.js"

class Users extends Context.Tag<Users, {}>()("Users") {}

const UsersLive = Layer.succeed(Users, {})

Effect.void.pipe(
  Effect.provide(UsersLive),
  bench("layer", 1000),
  Effect.provideService(References.MinimumLogLevel, "Debug"),
  Effect.runFork
)
