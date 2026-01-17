/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as AiError from "effect/unstable/ai/AiError"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as Generated from "./Generated.ts"
import { OpenAiConfig } from "./OpenAiConfig.ts"

/**
 * @since 1.0.0
 * @category Service
 */
export class OpenAiClient extends ServiceMap.Service<OpenAiClient, {
  readonly client: Generated.OpenAiClient

  // readonly streamRequest: <A, I, R>(
  //   request: HttpClientRequest.HttpClientRequest,
  //   schema: Schema.Schema<A, I, R>
  // ) => Stream.Stream<A, AiError.AiError, R>
  //
  readonly createResponse: (
    options: typeof Generated.CreateResponse.Encoded
  ) => Effect.Effect<Generated.Response, AiError.AiError>
  //
  // readonly createResponseStream: (
  //   options: Omit<typeof Generated.CreateResponse.Encoded, "stream">
  // ) => Stream.Stream<ResponseStreamEvent, AiError.AiError>
  //
  // readonly createEmbedding: (
  //   options: typeof Generated.CreateEmbeddingRequest.Encoded
  // ) => Effect.Effect<Generated.CreateEmbeddingResponse, AiError.AiError>
}>()("@effect/ai-openai/OpenAiClient") {}

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make = Effect.fnUntraced(function*(options: {
  /**
   * The API key to use to communicate with the OpenAi API.
   */
  readonly apiKey?: Redacted.Redacted | undefined
  /**
   * The URL to use to communicate with the OpenAi API.
   */
  readonly apiUrl?: string | undefined
  /**
   * The OpenAi organization identifier to use when communicating with the
   * OpenAi API.
   */
  readonly organizationId?: Redacted.Redacted | undefined
  /**
   * The OpenAi project identifier to use when communicating with the OpenAi
   * API.
   */
  readonly projectId?: Redacted.Redacted | undefined
  /**
   * A method which can be used to transform the underlying `HttpClient` which
   * will be used to communicate with the OpenAi API.
   */
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}) {
  const baseClient = yield* HttpClient.HttpClient
  const httpClient = baseClient.pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.prependUrl(options.apiUrl ?? "https://api.openai.com/v1"),
        options.apiKey ? HttpClientRequest.bearerToken(options.apiKey) : identity,
        options.organizationId !== undefined
          ? HttpClientRequest.setHeader("OpenAI-Organization", Redacted.value(options.organizationId))
          : identity,
        options.projectId !== undefined
          ? HttpClientRequest.setHeader("OpenAI-Project", Redacted.value(options.projectId))
          : identity,
        HttpClientRequest.acceptJson
      )
    ),
    options.transformClient ? options.transformClient : identity
  )

  const httpClientOk = HttpClient.filterStatusOk(httpClient)

  const client = Generated.make(httpClient, {
    transformClient: (client) =>
      OpenAiConfig.getOrUndefined.pipe(
        Effect.map((config) => config?.transformClient ? config.transformClient(client) : client)
      )
  })

  const createResponse = (
    options: typeof Generated.CreateResponse.Encoded
  ): Effect.Effect<Generated.Response, AiError.AiError> =>
    client.createResponse(options).pipe(
      Effect.catchTags({
        // TODO: Enable semantic error mapping when OpenAI package is complete
        // RequestError: (error) =>
        //   Effect.fail(AiError.fromRequestError(
        //     {
        //       operation: "generateText",
        //       provider: "openai",
        //       model: typeof options.model === "string" ? options.model : undefined
        //     },
        //     error
        //   )),
        // ResponseError: (error) =>
        //   AiError.fromResponseError(
        //     {
        //       operation: "generateText",
        //       provider: "openai",
        //       model: typeof options.model === "string" ? options.model : undefined
        //     },
        //     error
        //   ),
        SchemaError: (error) =>
          Effect.fail(AiError.MalformedOutput.fromSchemaError({
            module: "OpenAiClient",
            method: "createResponse",
            error
          }))
      })
    )

  return OpenAiClient.of({
    createResponse
  })
})
