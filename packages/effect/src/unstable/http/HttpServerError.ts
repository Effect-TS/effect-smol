/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.js"
import * as Data from "../../Data.js"
import * as Effect from "../../Effect.js"
import type * as Exit from "../../Exit.js"
import * as Option from "../../Option.js"
import { hasProperty } from "../../Predicate.js"
import type * as HttpServerRequest from "./HttpServerRequest.js"
import * as HttpServerRespondable from "./HttpServerRespondable.js"
import * as HttpServerResponse from "./HttpServerResponse.js"

/**
 * @since 4.0.0
 * @category type id
 */
export const TypeId: TypeId = "~effect/http/HttpServerError"

/**
 * @since 4.0.0
 * @category type id
 */
export type TypeId = "~effect/http/HttpServerError"

/**
 * @since 4.0.0
 * @category error
 */
export type HttpServerError = RequestError | ResponseError

/**
 * @since 4.0.0
 * @category error
 */
export class RequestError extends Data.TaggedError("HttpServerError")<{
  readonly reason: "RequestParseError" | "RouteNotFound"
  readonly request: HttpServerRequest.HttpServerRequest
  readonly description?: string
  readonly cause?: unknown
}> implements HttpServerRespondable.Respondable {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId

  /**
   * @since 4.0.0
   */
  stack = `${this.name}: ${this.message}`;

  /**
   * @since 4.0.0
   */
  [HttpServerRespondable.symbol]() {
    return HttpServerResponse.empty({ status: this.reason === "RouteNotFound" ? 404 : 400 })
  }

  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  get message() {
    const prefix = `${this.reason} (${this.methodAndUrl})`
    return this.description ? `${prefix}: ${this.description}` : prefix
  }
}

/**
 * @since 4.0.0
 * @category predicates
 */
export const isHttpServerError = (u: unknown): u is HttpServerError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category error
 */
export class ResponseError extends Data.TaggedError("HttpServerError")<{
  readonly request: HttpServerRequest.HttpServerRequest
  readonly response: HttpServerResponse.HttpServerResponse
  readonly description?: string
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
  /**
   * @since 4.0.0
   */
  readonly reason = "ResponseError" as const

  /**
   * @since 4.0.0
   */
  stack = `${this.name}: ${this.message}`;

  /**
   * @since 4.0.0
   */
  [HttpServerRespondable.symbol]() {
    return HttpServerRespondable.empty({ status: 500 })
  }

  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  get message() {
    const info = `${this.reason} (${this.response.status} ${this.methodAndUrl})`
    return this.description ? `${info}: ${this.description}` : info
  }
}

/**
 * @since 4.0.0
 * @category error
 */
export class ServeError extends Data.TaggedError("ServeError")<{
  readonly cause: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId]: TypeId = TypeId
}

/**
 * @since 4.0.0
 */
export const clientAbortFiberId = -499

/**
 * @since 4.0.0
 */
export const causeResponse = <E>(
  cause: Cause.Cause<E>
): Effect.Effect<readonly [HttpServerResponse, Cause.Cause<E>]> => {
  const [effect, stripped] = Cause.reduce(
    cause,
    [Effect.succeed(internalServerError), Cause.empty as Cause.Cause<E>] as const,
    (acc, cause) => {
      switch (cause._tag) {
        case "Empty": {
          return Option.some(acc)
        }
        case "Fail": {
          return Option.some([Respondable.toResponseOrElse(cause.error, internalServerError), cause] as const)
        }
        case "Die": {
          return Option.some([Respondable.toResponseOrElseDefect(cause.defect, internalServerError), cause] as const)
        }
        case "Interrupt": {
          if (acc[1]._tag !== "Empty") {
            return Option.none()
          }
          const response = cause.fiberId === clientAbortFiberId ? clientAbortError : serverAbortError
          return Option.some([Effect.succeed(response), cause] as const)
        }
        default: {
          return Option.none()
        }
      }
    }
  )
  return Effect.map(effect, (response) => {
    if (Cause.isEmptyType(stripped)) {
      return [response, Cause.die(response)] as const
    }
    return [response, Cause.sequential(stripped, Cause.die(response))] as const
  })
}

/** @internal */
export const causeResponseStripped = <E>(
  cause: Cause.Cause<E>
): readonly [response: HttpServerResponse, cause: Option.Option<Cause.Cause<E>>] => {
  let response: HttpServerResponse | undefined
  const stripped = Cause.fromFailures(cause.failures.filter((f) => {
    if (f._tag === "Die" && HttpServerResponse.isHttpServerResponse(f.defect)) {
      response = f.defect
      return false
    }
    return true
  }))
  return [response ?? internalServerError, stripped]
}

const internalServerError = HttpServerResponse.empty({ status: 500 })
const clientAbortError = HttpServerResponse.empty({ status: 499 })
const serverAbortError = HttpServerResponse.empty({ status: 503 })

/** @internal */
export const exitResponse = <E>(exit: Exit.Exit<HttpServerResponse, E>): HttpServerResponse => {
  if (exit._tag === "Success") {
    return exit.value
  }
  return causeResponseStripped(exit.cause)[0]
}
