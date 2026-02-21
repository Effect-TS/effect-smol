import { Effect, Schema } from "effect"

const schema = Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedSome("a")))
