/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import { hasProperty } from "../../Predicate.ts"
import type * as HttpClientRequest from "./HttpClientRequest.ts"
import type * as ClientResponse from "./HttpClientResponse.ts"

/**
 * @since 4.0.0
 * @category type id
 */
export const TypeId: TypeId = "~effect/http/HttpClientError"

/**
 * @since 4.0.0
 * @category type id
 */
export type TypeId = "~effect/http/HttpClientError"

/**
 * @since 4.0.0
 * @category guards
 */
export const isHttpClientError = (u: unknown): u is HttpClientError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category error
 */
export type HttpClientError = RequestError | ResponseError

/**
 * @since 4.0.0
 * @category error
 */
export class RequestError extends Data.TaggedError("RequestError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly reason: "Transport" | "Encode" | "InvalidUrl"
  readonly cause?: unknown
  readonly description?: string
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  /**
   * @since 4.0.0
   */
  override get message() {
    return this.description ?
      `${this.reason}: ${this.description} (${this.methodAndUrl})` :
      `${this.reason} error (${this.methodAndUrl})`
  }
}

/**
 * @since 4.0.0
 * @category error
 */
export class ResponseError extends Data.TaggedError("ResponseError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: ClientResponse.HttpClientResponse
  readonly reason: "StatusCode" | "Decode" | "EmptyBody"
  readonly cause?: unknown
  readonly description?: string | undefined
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  get methodAndUrl() {
    return `${this.request.method} ${this.request.url}`
  }

  /**
   * @since 4.0.0
   */
  override get message() {
    const info = `${this.response.status} ${this.methodAndUrl}`
    return this.description ?
      `${this.reason}: ${this.description} (${info})` :
      `${this.reason} error (${info})`
  }
}
