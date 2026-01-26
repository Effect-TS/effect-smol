/**
 * OpenAI Client module for interacting with OpenAI's API.
 *
 * Provides a type-safe, Effect-based client for OpenAI operations including
 * completions, embeddings, and streaming responses.
 *
 * @since 1.0.0
 */
import * as Array from "effect/Array"
import * as Config from "effect/Config"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual, identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Number from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import * as AiError from "effect/unstable/ai/AiError"
import * as Sse from "effect/unstable/encoding/Sse"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Generated from "./Generated.ts"
import { OpenAiConfig } from "./OpenAiConfig.ts"

// =============================================================================
// Service Interface
// =============================================================================

/**
 * The OpenAI client service interface.
 *
 * @since 1.0.0
 * @category models
 */
export interface Service {
  /**
   * The underlying generated OpenAI client.
   */
  readonly client: Generated.OpenAiClient

  /**
   * Stream requests with SSE parsing.
   */
  readonly streamRequest: <S extends Schema.Top>(
    request: HttpClientRequest.HttpClientRequest,
    schema: S
  ) => Stream.Stream<S["Type"], AiError.AiError, S["DecodingServices"]>

  /**
   * Create a response using the OpenAI responses endpoint.
   */
  readonly createResponse: (
    options: typeof Generated.CreateResponse.Encoded
  ) => Effect.Effect<typeof Generated.Response.Type, AiError.AiError>

  /**
   * Create a streaming response using the OpenAI responses endpoint.
   */
  readonly createResponseStream: (
    options: Omit<typeof Generated.CreateResponse.Encoded, "stream">
  ) => Stream.Stream<typeof Generated.ResponseStreamEvent.Type, AiError.AiError>

  /**
   * Create embeddings using the OpenAI embeddings endpoint.
   */
  readonly createEmbedding: (
    options: typeof Generated.CreateEmbeddingRequest.Encoded
  ) => Effect.Effect<typeof Generated.CreateEmbeddingResponse.Type, AiError.AiError>
}

// =============================================================================
// Context Tag
// =============================================================================

/**
 * Context tag for the OpenAI client service.
 *
 * @since 1.0.0
 * @category context
 */
export class OpenAiClient extends ServiceMap.Service<OpenAiClient, Service>()(
  "@effect/ai-openai/OpenAiClient"
) {}

// =============================================================================
// Error Mapping Utilities
// =============================================================================

const OpenAiErrorBody = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    type: Schema.String,
    param: Schema.optional(Schema.NullOr(Schema.String)),
    code: Schema.optional(Schema.NullOr(Schema.String))
  })
})

const sensitiveHeaders = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "openai-api-key"
])

const redactHeaders = (headers: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key] = sensitiveHeaders.has(key.toLowerCase()) ? "<redacted>" : String(value)
  }
  return result
}

const buildHttpContext = (params: {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response?: HttpClientResponse.HttpClientResponse
  readonly body?: string
}): typeof AiError.HttpContext.Type => ({
  request: {
    method: params.request.method,
    url: params.request.url,
    urlParams: globalThis.Array.from(params.request.urlParams),
    hash: params.request.hash,
    headers: redactHeaders(params.request.headers as Record<string, string>)
  },
  response: Predicate.isNotUndefined(params.response)
    ? {
      status: params.response.status,
      headers: redactHeaders(params.response.headers as Record<string, string>)
    }
    : undefined,
  body: params.body
})

const buildProviderMetadata = (params: {
  readonly errorCode?: string | null
  readonly errorType?: string
  readonly requestId?: string
  readonly raw?: unknown
}): typeof AiError.ProviderMetadata.Type => ({
  name: "OpenAI",
  errorCode: Predicate.isNotNullish(params.errorCode) ? params.errorCode : undefined,
  errorType: params.errorType,
  requestId: params.requestId,
  raw: params.raw
})

