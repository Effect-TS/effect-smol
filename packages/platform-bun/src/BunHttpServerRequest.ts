/**
 * @since 1.0.0
 */
import type { HttpServerRequest } from "effect/unstable/http/HttpServerRequest"

/**
 * Returns the underlying `Bun.BunRequest` from an Effect `HttpServerRequest`.
 *
 * @category Accessors
 * @since 1.0.0
 */
export const toBunServerRequest = <T extends string = string>(self: HttpServerRequest): Bun.BunRequest<T> =>
  (self as any).source
