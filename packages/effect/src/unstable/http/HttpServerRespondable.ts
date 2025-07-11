/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.js"
import * as Effect from "../../Effect.js"
import { hasProperty } from "../../Predicate.js"
import * as Schema from "../../schema/Schema.js"
import type { HttpServerResponse } from "./HttpServerResponse.js"
import * as Response from "./HttpServerResponse.js"

/**
 * @since 4.0.0
 * @category symbols
 */
export const symbol: "~effect/http/HttpServerRespondable" = "~effect/http/HttpServerRespondable" as const

/**
 * @since 4.0.0
 * @category models
 */
export interface Respondable {
  readonly [symbol]: () => Effect.Effect<HttpServerResponse, unknown>
}

/**
 * @since 4.0.0
 * @category guards
 */
export const isRespondable = (u: unknown): u is Respondable => hasProperty(u, symbol)

const badRequest = Response.empty({ status: 400 })
const notFound = Response.empty({ status: 404 })

/**
 * @since 4.0.0
 * @category accessors
 */
export const toResponse = (self: Respondable): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(self)) {
    return Effect.succeed(self)
  }
  return Effect.orDie(self[symbol]())
}

/**
 * @since 4.0.0
 * @category accessors
 */
export const toResponseOrElse = (u: unknown, orElse: HttpServerResponse): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(u)) {
    return Effect.succeed(u)
  } else if (isRespondable(u)) {
    return Effect.catchCause(u[symbol](), () => Effect.succeed(orElse))
    // add support for some commmon types
  } else if (u instanceof Schema.SchemaError) {
    return Effect.succeed(badRequest)
  } else if (Cause.isNoSuchElementError(u)) {
    return Effect.succeed(notFound)
  }
  return Effect.succeed(orElse)
}

/**
 * @since 4.0.0
 * @category accessors
 */
export const toResponseOrElseDefect = (u: unknown, orElse: HttpServerResponse): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(u)) {
    return Effect.succeed(u)
  } else if (isRespondable(u)) {
    return Effect.catchCause(u[symbol](), () => Effect.succeed(orElse))
  }
  return Effect.succeed(orElse)
}