const parseRateLimitHeaders = (headers: Record<string, string>) => {
  const retryAfterRaw = headers["retry-after"]
  let retryAfter: Duration.Duration | undefined
  if (Predicate.isNotUndefined(retryAfterRaw)) {
    const parsed = Number.parse(retryAfterRaw)
    if (Predicate.isNotUndefined(parsed)) {
      retryAfter = Duration.seconds(parsed)
    }
  }
  const remainingRaw = headers["x-ratelimit-remaining-requests"]
  const remaining = Predicate.isNotUndefined(remainingRaw) ? Number.parse(remainingRaw) : undefined
  return {
    limit: headers["x-ratelimit-limit-requests"],
    remaining,
    resetRequests: headers["x-ratelimit-reset-requests"],
    resetTokens: headers["x-ratelimit-reset-tokens"],
    retryAfter
  }
}

const mapOpenAiErrorCode = (params: {
  readonly code: string | null | undefined
  readonly type: string
  readonly message: string
  readonly status: number
  readonly headers: Record<string, string>
  readonly provider: typeof AiError.ProviderMetadata.Type
  readonly http: typeof AiError.HttpContext.Type
}): AiError.AiErrorReason => {
  const { code, type, message, status, headers, provider, http } = params
  const rateLimitInfo = parseRateLimitHeaders(headers)

  if (code === "rate_limit_exceeded" || status === 429) {
    return new AiError.RateLimitError({
      limit: rateLimitInfo.limit ?? type,
      remaining: rateLimitInfo.remaining,
      retryAfter: rateLimitInfo.retryAfter,
      provider,
      http
    })
  }
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") {
    return new AiError.QuotaExhaustedError({
      quotaType: code === "insufficient_quota" ? "tokens" : "billing",
      provider,
      http
    })
  }
  if (code === "invalid_api_key" || code === "incorrect_api_key" || status === 401) {
    return new AiError.AuthenticationError({ kind: "InvalidKey", provider, http })
  }
  if (type === "authentication_error") {
    return new AiError.AuthenticationError({ kind: "InvalidKey", provider, http })
  }
  if (type === "permission_error" || status === 403) {
    return new AiError.AuthenticationError({ kind: "InsufficientPermissions", provider, http })
  }
  if (code === "context_length_exceeded" || code === "max_tokens_exceeded") {
    const tokenMatch = message.match(/(\d+)\s*tokens.*?(\d+)/i)
    return new AiError.ContextLengthError({
      maxTokens: tokenMatch ? parseInt(tokenMatch[1], 10) : undefined,
      requestedTokens: tokenMatch ? parseInt(tokenMatch[2], 10) : undefined,
      provider,
      http
    })
  }
  if (code === "model_not_found") {
    const modelMatch = message.match(/model[:\s]+['"]?([^'".\s]+)['"]?/i)
    return new AiError.ModelUnavailableError({
      model: modelMatch ? modelMatch[1] : "unknown",
      kind: "NotFound",
      provider,
      http
    })
  }
  if (code === "model_overloaded") {
    const modelMatch = message.match(/model[:\s]+['"]?([^'".\s]+)['"]?/i)
    return new AiError.ModelUnavailableError({
      model: modelMatch ? modelMatch[1] : "unknown",
      kind: "Overloaded",
      provider,
      http
    })
  }
  if (code === "content_policy_violation" || code === "safety_system") {
    return new AiError.ContentPolicyError({ violationType: code, flaggedInput: true, provider, http })
  }
  if (type === "invalid_request_error" || status === 400) {
    return new AiError.InvalidRequestError({ description: message, provider, http })
  }
  if (type === "server_error" || status >= 500) {
    return new AiError.ProviderInternalError({ provider, http })
  }
  if (status === 408) {
    return new AiError.AiTimeoutError({ phase: "Request", provider, http })
  }
  return new AiError.AiUnknownError({ description: message, provider, http })
}

const mapRequestError = dual<
  (method: string) => (error: HttpClientError.RequestError) => AiError.AiError,
  (error: HttpClientError.RequestError, method: string) => AiError.AiError
>(2, (error, method) =>
  AiError.make({
    module: "OpenAiClient",
    method,
    reason: new AiError.NetworkError({
      kind: "Unknown",
      cause: error
    })
  }))

const mapResponseError = dual<
  (method: string) => (error: HttpClientError.ResponseError) => Effect.Effect<never, AiError.AiError>,
  (error: HttpClientError.ResponseError, method: string) => Effect.Effect<never, AiError.AiError>
