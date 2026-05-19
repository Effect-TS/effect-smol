/**
 * Perplexity Client module for interacting with Perplexity's API.
 *
 * Provides a type-safe, Effect-based client for Perplexity operations.
 *
 * @since 4.0.0
 */
import * as Array from "effect/Array"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Redactable from "effect/Redactable"
import * as Redacted from "effect/Redacted"
import type * as Schema from "effect/Schema"
import * as AiError from "effect/unstable/ai/AiError"
import type * as Response from "effect/unstable/ai/Response"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { PerplexityConfig } from "./PerplexityConfig.ts"

// =============================================================================
// Service Interface
// =============================================================================

/**
 * The Perplexity client service interface.
 *
 * @category models
 * @since 4.0.0
 */
export interface Service {
  /**
   * The underlying HTTP client capable of communicating with the Perplexity
   * API. Pre-configured with authentication and the API base URL.
   */
  readonly httpClient: HttpClient.HttpClient

  /**
   * Executes a request and decodes the JSON response body using the supplied
   * schema. HTTP and schema errors are mapped to `AiError`.
   */
  readonly executeRequest: <S extends Schema.Top>(
    request: HttpClientRequest.HttpClientRequest,
    schema: S,
    method: string
  ) => Effect.Effect<S["Type"], AiError.AiError, S["DecodingServices"]>
}

// =============================================================================
// Service Identifier
// =============================================================================

/**
 * Service identifier for the Perplexity client.
 *
 * @category services
 * @since 4.0.0
 */
export class PerplexityClient extends Context.Service<PerplexityClient, Service>()(
  "@effect/ai-perplexity/PerplexityClient"
) {}

// =============================================================================
// Options
// =============================================================================

/**
 * Configuration options for creating a Perplexity client.
 *
 * @category models
 * @since 4.0.0
 */
export type Options = {
  /**
   * The Perplexity API key for authentication.
   */
  readonly apiKey?: Redacted.Redacted<string> | undefined

  /**
   * The base URL for the Perplexity API.
   *
   * @default "https://api.perplexity.ai"
   */
  readonly apiUrl?: string | undefined

  /**
   * Optional transformer for the underlying HTTP client.
   */
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}

// =============================================================================
// Constructor
// =============================================================================

const RedactedPerplexityHeaders = {
  Authorization: "authorization"
}

/**
 * Creates a Perplexity client service with the given options.
 *
 * @category constructors
 * @since 4.0.0
 */
export const make = Effect.fnUntraced(
  function*(options: Options): Effect.fn.Return<Service, never, HttpClient.HttpClient> {
    const baseClient = yield* HttpClient.HttpClient

    const httpClient = baseClient.pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(options.apiUrl ?? "https://api.perplexity.ai"),
          Predicate.isNotUndefined(options.apiKey)
            ? HttpClientRequest.bearerToken(options.apiKey)
            : identity,
          HttpClientRequest.acceptJson
        )
      ),
      Predicate.isNotUndefined(options.transformClient)
        ? options.transformClient
        : identity
    )

    const executeRequest: Service["executeRequest"] = (request, schema, method) =>
      Effect.gen(function*() {
        const config = yield* PerplexityConfig.getOrUndefined
        const client = Predicate.isNotUndefined(config?.transformClient)
          ? config.transformClient(httpClient)
          : httpClient
        return yield* HttpClient.filterStatusOk(client).execute(request).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
          Effect.catchTags({
            HttpClientError: (error) => mapHttpClientError(error, method),
            SchemaError: (error) => Effect.fail(mapSchemaError(error, method))
          })
        )
      })

    return PerplexityClient.of({
      httpClient,
      executeRequest
    })
  },
  Effect.updateService(
    Headers.CurrentRedactedNames,
    Array.appendAll(Object.values(RedactedPerplexityHeaders))
  )
)

// =============================================================================
// Layers
// =============================================================================

/**
 * Creates a layer for the Perplexity client with the given options.
 *
 * @category layers
 * @since 4.0.0
 */
export const layer = (options: Options): Layer.Layer<PerplexityClient, never, HttpClient.HttpClient> =>
  Layer.effect(PerplexityClient, make(options))

