/**
 * @since 1.0.0
 */
import type { HttpServerRequest } from "effect/unstable/http/HttpServerRequest"
import type * as Http from "node:http"

/**
 * Returns the underlying Node `IncomingMessage` for a platform Node
 * `HttpServerRequest`.
 *
 * @category Accessors
 * @since 1.0.0
 */
export const toIncomingMessage = (self: HttpServerRequest): Http.IncomingMessage => self.source as any

/**
 * Returns the underlying Node `ServerResponse` for a platform Node
 * `HttpServerRequest`, evaluating the stored response thunk when the response
 * was created lazily.
 *
 * @category Accessors
 * @since 1.0.0
 */
export const toServerResponse = (self: HttpServerRequest): Http.ServerResponse => {
  const res = (self as any).response
  return typeof res === "function" ? res() : res
}
