/**
 * @since 1.0.0
 */
import * as Array from "effect/Array"
import type * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import type * as AiError from "effect/unstable/ai/AiError"
import * as Sse from "effect/unstable/encoding/Sse"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as Errors from "./internal/errors.ts"
import { OpenAiConfig } from "./OpenAiConfig.ts"
import * as OpenAiSchema from "./OpenAiSchema.ts"

/**
 * @since 1.0.0
 * @category models
 */
export interface Service {
  readonly client: HttpClient.HttpClient
  readonly createResponse: (
    options: typeof OpenAiSchema.CreateResponseRequestJson.Encoded
  ) => Effect.Effect<
    [body: typeof OpenAiSchema.CreateResponse200.Type, response: HttpClientResponse.HttpClientResponse],
    AiError.AiError
  >
  readonly createResponseStream: (
    options: Omit<typeof OpenAiSchema.CreateResponseRequestJson.Encoded, "stream">
  ) => Effect.Effect<
    [
      response: HttpClientResponse.HttpClientResponse,
      stream: Stream.Stream<typeof OpenAiSchema.CreateResponse200Sse.Type, AiError.AiError>
    ],
    AiError.AiError
  >
  readonly createEmbedding: (
    options: typeof OpenAiSchema.CreateEmbeddingRequestJson.Encoded
  ) => Effect.Effect<typeof OpenAiSchema.CreateEmbedding200.Type, AiError.AiError>
}

/**
 * @since 1.0.0
 * @category service
 */
export class OpenAiClient extends ServiceMap.Service<OpenAiClient, Service>()(
  "@effect/ai-openai-compat/OpenAiClient"
) {}

/**
 * @since 1.0.0
 * @category models
 */
export type Options = {
  readonly apiKey?: Redacted.Redacted<string> | undefined
  readonly apiUrl?: string | undefined
  readonly organizationId?: Redacted.Redacted<string> | undefined
  readonly projectId?: Redacted.Redacted<string> | undefined
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}

const RedactedOpenAiHeaders = {
  OpenAiOrganization: "OpenAI-Organization",
  OpenAiProject: "OpenAI-Project"
}

/**
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
          Predicate.isNotUndefined(options.apiKey)
            ? HttpClientRequest.bearerToken(Redacted.value(options.apiKey))
            : identity,
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
            : identity,
          HttpClientRequest.acceptJson
        )
      ),
      Predicate.isNotUndefined(options.transformClient)
        ? options.transformClient
        : identity
    )

    const resolveHttpClient = Effect.map(
      OpenAiConfig.getOrUndefined,
      (config) =>
        Predicate.isNotUndefined(config?.transformClient)
          ? config.transformClient(httpClient)
          : httpClient
    )

    const createResponse = (
      payload: typeof OpenAiSchema.CreateResponseRequestJson.Encoded
    ): Effect.Effect<
      [body: typeof OpenAiSchema.CreateResponse200.Type, response: HttpClientResponse.HttpClientResponse],
      AiError.AiError
    > =>
      Effect.flatMap(resolveHttpClient, (client) =>
        HttpClient.filterStatusOk(client)
          .execute(
            HttpClientRequest.post("/responses").pipe(
              HttpClientRequest.bodyJsonUnsafe(payload)
            )
          )
          .pipe(
            Effect.flatMap((response) =>
              HttpClientResponse.schemaBodyJson(OpenAiSchema.CreateResponse200)(response).pipe(
                Effect.map(
                  (
                    body
                  ): [typeof OpenAiSchema.CreateResponse200.Type, HttpClientResponse.HttpClientResponse] => [
                    body,
                    response
                  ]
                )
              )
            ),
            Effect.catchTags({
              HttpClientError: (error) => Errors.mapHttpClientError(error, "createResponse"),
              SchemaError: (error) => Effect.fail(Errors.mapSchemaError(error, "createResponse"))
            })
          ))

    const SseEvent = Schema.Struct({
      ...Sse.EventEncoded.fields,
      data: OpenAiSchema.CreateResponse200Sse
    })

    const buildResponseStream = (
      response: HttpClientResponse.HttpClientResponse
    ): [
      HttpClientResponse.HttpClientResponse,
      Stream.Stream<typeof OpenAiSchema.CreateResponse200Sse.Type, AiError.AiError>
    ] => {
      const stream = response.stream.pipe(
        Stream.decodeText(),
        Stream.pipeThroughChannel(Sse.decodeSchema(SseEvent)),
        Stream.takeUntil((event) =>
          event.data.type === "response.completed" ||
          event.data.type === "response.incomplete" ||
          event.data.type === "response.failed"
        ),
        Stream.map((event) => event.data),
        Stream.catchTags({
          Retry: (error) => Stream.die(error),
          HttpClientError: (error) => Stream.fromEffect(Errors.mapHttpClientError(error, "createResponseStream")),
          SchemaError: (error) => Stream.fail(Errors.mapSchemaError(error, "createResponseStream"))
        })
      ) as any
      return [response, stream]
    }

    const createResponseStream: Service["createResponseStream"] = (payload) =>
      Effect.flatMap(resolveHttpClient, (client) =>
        HttpClient.filterStatusOk(client)
          .execute(
            HttpClientRequest.post("/responses").pipe(
              HttpClientRequest.bodyJsonUnsafe({ ...payload, stream: true })
            )
          )
          .pipe(
            Effect.map(buildResponseStream),
            Effect.catchTag(
              "HttpClientError",
              (error) => Errors.mapHttpClientError(error, "createResponseStream")
            )
          ))

    const createEmbedding = (
      payload: typeof OpenAiSchema.CreateEmbeddingRequestJson.Encoded
    ): Effect.Effect<typeof OpenAiSchema.CreateEmbedding200.Type, AiError.AiError> =>
      Effect.flatMap(resolveHttpClient, (client) =>
        HttpClient.filterStatusOk(client)
          .execute(
            HttpClientRequest.post("/embeddings").pipe(
              HttpClientRequest.bodyJsonUnsafe(payload)
            )
          )
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(OpenAiSchema.CreateEmbedding200)),
            Effect.catchTags({
              HttpClientError: (error) => Errors.mapHttpClientError(error, "createEmbedding"),
              SchemaError: (error) => Effect.fail(Errors.mapSchemaError(error, "createEmbedding"))
            })
          ))

    return OpenAiClient.of({
      client: httpClient,
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

/**
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: Options): Layer.Layer<OpenAiClient, never, HttpClient.HttpClient> =>
  Layer.effect(OpenAiClient, make(options))

/**
 * @since 1.0.0
 * @category layers
 */
export const layerConfig = (options?: {
  readonly apiKey?: Config.Config<Redacted.Redacted<string>> | undefined
  readonly apiUrl?: Config.Config<string> | undefined
  readonly organizationId?: Config.Config<Redacted.Redacted<string>> | undefined
  readonly projectId?: Config.Config<Redacted.Redacted<string>> | undefined
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}): Layer.Layer<OpenAiClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(
    OpenAiClient,
    Effect.gen(function*() {
      const apiKey = Predicate.isNotUndefined(options?.apiKey)
        ? yield* options.apiKey :
        undefined
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