>(2, (error, method) =>
  Effect.gen(function*() {
    const response = error.response
    const request = error.request
    const status = response.status
    const headers = response.headers as Record<string, string>

    const bodyResult = yield* Effect.result(response.json)
    const rawBody = Result.isSuccess(bodyResult) ? bodyResult.success : undefined

    const decoded = Schema.decodeUnknownOption(OpenAiErrorBody)(rawBody)
    const requestId = headers["x-request-id"]
    const bodyStr = Predicate.isNotUndefined(rawBody) ? JSON.stringify(rawBody) : undefined
    const http = buildHttpContext({
      request,
      response,
      ...(Predicate.isNotUndefined(bodyStr) ? { body: bodyStr } : {})
    })

    if (Option.isSome(decoded)) {
      const errorBody = decoded.value.error
      const provider = buildProviderMetadata({
        errorCode: errorBody.code ?? null,
        errorType: errorBody.type,
        requestId,
        raw: rawBody
      })
      const reason = mapOpenAiErrorCode({
        code: errorBody.code,
        type: errorBody.type,
        message: errorBody.message,
        status,
        headers,
        provider,
        http
      })
      return yield* AiError.make({ module: "OpenAiClient", method, reason })
    }

    const provider = buildProviderMetadata({ requestId, raw: rawBody })
    const reason = AiError.reasonFromHttpStatus({ status, body: rawBody, http, provider })
    return yield* AiError.make({ module: "OpenAiClient", method, reason })
  }))

const mapSchemaError = dual<
  (method: string) => (error: Schema.SchemaError) => AiError.AiError,
  (error: Schema.SchemaError, method: string) => AiError.AiError
>(2, (error, method) =>
  AiError.make({
    module: "OpenAiClient",
    method,
    reason: AiError.OutputParseError.fromSchemaError({ error })
  }))

// =============================================================================
// Options
// =============================================================================

/**
 * Options for configuring the OpenAI client.
 *
 * @since 1.0.0
 * @category models
 */
export type Options = {
  /**
   * The OpenAI API key.
   */
  readonly apiKey: Redacted.Redacted<string>

  /**
   * The base URL for the OpenAI API.
   * @default "https://api.openai.com/v1"
   */
  readonly apiUrl?: string | undefined

  /**
   * Optional organization ID for multi-org accounts.
   */
  readonly organizationId?: Redacted.Redacted<string> | undefined

  /**
   * Optional project ID for project-scoped requests.
   */
  readonly projectId?: Redacted.Redacted<string> | undefined

  /**
   * Optional transformer for the HTTP client.
   */
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}

// =============================================================================
// Constructor
// =============================================================================

const RedactedOpenAiHeaders = {
  OpenAiOrganization: "OpenAI-Organization",
  OpenAiProject: "OpenAI-Project"
}

