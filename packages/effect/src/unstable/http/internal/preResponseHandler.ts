import * as Effect from "../../../Effect.ts"
import type { PreResponseHandler } from "../HttpEffect.ts"
import type { HttpServerRequest } from "../HttpServerRequest.ts"

const preResponseHandlerSymbol = Symbol.for("effect/http/HttpEffect/preResponseHandler")

const getPreResponseHandlerSymbolUnsafe = (request: HttpServerRequest): PreResponseHandler | undefined =>
  (request as any)[preResponseHandlerSymbol]

const getSourceUnsafe = (request: HttpServerRequest): object | undefined => {
  const source = request.source
  return typeof source === "object" && source !== null ? source : undefined
}

/** @internal */
export const requestPreResponseHandlers = new WeakMap<HttpServerRequest, PreResponseHandler>()

/** @internal */
export const sourcePreResponseHandlers = new WeakMap<object, PreResponseHandler>()

/** @internal */
export const getPreResponseHandlerUnsafe = (request: HttpServerRequest): PreResponseHandler | undefined => {
  const source = getSourceUnsafe(request)
  return getPreResponseHandlerSymbolUnsafe(request) ??
    requestPreResponseHandlers.get(request) ??
    (source ? sourcePreResponseHandlers.get(source) : undefined)
}

/** @internal */
export const appendPreResponseHandlerUnsafe = (request: HttpServerRequest, handler: PreResponseHandler): void => {
  const prev = getPreResponseHandlerUnsafe(request)
  const next: PreResponseHandler = prev ?
    (request, response) => Effect.flatMap(prev(request, response), (response) => handler(request, response))
    : handler
  ;(request as any)[preResponseHandlerSymbol] = next
  requestPreResponseHandlers.set(request, next)
  const source = getSourceUnsafe(request)
  if (source) {
    sourcePreResponseHandlers.set(source, next)
  }
}

/** @internal */
export const copyPreResponseHandlersUnsafe = (source: HttpServerRequest, target: HttpServerRequest): void => {
  const handler = getPreResponseHandlerUnsafe(source)
  if (handler === undefined) {
    return
  }
  ;(target as any)[preResponseHandlerSymbol] = handler
  requestPreResponseHandlers.set(target, handler)
  const sourceKey = getSourceUnsafe(target)
  if (sourceKey) {
    sourcePreResponseHandlers.set(sourceKey, handler)
  }
}
