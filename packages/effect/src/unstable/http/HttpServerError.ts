/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Data from "../../Data.ts"
import * as Effect from "../../Effect.ts"
import type * as Exit from "../../Exit.ts"
import { hasProperty } from "../../Predicate.ts"
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
  readonly reason: "RequestParseError" | "RouteNotFound" | "InternalError"
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
    return Effect.succeed(
      Response.empty({
        status: this.reason === "InternalError"
          ? 500
          : this.reason === "RouteNotFound"
          ? 404
          : 400
      })
    )
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
  let response: Response.HttpServerResponse | undefined
  let effect = succeedInternalServerError
  const failures: Array<Cause.Failure<E>> = []
  let interrupt: Cause.Interrupt | undefined
  let isClientInterrupt = false
  for (let i = 0; i < cause.failures.length; i++) {
    const f = cause.failures[i]
    switch (f._tag) {
      case "Fail": {
        effect = Respondable.toResponseOrElse(f.error, internalServerError)
        failures.push(f)
        break
      }
      case "Die": {
        if (Response.isHttpServerResponse(f.defect)) {
          response = f.defect
        } else {
          effect = Respondable.toResponseOrElseDefect(f.defect, internalServerError)
          failures.push(f)
        }
        break
      }
      case "Interrupt": {
        isClientInterrupt = isClientInterrupt || f.fiberId === clientAbortFiberId
        if (failures.length > 0) break
        interrupt = f
        break
      }
    }
  }
  if (response) {
    return Effect.succeed([response, Cause.fromFailures(failures)] as const)
  } else if (interrupt && failures.length === 0) {
    failures.push(isClientInterrupt ? Cause.failureInterrupt(clientAbortFiberId) : interrupt)
    effect = isClientInterrupt ? clientAbortError : serverAbortError
  }
  return Effect.mapEager(effect, (response) => {
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
const succeedInternalServerError = Effect.succeed(internalServerError)
const clientAbortError = Effect.succeed(Response.empty({ status: 499 }))
const serverAbortError = Effect.succeed(Response.empty({ status: 503 }))

/**
 * @since 4.0.0
 */
export const exitResponse = <E>(exit: Exit.Exit<Response.HttpServerResponse, E>): Response.HttpServerResponse => {
  if (exit._tag === "Success") {
    return exit.value
  }
  return causeResponseStripped(exit.cause)[0]
}
