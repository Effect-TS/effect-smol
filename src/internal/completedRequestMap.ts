import { globalValue } from "../GlobalValue.js"
import type { Entry, Request } from "../Request.js"

/** @internal */
export const completedRequestMap = globalValue(
  "effect/Request/completedRequestMap",
  () => new Map<Request<any, any>, Entry<any>>()
)