/**
 * Creates a layer for the Perplexity client, loading configuration via Effect's
 * `Config` module.
 *
 * @category layers
 * @since 4.0.0
 */
export const layerConfig = (options?: {
  /**
   * The Perplexity API key config value.
   *
   * Defaults to `PERPLEXITY_API_KEY`, falling back to `PPLX_API_KEY`.
   */
  readonly apiKey?: Config.Config<Redacted.Redacted<string> | undefined> | undefined

  /**
   * The Perplexity API URL config value.
   *
   * Defaults to `PERPLEXITY_API_URL`, falling back to
   * `https://api.perplexity.ai`.
   */
  readonly apiUrl?: Config.Config<string> | undefined

  /**
   * Optional transformer for the underlying HTTP client.
   */
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}): Layer.Layer<PerplexityClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(
    PerplexityClient,
    Effect.gen(function*() {
      const apiKey = Predicate.isNotUndefined(options?.apiKey)
        ? yield* options.apiKey
        : yield* Config.redacted("PERPLEXITY_API_KEY").pipe(
          Config.orElse(() => Config.redacted("PPLX_API_KEY"))
        )
      const apiUrl = Predicate.isNotUndefined(options?.apiUrl)
        ? yield* options.apiUrl
        : yield* Config.string("PERPLEXITY_API_URL").pipe(
          Config.withDefault("https://api.perplexity.ai")
        )
      return yield* make({
        apiKey,
        apiUrl,
        transformClient: options?.transformClient
      })
    })
  )

// =============================================================================
// Error Mapping
// =============================================================================

const mapSchemaError = (error: Schema.SchemaError, method: string): AiError.AiError =>
  AiError.make({
    module: "PerplexityClient",
    method,
    reason: AiError.InvalidOutputError.fromSchemaError(error)
  })

const mapHttpClientError = (
  error: HttpClientError.HttpClientError,
  method: string
): Effect.Effect<never, AiError.AiError> => {
  const reason = error.reason
  switch (reason._tag) {
    case "TransportError":
    case "EncodeError":
    case "InvalidUrlError": {
      return Effect.fail(AiError.make({
        module: "PerplexityClient",
        method,
        reason: new AiError.NetworkError({
          reason: reason._tag,
          description: reason.description,
          request: buildHttpRequestDetails(reason.request)
        })
      }))
    }
    case "StatusCodeError": {
      return mapStatusCodeError(reason, method)
    }
    case "DecodeError": {
      return Effect.fail(AiError.make({
        module: "PerplexityClient",
        method,
        reason: new AiError.InvalidOutputError({
          description: reason.description ?? "Failed to decode response"
        })
      }))
    }
    case "EmptyBodyError": {
      return Effect.fail(AiError.make({
        module: "PerplexityClient",
        method,
        reason: new AiError.InvalidOutputError({
          description: reason.description ?? "Response body was empty"
        })
      }))
    }
  }
}

const mapStatusCodeError = Effect.fnUntraced(function*(
  error: HttpClientError.StatusCodeError,
  method: string
) {
  const body = yield* Effect.option(error.response.text)
  const description = Option.isSome(body) && body.value.length > 0
    ? body.value
    : error.description
  return yield* AiError.make({
    module: "PerplexityClient",
    method,
    reason: AiError.reasonFromHttpStatus({
      status: error.response.status,
      description,
      http: buildHttpContext({
        request: error.request,
        response: error.response,
        body: description
      })
    })
  })
})

const buildHttpRequestDetails = (
  request: HttpClientRequest.HttpClientRequest
): typeof Response.HttpRequestDetails.Type => ({
  method: request.method,
  url: request.url,
  urlParams: globalThis.Array.from(request.urlParams),
  hash: Option.getOrUndefined(request.hash),
  headers: Redactable.redact(request.headers) as Record<string, string>
})

const buildHttpContext = (params: {
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response?: HttpClientResponse.HttpClientResponse | undefined
  readonly body?: string | undefined
}): typeof AiError.HttpContext.Type => ({
  request: buildHttpRequestDetails(params.request),
  response: Predicate.isNotUndefined(params.response)
    ? {
      status: params.response.status,
      headers: Redactable.redact(params.response.headers) as Record<string, string>
    }
    : undefined,
  body: params.body
})
