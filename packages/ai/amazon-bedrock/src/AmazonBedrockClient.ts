/**
 * @since 1.0.0
 */
import { AwsV4Signer } from "aws4fetch"
import * as Arr from "effect/Array"
import type * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as Redacted from "effect/Redacted"
import type * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import type * as AiError from "effect/unstable/ai/AiError"
import * as Headers from "effect/unstable/http/Headers"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import { AmazonBedrockConfig } from "./AmazonBedrockConfig.ts"
import type { ConverseRequest } from "./AmazonBedrockSchema.ts"
import { ConverseResponse, ConverseResponseStreamEvent } from "./AmazonBedrockSchema.ts"
import * as EventStreamEncoding from "./EventStreamEncoding.ts"
import * as Errors from "./internal/errors.ts"

const RedactedBedrockHeaders = {
  SecurityToken: "X-Amz-Security-Token"
}

/**
 * @since 1.0.0
 * @category services
 */
export class AmazonBedrockClient extends Context.Service<AmazonBedrockClient, Service>()(
  "@effect/ai-amazon-bedrock/AmazonBedrockClient"
) {}

/**
 * @since 1.0.0
 * @category models
 */
export interface Service {
  readonly client: Client

  readonly streamRequest: <A>(
    request: HttpClientRequest.HttpClientRequest,
    schema: Schema.Schema<A>
  ) => Stream.Stream<A, AiError.AiError>

  readonly converse: (options: {
    readonly params?: { "anthropic-beta"?: string | undefined } | undefined
    readonly payload: typeof ConverseRequest.Encoded
  }) => Effect.Effect<ConverseResponse, AiError.AiError>

  readonly converseStream: (options: {
    readonly params?: { "anthropic-beta"?: string | undefined } | undefined
    readonly payload: typeof ConverseRequest.Encoded
  }) => Stream.Stream<ConverseResponseStreamEvent, AiError.AiError>
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(
  function*(options: {
    readonly apiUrl?: string | undefined
    readonly accessKeyId: string
    readonly secretAccessKey: Redacted.Redacted<string>
    readonly sessionToken?: Redacted.Redacted<string> | undefined
    readonly region?: string | undefined
    readonly transformClient?: (
      client: HttpClient.HttpClient
    ) => HttpClient.HttpClient
  }) {
    const region = options.region ?? "us-east-1"

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(options.apiUrl ?? `https://bedrock-runtime.${region}.amazonaws.com`),
          HttpClientRequest.acceptJson
        )
      ),
      HttpClient.mapRequestEffect(Effect.fnUntraced(function*(request) {
        const originalHeaders = request.headers
        const signer = new AwsV4Signer({
          service: "bedrock",
          url: request.url,
          method: request.method,
          headers: Object.entries(originalHeaders),
          body: prepareBody(request.body),
          region,
          accessKeyId: options.accessKeyId,
          secretAccessKey: Redacted.value(options.secretAccessKey),
          ...(options.sessionToken ? { sessionToken: Redacted.value(options.sessionToken) } : {})
        })
        const { headers: signedHeaders } = yield* Effect.promise(() => signer.sign())
        const headers = Headers.merge(originalHeaders, Headers.fromInput(signedHeaders))
        return HttpClientRequest.setHeaders(request, headers)
      })),
      options.transformClient ? options.transformClient : identity
    )

    const httpClientOk = HttpClient.filterStatusOk(httpClient)

    const client = makeClient(httpClient, {
      transformClient: (client) =>
        AmazonBedrockConfig.getOrUndefined.pipe(
          Effect.map((config) => config?.transformClient ? config.transformClient(client) : client)
        )
    })

    const converse: Service["converse"] = Effect.fnUntraced(
      function*(request) {
        return yield* client.converse(request).pipe(
          Effect.catchTags({
            HttpClientError: (error: HttpClientError.HttpClientError) => Errors.mapHttpClientError(error, "converse"),
            SchemaError: (error: Schema.SchemaError) => Effect.fail(Errors.mapSchemaError(error, "converse"))
          })
        )
      }
    )

    const streamRequest = <A>(
      request: HttpClientRequest.HttpClientRequest,
      schema: Schema.Schema<A>
    ): Stream.Stream<A, AiError.AiError> =>
      httpClientOk.execute(request).pipe(
        Effect.map((r) => r.stream),
        Stream.unwrap,
        Stream.pipeThroughChannel(EventStreamEncoding.makeChannel(schema)),
        Stream.catchTags({
          HttpClientError: (error: HttpClientError.HttpClientError) =>
            Stream.unwrap(Errors.mapHttpClientError(error, "streamRequest")),
          SchemaError: (error: Schema.SchemaError) => Stream.fail(Errors.mapSchemaError(error, "streamRequest"))
        })
      ) as any

    const converseStream: Service["converseStream"] = (options) => {
      const { modelId, ...body } = options.payload
      const request = HttpClientRequest.post(`/model/${modelId}/converse-stream`, {
        headers: Headers.fromInput({
          "anthropic-beta": options.params?.["anthropic-beta"]
        }),
        body: HttpBody.jsonUnsafe(body)
      })
      return streamRequest(request, ConverseResponseStreamEvent)
    }

    return AmazonBedrockClient.of({
      client,
      streamRequest,
      converse,
      converseStream
    })
  },
  Effect.updateService(
    Headers.CurrentRedactedNames,
    Arr.appendAll(Object.values(RedactedBedrockHeaders))
  )
)

