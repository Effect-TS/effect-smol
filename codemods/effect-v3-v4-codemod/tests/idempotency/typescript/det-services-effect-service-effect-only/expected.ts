import { Effect, ServiceMap } from "effect"

const Logger = ServiceMap.Service<Logger>()("Logger", { make: makeLogger })
