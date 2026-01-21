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
import * as Effect from "effect/Effect"
import { dual, identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as Redacted from "effect/Redacted"
import type * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import * as AiError from "effect/unstable/ai/AiError"
import * as Sse from "effect/unstable/encoding/Sse"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpClient from "effect/unstable/http/HttpClient"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
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
  "effect/ai/openai/OpenAiClient"
) {}

// =============================================================================
// Error Mapping Utilities
// =============================================================================

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
  (method: string) => (error: HttpClientError.ResponseError) => AiError.AiError,
  (error: HttpClientError.ResponseError, method: string) => AiError.AiError
>(2, (error, method) =>
  AiError.make({
    module: "OpenAiClient",
    method,
    reason: AiError.reasonFromHttpStatus({
      status: error.response.status,
      body: error
    })
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
          Retry: (error) => Effect.die(error),
          RequestError: (error) => Stream.fail(mapRequestError(error, "streamRequest")),
          ResponseError: (error) => Stream.fail(mapResponseError(error, "streamRequest")),
          SchemaError: (error) => Stream.fail(mapSchemaError(error, "streamRequest"))
        })
      )

    const createResponse = (
      opts: typeof Generated.CreateResponse.Encoded
    ): Effect.Effect<typeof Generated.Response.Type, AiError.AiError> =>
      client.createResponse({ payload: opts }).pipe(
        Effect.catchTags({
          RequestError: (error) => Effect.fail(mapRequestError(error, "createResponse")),
          ResponseError: (error) => Effect.fail(mapResponseError(error, "createResponse")),
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
          ResponseError: (error) => Effect.fail(mapResponseError(error, "createEmbedding")),
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
export const layerConfig = (options: {
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
      const apiKey = yield* (options.apiKey ?? Config.redacted("OPENAI_API_KEY"))
      const apiUrl = Predicate.isNotUndefined(options.apiUrl)
        ? yield* options.apiUrl :
        undefined
      const organizationId = Predicate.isNotUndefined(options.organizationId)
        ? yield* options.organizationId
        : undefined
      const projectId = Predicate.isNotUndefined(options.projectId)
        ? yield* options.projectId :
        undefined
      return yield* make({
        apiKey,
        apiUrl,
        organizationId,
        projectId,
        transformClient: options.transformClient
      })
    })
  )
