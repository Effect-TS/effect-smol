/**
 * @since 1.0.0
 */
import type { HttpServerRequest } from "effect/unstable/http/HttpServerRequest"
import type * as Http from "node:http"

/**
 * @category Accessors
 * @since 1.0.0
 */
export const toIncomingMessage = (self: HttpServerRequest): Http.IncomingMessage => self.source as any

/**
 * @category Accessors
 * @since 1.0.0
 */
export const toServerResponse = (self: HttpServerRequest): Http.ServerResponse => {
  const res = (self as any).response
  return typeof res === "function" ? res() : res
}
