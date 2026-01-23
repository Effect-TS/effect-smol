/**
 * @since 4.0.0
 */
import * as Data from "../../Data.ts"
import { hasProperty } from "../../Predicate.ts"
import type * as HttpClientRequest from "./HttpClientRequest.ts"
import type * as ClientResponse from "./HttpClientResponse.ts"

const TypeId = "~effect/http/HttpClientError"

const reasonLabel = (tag: string) => tag.endsWith("Error") ? tag.slice(0, -5) : tag

const formatRequestMessage = (
  reason: string,
  request: HttpClientRequest.HttpClientRequest,
  description?: string
) => {
  const methodAndUrl = `${request.method} ${request.url}`
  return description ? `${reason}: ${description} (${methodAndUrl})` : `${reason} error (${methodAndUrl})`
}

const formatResponseMessage = (
  reason: string,
  request: HttpClientRequest.HttpClientRequest,
  response: ClientResponse.HttpClientResponse,
  description?: string
) => {
  const info = `${response.status} ${request.method} ${request.url}`
  return description ? `${reason}: ${description} (${info})` : `${reason} error (${info})`
}

/**
 * @since 4.0.0
 * @category guards
 */
export const isHttpClientError = (u: unknown): u is HttpClientError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category reason
 */
export class TransportError extends Data.TaggedError("TransportError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly cause?: unknown
  readonly description?: string
}> {
  override get message() {
    return formatRequestMessage(reasonLabel(this._tag), this.request, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export class EncodeError extends Data.TaggedError("EncodeError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly cause?: unknown
  readonly description?: string
}> {
  override get message() {
    return formatRequestMessage(reasonLabel(this._tag), this.request, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export class InvalidUrlError extends Data.TaggedError("InvalidUrlError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly cause?: unknown
  readonly description?: string
}> {
  override get message() {
    return formatRequestMessage(reasonLabel(this._tag), this.request, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export class StatusCodeError extends Data.TaggedError("StatusCodeError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: ClientResponse.HttpClientResponse
  readonly cause?: unknown
  readonly description?: string | undefined
}> {
  override get message() {
    return formatResponseMessage(reasonLabel(this._tag), this.request, this.response, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: ClientResponse.HttpClientResponse
  readonly cause?: unknown
  readonly description?: string | undefined
}> {
  override get message() {
    return formatResponseMessage(reasonLabel(this._tag), this.request, this.response, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export class EmptyBodyError extends Data.TaggedError("EmptyBodyError")<{
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: ClientResponse.HttpClientResponse
  readonly cause?: unknown
  readonly description?: string | undefined
}> {
  override get message() {
    return formatResponseMessage(reasonLabel(this._tag), this.request, this.response, this.description)
  }
}

/**
 * @since 4.0.0
 * @category reason
 */
export type RequestError = TransportError | EncodeError | InvalidUrlError

/**
 * @since 4.0.0
 * @category reason
 */
export type ResponseError = StatusCodeError | DecodeError | EmptyBodyError

/**
 * @since 4.0.0
 * @category reason
 */
export type HttpClientErrorReason = RequestError | ResponseError

/**
 * @since 4.0.0
 * @category error
 */
export class HttpClientError extends Data.TaggedError("HttpClientError")<{
  readonly reason: HttpClientErrorReason
  readonly cause?: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  constructor(props: {
    readonly reason: HttpClientErrorReason
  }) {
    super({
      ...props,
      cause: "cause" in props.reason ? props.reason.cause : undefined
    } as any)
  }

  override get message() {
    return this.reason.message
  }
}