/**
 * Creates an OpenAI client service with the given options.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(
  function*(options: Options): Effect.fn.Return<Service, never, HttpClient.HttpClient> {
    const baseClient = yield* HttpClient.HttpClient

    const httpClient = baseClient.pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(options.apiUrl ?? "https://api.openai.com/v1"),
          HttpClientRequest.bearerToken(Redacted.value(options.apiKey)),
          Predicate.isNotUndefined(options.organizationId)
            ? HttpClientRequest.setHeader(
              RedactedOpenAiHeaders.OpenAiOrganization,
              Redacted.value(options.organizationId)
            )
            : identity,
          Predicate.isNotUndefined(options.projectId)
            ? HttpClientRequest.setHeader(
              RedactedOpenAiHeaders.OpenAiProject,
              Redacted.value(options.projectId)
            )
            : identity
        )
      ),
      Predicate.isNotUndefined(options.transformClient)
        ? options.transformClient
        : identity
    )

    const httpClientOk = HttpClient.filterStatusOk(httpClient)

    const client = Generated.make(httpClient, {
      transformClient: Effect.fnUntraced(function*(client) {
        const config = yield* OpenAiConfig.getOrUndefined
        if (Predicate.isNotUndefined(config?.transformClient)) {
          return config.transformClient(client)
        }
        return client
      })
    })

    const streamRequest = <S extends Schema.Top>(
      request: HttpClientRequest.HttpClientRequest,
      schema: S
    ): Stream.Stream<S["Type"], AiError.AiError, S["DecodingServices"]> =>
      httpClientOk.execute(request).pipe(
        Effect.map((response) => response.stream),
        Stream.unwrap,
        Stream.decodeText(),
        Stream.pipeThroughChannel(Sse.decodeSchema(schema)),
        Stream.map((event) => event.data),
        Stream.catchTags({
          // TODO: handle SSE retries
          Retry: (error) => Stream.die(error),
          RequestError: (error) => Stream.fail(mapRequestError(error, "streamRequest")),
          ResponseError: (error) => Stream.unwrap(mapResponseError(error, "streamRequest")),
          SchemaError: (error) => Stream.fail(mapSchemaError(error, "streamRequest"))
        })
      )

    const createResponse = (
      opts: typeof Generated.CreateResponse.Encoded
    ): Effect.Effect<typeof Generated.Response.Type, AiError.AiError> =>
      client.createResponse({ payload: opts }).pipe(
        Effect.catchTags({
          RequestError: (error) => Effect.fail(mapRequestError(error, "createResponse")),
          ResponseError: (error) => mapResponseError(error, "createResponse"),
          SchemaError: (error) => Effect.fail(mapSchemaError(error, "createResponse"))
        })
      )

    const createResponseStream = (
      opts: Omit<typeof Generated.CreateResponse.Encoded, "stream">
    ): Stream.Stream<typeof Generated.ResponseStreamEvent.Type, AiError.AiError> => {
      const request = HttpClientRequest.post("/responses").pipe(
        HttpClientRequest.bodyJsonUnsafe({ ...opts, stream: true })
      )
      return streamRequest(request, Generated.ResponseStreamEvent)
    }

    const createEmbedding = (
      opts: typeof Generated.CreateEmbeddingRequest.Encoded
    ): Effect.Effect<typeof Generated.CreateEmbeddingResponse.Type, AiError.AiError> =>
      client.createEmbedding({ payload: opts }).pipe(
        Effect.catchTags({
          RequestError: (error) => Effect.fail(mapRequestError(error, "createEmbedding")),
          ResponseError: (error) => mapResponseError(error, "createEmbedding"),
          SchemaError: (error) => Effect.fail(mapSchemaError(error, "createEmbedding"))
        })
      )

    return OpenAiClient.of({
      client,
      streamRequest,
      createResponse,
      createResponseStream,
      createEmbedding
    })
  },
  Effect.updateService(
    Headers.CurrentRedactedNames,
    Array.appendAll(Object.values(RedactedOpenAiHeaders))
  )
)

// =============================================================================
// Layers
// =============================================================================

/**
 * Creates a layer for the OpenAI client with the given options.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: Options): Layer.Layer<OpenAiClient, never, HttpClient.HttpClient> =>
  Layer.effect(OpenAiClient, make(options))

/**
 * Creates a layer for the OpenAI client, loading the requisite configuration
 * via Effect's `Config` module.
 *
 * @since 1.0.0
 * @category layers
 */
export const layerConfig = (options?: {
  /**
   * The config value to load for the API key.
   *
   * @default Config.redacted("OPENAI_API_KEY")
   */
  readonly apiKey?: Config.Config<Redacted.Redacted<string>> | undefined

  /**
   * The config value to load for the API URL.
   */
  readonly apiUrl?: Config.Config<string> | undefined

  /**
   * The config value to load for the organization ID.
   */
  readonly organizationId?: Config.Config<Redacted.Redacted<string>> | undefined

  /**
   * The config value to load for the project ID.
   */
  readonly projectId?: Config.Config<Redacted.Redacted<string>> | undefined

  /**
   * Optional transformer for the HTTP client.
   */
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}): Layer.Layer<OpenAiClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(
    OpenAiClient,
    Effect.gen(function*() {
      const apiKey = yield* (options?.apiKey ?? Config.redacted("OPENAI_API_KEY"))
      const apiUrl = Predicate.isNotUndefined(options?.apiUrl)
        ? yield* options.apiUrl :
        undefined
      const organizationId = Predicate.isNotUndefined(options?.organizationId)
        ? yield* options.organizationId
        : undefined
      const projectId = Predicate.isNotUndefined(options?.projectId)
        ? yield* options.projectId :
        undefined
      return yield* make({
        apiKey,
        apiUrl,
        organizationId,
        projectId,
        transformClient: options?.transformClient
      })
    })
  )
