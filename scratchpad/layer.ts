import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

class Users extends Context.Tag("Users")<Users, {}>() {}

const UsersLive = Layer.succeed(Users, {})

const TestLive = Layer.effectDiscard(Effect.service(Users)).pipe(
  Layer.provide(UsersLive)
)

console.time("smol layer")
Effect.void.pipe(
  Effect.provide(UsersLive),
  Effect.repeat({ times: 10000 }),
  Effect.runSync
)
console.timeEnd("smol layer")
