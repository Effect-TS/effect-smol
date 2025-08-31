/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Arr from "../../collections/Array.ts"
import * as Data from "../../data/Data.ts"
import { hasProperty } from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import type * as Request from "./HttpServerRequest.ts"
import * as Respondable from "./HttpServerRespondable.ts"
import * as Response from "./HttpServerResponse.ts"

const TypeId = "~effect/http/HttpServerError"

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
  readonly request: Request.HttpServerRequest
  readonly description?: string
  readonly cause?: unknown
}> implements Respondable.Respondable {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override stack = `${this.name}: ${this.message}`;

  /**
   * @since 4.0.0
   */
  [Respondable.TypeId]() {
    return Effect.succeed(Response.empty({ status: this.reason === "RouteNotFound" ? 404 : 400 }))
  }

  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  override get message() {
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
  readonly request: Request.HttpServerRequest
  readonly response: Response.HttpServerResponse
  readonly description?: string
  readonly cause?: unknown
}> implements Respondable.Respondable {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId
  /**
   * @since 4.0.0
   */
  readonly reason = "ResponseError" as const

  /**
   * @since 4.0.0
   */
  override stack = `${this.name}: ${this.message}`;

  /**
   * @since 4.0.0
   */
  [Respondable.TypeId]() {
    return Effect.succeed(Response.empty({ status: 500 }))
  }

  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  override get message() {
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
  readonly [TypeId] = TypeId
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
): Effect.Effect<readonly [Response.HttpServerResponse, Cause.Cause<E>]> => {
  const [effect, failures] = Arr.reduce(
    cause.failures,
    [Effect.succeed(internalServerError), Arr.empty<Cause.Failure<E>>()] as const,
    (acc, f) => {
      switch (f._tag) {
        case "Fail": {
          return [Respondable.toResponseOrElse(f.error, internalServerError), [f]]
        }
        case "Die": {
          return [Respondable.toResponseOrElseDefect(f.defect, internalServerError), [f]]
        }
        case "Interrupt": {
          if (acc[1].length > 0) return acc
          const response = f.fiberId === clientAbortFiberId
            ? clientAbortError
            : serverAbortError
          return [Effect.succeed(response), [f]]
        }
        default: {
          return acc
        }
      }
    }
  )
  return Effect.map(effect, (response) => {
    failures.push(Cause.failureDie(response))
    return [response, Cause.fromFailures(failures)] as const
  })
}

/**
 * @since 4.0.0
 */
export const causeResponseStripped = <E>(
  cause: Cause.Cause<E>
): readonly [response: Response.HttpServerResponse, cause: Cause.Cause<E> | undefined] => {
  let response: Response.HttpServerResponse | undefined
  const failures = cause.failures.filter((f) => {
    if (f._tag === "Die" && Response.isHttpServerResponse(f.defect)) {
      response = f.defect
      return false
    }
    return true
  })
  return [
    response ?? internalServerError,
    failures.length > 0 ? Cause.fromFailures(failures) : undefined
  ]
}

const internalServerError = Response.empty({ status: 500 })
const clientAbortError = Response.empty({ status: 499 })
const serverAbortError = Response.empty({ status: 503 })

/**
 * @since 4.0.0
 */
export const exitResponse = <E>(exit: Exit.Exit<Response.HttpServerResponse, E>): Response.HttpServerResponse => {
  if (exit._tag === "Success") {
    return exit.value
  }
  return causeResponseStripped(exit.cause)[0]
}
