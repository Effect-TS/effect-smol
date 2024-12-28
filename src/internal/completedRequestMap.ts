import * as Context from "../Context.js"
import type { Entry, Request } from "../Request.js"

/** @internal */
export class CompletedRequestMap extends Context.Reference<CompletedRequestMap>()("CompletedRequestMap", {
  defaultValue: () => new Map<Request<any, any, any>, Entry<any>>()
}) {}
