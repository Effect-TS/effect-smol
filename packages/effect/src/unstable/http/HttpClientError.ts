/**
 * @since 4.0.0
 */
import { hasProperty } from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import type * as HttpClientRequest from "./HttpClientRequest.ts"
import type * as ClientResponse from "./HttpClientResponse.ts"

const TypeId = "~effect/http/HttpClientError" as const

const RequestSchema: Schema.declare<HttpClientRequest.HttpClientRequest> = Schema.Any as any
const ResponseSchema: Schema.declare<ClientResponse.HttpClientResponse> = Schema.Any as any

const reasonLabel = (tag: string) => tag.endsWith("Error") ? tag.slice(0, -5) : tag

const formatRequestMessage = (tag: string, description: string | undefined, methodAndUrl: string) =>
  description ? `${tag}: ${description} (${methodAndUrl})` : `${tag} error (${methodAndUrl})`

const formatResponseMessage = (
  tag: string,
  description: string | undefined,
  methodAndUrl: string,
  status: number
) => {
  const info = `${status} ${methodAndUrl}`
  return description ? `${tag}: ${description} (${info})` : `${tag} error (${info})`
}

/**
 * @since 4.0.0
 * @category guards
 */
export const isHttpClientError = (u: unknown): u is HttpClientError => hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category reasons
 */
export class TransportError extends Schema.ErrorClass<TransportError>("effect/http/HttpClientError/TransportError")({
  _tag: Schema.tag("TransportError"),
  request: RequestSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatRequestMessage(reasonLabel(this._tag), this.description, this.methodAndUrl)
  }
}

/**
 * @since 4.0.0
 * @category reasons
 */
export class EncodeError extends Schema.ErrorClass<EncodeError>("effect/http/HttpClientError/EncodeError")({
  _tag: Schema.tag("EncodeError"),
  request: RequestSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatRequestMessage(reasonLabel(this._tag), this.description, this.methodAndUrl)
  }
}

/**
 * @since 4.0.0
 * @category reasons
 */
export class InvalidUrlError extends Schema.ErrorClass<InvalidUrlError>(
  "effect/http/HttpClientError/InvalidUrlError"
)({
  _tag: Schema.tag("InvalidUrlError"),
  request: RequestSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatRequestMessage(reasonLabel(this._tag), this.description, this.methodAndUrl)
  }
}

/**
 * @since 4.0.0
 * @category reasons
 */
export class StatusCodeError extends Schema.ErrorClass<StatusCodeError>(
  "effect/http/HttpClientError/StatusCodeError"
)({
  _tag: Schema.tag("StatusCodeError"),
  request: RequestSchema,
  response: ResponseSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatResponseMessage(
      reasonLabel(this._tag),
      this.description,
      this.methodAndUrl,
      this.response.status
    )
  }
}

/**
 * @since 4.0.0
 * @category reasons
 */
export class DecodeError extends Schema.ErrorClass<DecodeError>(
  "effect/http/HttpClientError/DecodeError"
)({
  _tag: Schema.tag("DecodeError"),
  request: RequestSchema,
  response: ResponseSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatResponseMessage(
      reasonLabel(this._tag),
      this.description,
      this.methodAndUrl,
      this.response.status
    )
  }
}

/**
 * @since 4.0.0
 * @category reasons
 */
export class EmptyBodyError extends Schema.ErrorClass<EmptyBodyError>(
  "effect/http/HttpClientError/EmptyBodyError"
)({
  _tag: Schema.tag("EmptyBodyError"),
  request: RequestSchema,
  response: ResponseSchema,
  description: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect)
}) {
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
    return formatResponseMessage(
      reasonLabel(this._tag),
      this.description,
      this.methodAndUrl,
      this.response.status
    )
  }
}

/**
 * @since 4.0.0
 * @category models
 */
export type HttpClientErrorReason =
  | TransportError
  | EncodeError
  | InvalidUrlError
  | StatusCodeError
  | DecodeError
  | EmptyBodyError

/**
 * @since 4.0.0
 * @category schemas
 */
export const HttpClientErrorReason: Schema.Union<[
  typeof TransportError,
  typeof EncodeError,
  typeof InvalidUrlError,
  typeof StatusCodeError,
  typeof DecodeError,
  typeof EmptyBodyError
]> = Schema.Union([
  TransportError,
  EncodeError,
  InvalidUrlError,
  StatusCodeError,
  DecodeError,
  EmptyBodyError
])

/**
 * @since 4.0.0
 * @category models
 */
export type RequestError = TransportError | EncodeError | InvalidUrlError

/**
 * @since 4.0.0
 * @category models
 */
export type ResponseError = StatusCodeError | DecodeError | EmptyBodyError

/**
 * @since 4.0.0
 * @category error
 */
export class HttpClientError extends Schema.ErrorClass<HttpClientError>("effect/http/HttpClientError")({
  _tag: Schema.tag("HttpClientError"),
  reason: HttpClientErrorReason
}) {
  /**
   * @since 4.0.0
   */
  readonly [TypeId] = TypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return this.reason.message
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = (params: {
  readonly reason: HttpClientErrorReason
}): HttpClientError => new HttpClientError(params)
