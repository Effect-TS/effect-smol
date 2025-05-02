import { Context, Effect, Schema } from "effect"

// A service used internally by the data type itself
class SomeService extends Context.Tag<
  SomeService,
  {
    someOperation: (u: unknown) => Effect.Effect<string>
  }
>()("SomeService") {}

// The schema requires SomeService to be defined,
// even though the dependency is not passed explicitly
// through the type parameters
//
//     ┌─── declare<string, number, readonly [], SomeService>
//     ▼
const schema = Schema.declare([])<number>()(
  () => (input) =>
    Effect.gen(function*() {
      const service = yield* SomeService
      return yield* service.someOperation(input)
    })
)
