/**
 * @since 4.0.0
 */
import * as Cause from "../../data/Cause.ts"
import { hasProperty } from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import * as Schema from "../../schema/Schema.ts"
import type { HttpServerResponse } from "./HttpServerResponse.ts"
import * as Response from "./HttpServerResponse.ts"

/** @internal */
export const TypeId = "~effect/http/HttpServerRespondable"

/**
 * @since 4.0.0
 * @category models
 */
export interface Respondable {
  readonly [TypeId]: () => Effect.Effect<HttpServerResponse, unknown>
}

/**
 * @since 4.0.0
 * @category guards
 */
export const isRespondable = (u: unknown): u is Respondable => hasProperty(u, TypeId)

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
  return Effect.orDie(self[TypeId]())
}

/**
 * @since 4.0.0
 * @category accessors
 */
export const toResponseOrElse = (u: unknown, orElse: HttpServerResponse): Effect.Effect<HttpServerResponse> => {
  if (Response.isHttpServerResponse(u)) {
    return Effect.succeed(u)
  } else if (isRespondable(u)) {
    return Effect.catchCause(u[TypeId](), () => Effect.succeed(orElse))
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
    return Effect.catchCause(u[TypeId](), () => Effect.succeed(orElse))
  }
  return Effect.succeed(orElse)
}