/**
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: {
  readonly apiUrl?: string | undefined
  readonly accessKeyId: string
  readonly secretAccessKey: Redacted.Redacted<string>
  readonly sessionToken?: Redacted.Redacted<string> | undefined
  readonly region?: string | undefined
  readonly transformClient?: (
    client: HttpClient.HttpClient
  ) => HttpClient.HttpClient
}): Layer.Layer<AmazonBedrockClient, never, HttpClient.HttpClient> => Layer.effect(AmazonBedrockClient, make(options))

/**
 * @since 1.0.0
 * @category layers
 */
export const layerConfig = (
  options: {
    readonly apiUrl?: Config.Config<string> | undefined
    readonly accessKeyId: Config.Config<string>
    readonly secretAccessKey: Config.Config<Redacted.Redacted>
    readonly sessionToken?: Config.Config<Redacted.Redacted> | undefined
    readonly region?: Config.Config<string> | undefined
    readonly transformClient?: (
      client: HttpClient.HttpClient
    ) => HttpClient.HttpClient
  }
): Layer.Layer<AmazonBedrockClient, Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(
    AmazonBedrockClient,
    Effect.gen(function*() {
      const apiUrl = Predicate.isNotUndefined(options.apiUrl)
        ? yield* options.apiUrl
        : undefined
      const accessKeyId = yield* options.accessKeyId
      const secretAccessKey = yield* options.secretAccessKey
      const sessionToken = Predicate.isNotUndefined(options.sessionToken)
        ? yield* options.sessionToken
        : undefined
      const region = Predicate.isNotUndefined(options.region)
        ? yield* options.region
        : undefined
      return yield* make({
        apiUrl,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        region,
        ...(options.transformClient ? { transformClient: options.transformClient } : undefined)
      })
    })
  )

// =============================================================================
// Client
// =============================================================================

/**
 * @since 1.0.0
 * @category models
 */
export interface Client {
  readonly converse: (options: {
    readonly params?: { "anthropic-beta"?: string | undefined } | undefined
    readonly payload: typeof ConverseRequest.Encoded
  }) => Effect.Effect<typeof ConverseResponse.Type, HttpClientError.HttpClientError | Schema.SchemaError>
}

const makeClient = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  }
): Client => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.StatusCodeError({
              request: response.request,
              response,
              description: typeof description === "string" ? description : JSON.stringify(description)
            })
          })
        )
    )
  const withResponse: <A, E, R>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E, R>
  ) => (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<any, any, any> = options.transformClient
    ? (f) => (request) =>
      Effect.flatMap(
        Effect.flatMap(options.transformClient!(httpClient), (client) => client.execute(request)),
        f
      )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)
  const decodeSuccess = <T>(schema: Schema.Schema<T>) => (response: HttpClientResponse.HttpClientResponse) =>
    HttpClientResponse.schemaBodyJson(schema)(response)
  return {
    converse: ({ params, payload: { modelId, ...payload } }) =>
      HttpClientRequest.post(`/model/${modelId}/converse`).pipe(
        HttpClientRequest.setHeaders({
          "anthropic-beta": params?.["anthropic-beta"] ?? undefined
        }),
        HttpClientRequest.bodyJsonUnsafe(payload),
        withResponse(HttpClientResponse.matchStatus({
          "2xx": decodeSuccess(ConverseResponse),
          orElse: unexpectedStatus
        }))
      ) as any
  }
}

const prepareBody = (body: HttpBody.HttpBody): string => {
  switch (body._tag) {
    case "Raw":
    case "Uint8Array": {
      if (typeof body.body === "string") {
        return body.body
      }
      if (body.body instanceof Uint8Array) {
        return new TextDecoder().decode(body.body)
      }
      if (body.body instanceof ArrayBuffer) {
        return new TextDecoder().decode(body.body)
      }
      return JSON.stringify(body.body)
    }
  }
  throw new Error("Unsupported HttpBody: " + body._tag)
}
