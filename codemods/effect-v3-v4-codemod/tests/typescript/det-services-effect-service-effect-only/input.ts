import { Effect } from "effect"

const Logger = Effect.Service<Logger>()("Logger", { effect: makeLogger })
