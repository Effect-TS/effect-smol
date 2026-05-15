/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import { hasProperty } from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import type { HttpServerResponse } from "./HttpServerResponse.ts"
import * as Response from "./HttpServerResponse.ts"

/**
 * @category Type IDs
 * @since 4.0.0
 */
export const symbol = "~effect/http/HttpServerRespondable"

/**
 * @category models
 * @since 4.0.0
 */
export interface Respondable {
  [symbol](): Effect.Effect<HttpServerResponse, unknown>
}

/**
 * @category guards
 * @since 4.0.0
 */
export const isRespondable = (u: unknown): u is Respondable => hasProperty(u, symbol)

const badRequest = Response.empty({ status: 400 })
const notFound = Response.empty({ status: 404 })

/**
 * @category accessors
 * @since 4.0.0
 */
export const toResponse = (self: Respondable): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(self)) {
    return Effect.succeed(self)
  }
  return Effect.orDie(self[symbol]())
}

/**
 * @category accessors
 * @since 4.0.0
 */
export const toResponseOrElse = (u: unknown, orElse: HttpServerResponse): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(u)) {
    return Effect.succeed(u)
  } else if (isRespondable(u)) {
    return Effect.catchCause(u[symbol](), () => Effect.succeed(orElse))
    // add support for some commmon types
  } else if (Schema.isSchemaError(u)) {
    return Effect.succeed(badRequest)
  } else if (Cause.isNoSuchElementError(u)) {
    return Effect.succeed(notFound)
  }
  return Effect.succeed(orElse)
}

/**
 * @category accessors
 * @since 4.0.0
 */
export const toResponseOrElseDefect = (u: unknown, orElse: HttpServerResponse): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(u)) {
    return Effect.succeed(u)
  } else if (isRespondable(u)) {
    return Effect.catchCause(u[symbol](), () => Effect.succeed(orElse))
  }
  return Effect.succeed(orElse)
}
