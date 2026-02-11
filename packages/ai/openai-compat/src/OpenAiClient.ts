/**
 * @since 1.0.0
 */
import * as Array from "effect/Array"
import type * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import { identity, pipe } from "effect/Function"
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

/**
 * @since 1.0.0
 * @category models
 */
export interface Service {
  readonly client: HttpClient.HttpClient
  readonly createResponse: (
    options: CreateResponseRequestJson
  ) => Effect.Effect<
    [body: CreateResponse200, response: HttpClientResponse.HttpClientResponse],
    AiError.AiError
  >
  readonly createResponseStream: (
    options: Omit<CreateResponseRequestJson, "stream">
  ) => Effect.Effect<
    [
      response: HttpClientResponse.HttpClientResponse,
      stream: Stream.Stream<CreateResponse200Sse, AiError.AiError>
    ],
    AiError.AiError
  >
  readonly createEmbedding: (
    options: CreateEmbeddingRequestJson
  ) => Effect.Effect<CreateEmbedding200, AiError.AiError>
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

    const decodeResponse = HttpClientResponse.schemaBodyJson(ChatCompletionResponse)

    const createResponse = (
      payload: CreateResponseRequestJson
    ): Effect.Effect<
      [body: CreateResponse200, response: HttpClientResponse.HttpClientResponse],
      AiError.AiError
    > =>
      Effect.flatMap(resolveHttpClient, (client) =>
        pipe(
          HttpClientRequest.post("/chat/completions"),
          HttpClientRequest.bodyJsonUnsafe(toChatCompletionsRequest(payload, false)),
          HttpClient.filterStatusOk(client).execute,
          Effect.flatMap((response) =>
            Effect.map(decodeResponse(response), (
              body
            ): [CreateResponse200, HttpClientResponse.HttpClientResponse] => [
              fromChatCompletion(body),
              response
            ])
          ),
          Effect.catchTags({
            HttpClientError: (error) => Errors.mapHttpClientError(error, "createResponse"),
            SchemaError: (error) => Effect.fail(Errors.mapSchemaError(error, "createResponse"))
          })
        ))

    const buildResponseStream = (
      response: HttpClientResponse.HttpClientResponse
    ): [
      HttpClientResponse.HttpClientResponse,
      Stream.Stream<CreateResponse200Sse, AiError.AiError>
    ] => {
      const toEvents = makeChatStreamEventAdapter()
      const stream = response.stream.pipe(
        Stream.decodeText(),
        Stream.pipeThroughChannel(Sse.decode()),
        Stream.flatMap((event) => {
          const data = decodeChatCompletionSseData(event.data)
          return Stream.fromIterable(Predicate.isNotUndefined(data) ? toEvents(data) : [])
        }),
        Stream.takeUntil((event) =>
          event.type === "response.completed" ||
          event.type === "response.incomplete" ||
          event.type === "response.failed"
        ),
        Stream.catchTags({
          Retry: (error) => Stream.die(error),
          HttpClientError: (error) => Stream.fromEffect(Errors.mapHttpClientError(error, "createResponseStream"))
        })
      ) as any
      return [response, stream]
    }

    const createResponseStream: Service["createResponseStream"] = (payload) =>
      Effect.flatMap(resolveHttpClient, (client) =>
        pipe(
          HttpClientRequest.post("/chat/completions"),
          HttpClientRequest.bodyJsonUnsafe(toChatCompletionsRequest(payload, true)),
          HttpClient.filterStatusOk(client).execute,
          Effect.map(buildResponseStream),
          Effect.catchTag(
            "HttpClientError",
            (error) => Errors.mapHttpClientError(error, "createResponseStream")
          )
        ))

    const decodeEmbedding = HttpClientResponse.schemaBodyJson(CreateEmbeddingResponseSchema)

    const createEmbedding = (
      payload: CreateEmbeddingRequestJson
    ): Effect.Effect<CreateEmbedding200, AiError.AiError> =>
      Effect.flatMap(resolveHttpClient, (client) =>
        pipe(
          HttpClientRequest.post("/embeddings"),
          HttpClientRequest.bodyJsonUnsafe(payload),
          HttpClient.filterStatusOk(client).execute,
          Effect.flatMap(decodeEmbedding),
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

type JsonObject = { readonly [x: string]: Schema.Json }

/**
 * @since 1.0.0
 */
export type ModelIdsShared = string
/**
 * @since 1.0.0
 */
export type ModelIdsResponses = string

/**
 * @since 1.0.0
 */
export type IncludeEnum =
  | "message.input_image.image_url"
  | "reasoning.encrypted_content"
  | "message.output_text.logprobs"

/**
 * @since 1.0.0
 */
export type MessageStatus = "in_progress" | "completed" | "incomplete"

type InputTextContent = {
  readonly type: "input_text"
  readonly text: string
}

type InputImageContent = {
  readonly type: "input_image"
  readonly image_url?: string | null | undefined
  readonly file_id?: string | null | undefined
  readonly detail?: "low" | "high" | "auto" | null | undefined
}

type InputFileContent = {
  readonly type: "input_file"
  readonly file_id?: string | null | undefined
  readonly filename?: string | undefined
  readonly file_url?: string | undefined
  readonly file_data?: string | undefined
}

/**
 * @since 1.0.0
 */
export type InputContent = InputTextContent | InputImageContent | InputFileContent

/**
 * @since 1.0.0
 */
export type SummaryTextContent = {
  readonly type: "summary_text"
  readonly text: string
}

type ReasoningTextContent = {
  readonly type: "reasoning_text"
  readonly text: string
}

type RefusalContent = {
  readonly type: "refusal"
  readonly refusal: string
}

type TextContent = {
  readonly type: "text"
  readonly text: string
}

type ComputerScreenshotContent = {
  readonly type: "computer_screenshot"
  readonly image_url: string | null
  readonly file_id: string | null
}

type FileCitationAnnotation = {
  readonly type: "file_citation"
  readonly file_id: string
  readonly index: number
  readonly filename: string
}

type UrlCitationAnnotation = {
  readonly type: "url_citation"
  readonly url: string
  readonly start_index: number
  readonly end_index: number
  readonly title: string
}

type ContainerFileCitationAnnotation = {
  readonly type: "container_file_citation"
  readonly container_id: string
  readonly file_id: string
  readonly start_index: number
  readonly end_index: number
  readonly filename: string
}

type FilePathAnnotation = {
  readonly type: "file_path"
  readonly file_id: string
  readonly index: number
}

/**
 * @since 1.0.0
 */
export type Annotation =
  | FileCitationAnnotation
  | UrlCitationAnnotation
  | ContainerFileCitationAnnotation
  | FilePathAnnotation

type OutputTextContent = {
  readonly type: "output_text"
  readonly text: string
  readonly annotations?: ReadonlyArray<Annotation> | undefined
  readonly logprobs?: ReadonlyArray<unknown> | undefined
}

type OutputMessageContent =
  | InputTextContent
  | OutputTextContent
  | TextContent
  | SummaryTextContent
  | ReasoningTextContent
  | RefusalContent
  | InputImageContent
  | ComputerScreenshotContent
  | InputFileContent

type OutputMessage = {
  readonly id: string
  readonly type: "message"
  readonly role: "assistant"
  readonly content: ReadonlyArray<OutputMessageContent>
  readonly status: MessageStatus
}

/**
 * @since 1.0.0
 */
export type ReasoningItem = {
  readonly type: "reasoning"
  readonly id: string
  readonly encrypted_content?: string | null | undefined
  readonly summary: ReadonlyArray<SummaryTextContent>
  readonly content?: ReadonlyArray<ReasoningTextContent> | undefined
  readonly status?: MessageStatus | undefined
}

type FunctionCall = {
  readonly id?: string | undefined
  readonly type: "function_call"
  readonly call_id: string
  readonly name: string
  readonly arguments: string
  readonly status?: MessageStatus | undefined
}

type FunctionCallOutput = {
  readonly id?: string | null | undefined
  readonly call_id: string
  readonly type: "function_call_output"
  readonly output: string | ReadonlyArray<InputTextContent | InputImageContent | InputFileContent>
  readonly status?: MessageStatus | null | undefined
}

type CustomToolCall = {
  readonly type: "custom_tool_call"
  readonly id?: string | undefined
  readonly call_id: string
  readonly name: string
  readonly input: string
}

type CustomToolCallOutput = {
  readonly type: "custom_tool_call_output"
  readonly id?: string | undefined
  readonly call_id: string
  readonly output: string | ReadonlyArray<InputTextContent | InputImageContent | InputFileContent>
}

type ItemReference = {
  readonly type?: "item_reference" | null | undefined
  readonly id: string
}

/**
 * @since 1.0.0
 */
export type InputItem =
  | {
    readonly role: "user" | "assistant" | "system" | "developer"
    readonly content: string | ReadonlyArray<InputContent>
    readonly type?: "message" | undefined
  }
  | {
    readonly type?: "message" | undefined
    readonly role: "user" | "system" | "developer"
    readonly status?: MessageStatus | undefined
    readonly content: ReadonlyArray<InputContent>
  }
  | OutputMessage
  | FunctionCall
  | FunctionCallOutput
  | ReasoningItem
  | CustomToolCallOutput
  | CustomToolCall
  | ItemReference

type FunctionTool = {
  readonly type: "function"
  readonly name: string
  readonly description?: string | null | undefined
  readonly parameters?: JsonObject | null | undefined
  readonly strict?: boolean | null | undefined
}

type CustomToolParam = {
  readonly type: "custom"
  readonly name: string
  readonly description?: string | undefined
  readonly format?: unknown
}

/**
 * @since 1.0.0
 */
export type Tool =
  | FunctionTool
  | CustomToolParam

type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | {
    readonly type: "allowed_tools"
    readonly mode: "auto" | "required"
    readonly tools: ReadonlyArray<JsonObject>
  }
  | {
    readonly type: "function"
    readonly name: string
  }
  | {
    readonly type: "custom"
    readonly name: string
  }

/**
 * @since 1.0.0
 */
export type TextResponseFormatConfiguration =
  | {
    readonly type: "text"
  }
  | {
    readonly type: "json_schema"
    readonly description?: string | undefined
    readonly name: string
    readonly schema: JsonObject
    readonly strict?: boolean | null | undefined
  }
  | {
    readonly type: "json_object"
  }

/**
 * @since 1.0.0
 */
export type CreateResponse = {
  readonly metadata?: Readonly<Record<string, string>> | null | undefined
  readonly top_logprobs?: number | undefined
  readonly temperature?: number | null | undefined
  readonly top_p?: number | null | undefined
  readonly user?: string | null | undefined
  readonly safety_identifier?: string | null | undefined
  readonly prompt_cache_key?: string | null | undefined
  readonly service_tier?: string | undefined
  readonly prompt_cache_retention?: "in-memory" | "24h" | null | undefined
  readonly previous_response_id?: string | null | undefined
  readonly model?: ModelIdsResponses | undefined
  readonly reasoning?: unknown
  readonly background?: boolean | null | undefined
  readonly max_output_tokens?: number | null | undefined
  readonly max_tool_calls?: number | null | undefined
  readonly text?: {
    readonly format?: TextResponseFormatConfiguration | undefined
    readonly verbosity?: "low" | "medium" | "high" | null | undefined
  } | undefined
  readonly tools?: ReadonlyArray<Tool> | undefined
  readonly tool_choice?: ToolChoice | undefined
  readonly truncation?: "auto" | "disabled" | null | undefined
  readonly input?: string | ReadonlyArray<InputItem> | undefined
  readonly include?: ReadonlyArray<IncludeEnum> | null | undefined
  readonly parallel_tool_calls?: boolean | null | undefined
  readonly store?: boolean | null | undefined
  readonly instructions?: string | null | undefined
  readonly stream?: boolean | null | undefined
  readonly conversation?: string | null | undefined
  readonly modalities?: ReadonlyArray<"text" | "audio"> | undefined
  readonly seed?: number | undefined
}

/**
 * @since 1.0.0
 */
export type ResponseUsage = {
  readonly input_tokens: number
  readonly output_tokens: number
  readonly total_tokens: number
  readonly input_tokens_details?: unknown
  readonly output_tokens_details?: unknown
}

type OutputItem =
  | OutputMessage
  | FunctionCall
  | ReasoningItem
  | CustomToolCall

/**
 * @since 1.0.0
 */
export type Response = {
  readonly id: string
  readonly object?: "response" | undefined
  readonly model: ModelIdsResponses
  readonly status?: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete" | undefined
  readonly created_at: number
  readonly output: ReadonlyArray<OutputItem>
  readonly usage?: ResponseUsage | null | undefined
  readonly incomplete_details?:
    | {
      readonly reason?: "max_output_tokens" | "content_filter" | undefined
    }
    | null
    | undefined
  readonly service_tier?: string | undefined
}

type ResponseCreatedEvent = {
  readonly type: "response.created"
  readonly response: Response
  readonly sequence_number: number
}

type ResponseCompletedEvent = {
  readonly type: "response.completed"
  readonly response: Response
  readonly sequence_number: number
}

type ResponseIncompleteEvent = {
  readonly type: "response.incomplete"
  readonly response: Response
  readonly sequence_number: number
}

type ResponseFailedEvent = {
  readonly type: "response.failed"
  readonly response: Response
  readonly sequence_number: number
}

type ResponseOutputItemAddedEvent = {
  readonly type: "response.output_item.added"
  readonly output_index: number
  readonly sequence_number: number
  readonly item: OutputItem
}

type ResponseOutputItemDoneEvent = {
  readonly type: "response.output_item.done"
  readonly output_index: number
  readonly sequence_number: number
  readonly item: OutputItem
}

type ResponseTextDeltaEvent = {
  readonly type: "response.output_text.delta"
  readonly item_id: string
  readonly output_index: number
  readonly content_index: number
  readonly delta: string
  readonly sequence_number: number
  readonly logprobs?: ReadonlyArray<unknown> | undefined
}

type ResponseOutputTextAnnotationAddedEvent = {
  readonly type: "response.output_text.annotation.added"
  readonly item_id: string
  readonly output_index: number
  readonly content_index: number
  readonly annotation_index: number
  readonly sequence_number: number
  readonly annotation: Annotation
}

type ResponseFunctionCallArgumentsDeltaEvent = {
  readonly type: "response.function_call_arguments.delta"
  readonly item_id: string
  readonly output_index: number
  readonly sequence_number: number
  readonly delta: string
}

type ResponseReasoningSummaryPartAddedEvent = {
  readonly type: "response.reasoning_summary_part.added"
  readonly item_id: string
  readonly output_index: number
  readonly summary_index: number
  readonly sequence_number: number
  readonly part: SummaryTextContent
}

type ResponseReasoningSummaryPartDoneEvent = {
  readonly type: "response.reasoning_summary_part.done"
  readonly item_id: string
  readonly output_index: number
  readonly summary_index: number
  readonly sequence_number: number
  readonly part: SummaryTextContent
}

type ResponseReasoningSummaryTextDeltaEvent = {
  readonly type: "response.reasoning_summary_text.delta"
  readonly item_id: string
  readonly output_index: number
  readonly summary_index: number
  readonly delta: string
  readonly sequence_number: number
}

type ResponseErrorEvent = {
  readonly type: "error"
  readonly code: string | null
  readonly message: string
  readonly param: string | null
  readonly sequence_number: number
}

type UnknownResponseStreamEvent = {
  readonly type: string
  readonly [key: string]: unknown
}

/**
 * @since 1.0.0
 */
export type ResponseStreamEvent =
  | ResponseCreatedEvent
  | ResponseCompletedEvent
  | ResponseIncompleteEvent
  | ResponseFailedEvent
  | ResponseOutputItemAddedEvent
  | ResponseOutputItemDoneEvent
  | ResponseTextDeltaEvent
  | ResponseOutputTextAnnotationAddedEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseReasoningSummaryPartAddedEvent
  | ResponseReasoningSummaryPartDoneEvent
  | ResponseReasoningSummaryTextDeltaEvent
  | ResponseErrorEvent
  | UnknownResponseStreamEvent

/**
 * @since 1.0.0
 */
export type Embedding = {
  readonly embedding: ReadonlyArray<number> | string
  readonly index: number
  readonly object?: string | undefined
}

/**
 * @since 1.0.0
 */
export type CreateEmbeddingRequest = {
  readonly input: string | ReadonlyArray<string> | ReadonlyArray<number> | ReadonlyArray<ReadonlyArray<number>>
  readonly model: string
  readonly encoding_format?: "float" | "base64" | undefined
  readonly dimensions?: number | undefined
  readonly user?: string | undefined
}

/**
 * @since 1.0.0
 */
export type CreateEmbeddingResponse = {
  readonly data: ReadonlyArray<Embedding>
  readonly model: string
  readonly object?: "list" | undefined
  readonly usage?: {
    readonly prompt_tokens: number
    readonly total_tokens: number
  } | undefined
}

/**
 * @since 1.0.0
 */
export type CreateEmbeddingRequestJson = CreateEmbeddingRequest
/**
 * @since 1.0.0
 */
export type CreateEmbedding200 = CreateEmbeddingResponse
/**
 * @since 1.0.0
 */
export type CreateResponseRequestJson = CreateResponse
/**
 * @since 1.0.0
 */
export type CreateResponse200 = Response
/**
 * @since 1.0.0
 */
export type CreateResponse200Sse = ResponseStreamEvent

const EmbeddingSchema = Schema.Struct({
  embedding: Schema.Union([Schema.Array(Schema.Number), Schema.String]),
  index: Schema.Number,
  object: Schema.optionalKey(Schema.String)
})

const CreateEmbeddingResponseSchema = Schema.Struct({
  data: Schema.Array(EmbeddingSchema),
  model: Schema.String,
  object: Schema.optionalKey(Schema.Literal("list")),
  usage: Schema.optionalKey(Schema.Struct({
    prompt_tokens: Schema.Number,
    total_tokens: Schema.Number
  }))
})

const ChatCompletionToolFunction = Schema.Struct({
  name: Schema.String,
  arguments: Schema.optionalKey(Schema.String)
})

const ChatCompletionToolCall = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  index: Schema.optionalKey(Schema.Number),
  type: Schema.optionalKey(Schema.String),
  function: Schema.optionalKey(ChatCompletionToolFunction)
})

const ChatCompletionMessage = Schema.Struct({
  role: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.NullOr(Schema.String)),
  tool_calls: Schema.optionalKey(Schema.Array(ChatCompletionToolCall))
})

const ChatCompletionDelta = Schema.Struct({
  role: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.NullOr(Schema.String)),
  tool_calls: Schema.optionalKey(Schema.Array(ChatCompletionToolCall))
})

const ChatCompletionChoice = Schema.Struct({
  index: Schema.Number,
  finish_reason: Schema.optionalKey(Schema.NullOr(Schema.String)),
  message: Schema.optionalKey(ChatCompletionMessage),
  delta: Schema.optionalKey(ChatCompletionDelta)
})

const ChatCompletionUsage = Schema.Struct({
  prompt_tokens: Schema.Number,
  completion_tokens: Schema.Number,
  total_tokens: Schema.Number,
  prompt_tokens_details: Schema.optionalKey(Schema.Any),
  completion_tokens_details: Schema.optionalKey(Schema.Any)
})

const ChatCompletionResponse = Schema.Struct({
  id: Schema.String,
  model: Schema.String,
  created: Schema.Number,
  choices: Schema.Array(ChatCompletionChoice),
  usage: Schema.optionalKey(Schema.NullOr(ChatCompletionUsage)),
  service_tier: Schema.optionalKey(Schema.String)
})

const ChatCompletionChunk = Schema.Struct({
  id: Schema.String,
  model: Schema.String,
  created: Schema.Number,
  choices: Schema.Array(ChatCompletionChoice),
  usage: Schema.optionalKey(Schema.NullOr(ChatCompletionUsage)),
  service_tier: Schema.optionalKey(Schema.String)
})

type CompatCreateResponse = CreateResponseRequestJson
type CompatResponse = CreateResponse200
type CompatResponseEvent = CreateResponse200Sse
type CompatOutputItem = CompatResponse["output"][number]
type CompatToolChoice = CompatCreateResponse["tool_choice"]
type CompatTool = Tool
type CompatInput = CompatCreateResponse["input"]
type CompatTextFormat = NonNullable<NonNullable<CompatCreateResponse["text"]>["format"]>
type ChatCompletionResponse = typeof ChatCompletionResponse.Type
type ChatCompletionChunk = typeof ChatCompletionChunk.Type
type ChatCompletionUsage = typeof ChatCompletionUsage.Type
type ChatCompletionToolCall = typeof ChatCompletionToolCall.Type

const fromChatCompletion = (body: ChatCompletionResponse): CompatResponse => {
  const firstChoice = body.choices[0]
  const output = fromChatMessageToOutput(body.id, firstChoice?.message)
  const finishReason = firstChoice?.finish_reason
  const { status, incompleteDetails } = toCompatStatus(finishReason)

  return {
    id: body.id,
    object: "response",
    model: body.model,
    status,
    created_at: body.created,
    output,
    ...(Predicate.isNotUndefined(incompleteDetails) ? { incomplete_details: incompleteDetails } : undefined),
    ...(Predicate.isNotUndefined(body.usage) && Predicate.isNotNull(body.usage)
      ? { usage: toCompatUsage(body.usage) }
      : undefined),
    ...(Predicate.isNotUndefined(body.service_tier) ? { service_tier: body.service_tier } : undefined)
  }
}

const toChatCompletionsRequest = (
  payload: CompatCreateResponse,
  stream: boolean
): Record<string, unknown> => {
  const messages = toChatMessages(payload.input)
  const responseFormat = toChatResponseFormat(payload.text?.format)
  const tools = Predicate.isNotUndefined(payload.tools)
    ? payload.tools.map(toChatTool).filter(Predicate.isNotUndefined)
    : []
  const toolChoice = toChatToolChoice(payload.tool_choice)

  const request: Record<string, unknown> = {
    model: payload.model,
    messages: messages.length > 0 ? messages : [{ role: "user", content: "" }],
    ...(Predicate.isNotUndefined(payload.temperature) ? { temperature: payload.temperature } : undefined),
    ...(Predicate.isNotUndefined(payload.top_p) ? { top_p: payload.top_p } : undefined),
    ...(Predicate.isNotUndefined(payload.max_output_tokens) ? { max_tokens: payload.max_output_tokens } : undefined),
    ...(Predicate.isNotUndefined(payload.user) ? { user: payload.user } : undefined),
    ...(Predicate.isNotUndefined(payload.seed) ? { seed: payload.seed } : undefined),
    ...(Predicate.isNotUndefined(payload.parallel_tool_calls)
      ? { parallel_tool_calls: payload.parallel_tool_calls }
      : undefined),
    ...(Predicate.isNotUndefined(responseFormat) ? { response_format: responseFormat } : undefined),
    ...(tools.length > 0 ? { tools } : undefined),
    ...(Predicate.isNotUndefined(toolChoice) ? { tool_choice: toolChoice } : undefined),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : undefined)
  }

  return request
}

const toChatResponseFormat = (
  format: CompatTextFormat | undefined
): Record<string, unknown> | undefined => {
  if (Predicate.isUndefined(format) || Predicate.isNull(format)) {
    return undefined
  }
  switch (format.type) {
    case "json_object": {
      return { type: "json_object" }
    }
    case "json_schema": {
      return {
        type: "json_schema",
        json_schema: {
          name: format.name,
          schema: format.schema,
          ...(Predicate.isNotUndefined(format.description) ? { description: format.description } : undefined),
          ...(Predicate.isNotUndefined(format.strict) ? { strict: format.strict } : undefined)
        }
      }
    }
    default: {
      return undefined
    }
  }
}

const toChatToolChoice = (toolChoice: CompatToolChoice): unknown => {
  if (Predicate.isUndefined(toolChoice)) {
    return undefined
  }

  if (typeof toolChoice === "string") {
    return toolChoice
  }

  if (toolChoice.type === "allowed_tools") {
    return toolChoice.mode
  }

  if (toolChoice.type === "function") {
    return {
      type: "function",
      function: {
        name: toolChoice.name
      }
    }
  }

  const functionName = Predicate.hasProperty(toolChoice, "name") && typeof toolChoice.name === "string"
    ? toolChoice.name
    : toolChoice.type

  return {
    type: "function",
    function: {
      name: functionName
    }
  }
}

const toChatTool = (tool: CompatTool): Record<string, unknown> | undefined => {
  if (tool.type === "function") {
    return {
      type: "function",
      function: {
        name: tool.name,
        ...(Predicate.isNotUndefined(tool.description) ? { description: tool.description } : undefined),
        ...(Predicate.isNotUndefined(tool.parameters) ? { parameters: tool.parameters } : undefined),
        ...(Predicate.isNotUndefined(tool.strict) ? { strict: tool.strict } : undefined)
      }
    }
  }

  if (tool.type === "custom") {
    return {
      type: "function",
      function: {
        name: tool.name,
        parameters: { type: "object", additionalProperties: true }
      }
    }
  }

  return undefined
}

const toChatMessages = (input: CompatInput): Array<Record<string, unknown>> => {
  if (Predicate.isUndefined(input)) {
    return []
  }

  if (typeof input === "string") {
    return [{ role: "user", content: input }]
  }

  const messages: Array<Record<string, unknown>> = []

  for (const item of input) {
    messages.push(...toChatMessagesFromItem(item))
  }

  return messages
}

const toChatMessagesFromItem = (
  item: InputItem
): Array<Record<string, unknown>> => {
  if (Predicate.hasProperty(item, "type") && item.type === "message") {
    return [{
      role: item.role,
      content: toAssistantChatMessageContent(item.content)
    }]
  }

  if (Predicate.hasProperty(item, "role")) {
    return [{
      role: item.role,
      content: toChatMessageContent(item.content)
    }]
  }

  switch (item.type) {
    case "function_call": {
      return [{
        role: "assistant",
        content: null,
        tool_calls: [{
          id: item.call_id,
          type: "function",
          function: {
            name: item.name,
            arguments: item.arguments
          }
        }]
      }]
    }

    case "function_call_output": {
      return [{
        role: "tool",
        tool_call_id: item.call_id,
        content: stringifyJson(item.output)
      }]
    }

    default: {
      return []
    }
  }
}

const toAssistantChatMessageContent = (
  content: OutputMessage["content"]
): string | null => {
  const text = content.map((part) => {
    if (part.type === "output_text") {
      return part.text
    }
    if (part.type === "refusal") {
      return part.refusal
    }
    return ""
  }).join("")
  return text.length > 0 ? text : null
}

const toChatMessageContent = (
  content: string | ReadonlyArray<InputContent>
): string | ReadonlyArray<Record<string, unknown>> => {
  if (typeof content === "string") {
    return content
  }

  const richParts: Array<Record<string, unknown>> = []
  const textParts: Array<string> = []

  for (const part of content) {
    switch (part.type) {
      case "input_text": {
        textParts.push(part.text)
        break
      }
      case "input_image": {
        const imageUrl = Predicate.isNotUndefined(part.image_url)
          ? part.image_url
          : Predicate.isNotUndefined(part.file_id)
          ? `openai://file/${part.file_id}`
          : undefined
        if (Predicate.isNotUndefined(imageUrl) && Predicate.isNotNull(imageUrl)) {
          richParts.push({
            type: "image_url",
            image_url: {
              url: imageUrl,
              ...(Predicate.isNotUndefined(part.detail) ? { detail: part.detail } : undefined)
            }
          })
        }
        break
      }
      case "input_file": {
        if (Predicate.isNotUndefined(part.file_url)) {
          textParts.push(part.file_url)
        } else if (Predicate.isNotUndefined(part.file_data)) {
          textParts.push(part.file_data)
        } else if (Predicate.isNotUndefined(part.file_id)) {
          textParts.push(`openai://file/${part.file_id}`)
        }
        break
      }
    }
  }

  if (richParts.length === 0) {
    return textParts.join("\n")
  }

  if (textParts.length > 0) {
    richParts.unshift({
      type: "text",
      text: textParts.join("\n")
    })
  }

  return richParts
}

const toCompatUsage = (usage: ChatCompletionUsage): ResponseUsage => ({
  input_tokens: usage.prompt_tokens,
  output_tokens: usage.completion_tokens,
  total_tokens: usage.total_tokens,
  ...(Predicate.isNotUndefined(usage.prompt_tokens_details)
    ? { input_tokens_details: usage.prompt_tokens_details }
    : undefined),
  ...(Predicate.isNotUndefined(usage.completion_tokens_details)
    ? { output_tokens_details: usage.completion_tokens_details }
    : undefined)
})

const toCompatStatus = (
  finishReason: string | null | undefined
): {
  readonly status: "completed" | "incomplete"
  readonly incompleteDetails: Response["incomplete_details"] | undefined
} => {
  switch (finishReason) {
    case "length": {
      return {
        status: "incomplete",
        incompleteDetails: { reason: "max_output_tokens" }
      }
    }
    case "content_filter": {
      return {
        status: "incomplete",
        incompleteDetails: { reason: "content_filter" }
      }
    }
    default: {
      return {
        status: "completed",
        incompleteDetails: undefined
      }
    }
  }
}

const fromChatMessageToOutput = (
  responseId: string,
  message: typeof ChatCompletionMessage.Type | undefined
): Array<CompatOutputItem> => {
  if (Predicate.isUndefined(message)) {
    return []
  }

  const output: Array<CompatOutputItem> = []
  const text = Predicate.isNotNull(message.content) && Predicate.isNotUndefined(message.content)
    ? message.content
    : ""

  if (text.length > 0 || !Predicate.isNotUndefined(message.tool_calls) || message.tool_calls.length === 0) {
    output.push(makeMessageOutputItem(`${responseId}_message`, text, "completed"))
  }

  if (Predicate.isNotUndefined(message.tool_calls)) {
    message.tool_calls.forEach((toolCall, index) => {
      output.push(fromChatToolCallToOutputItem(responseId, toolCall, index))
    })
  }

  return output
}

const makeMessageOutputItem = (
  id: string,
  text: string,
  status: "in_progress" | "completed" | "incomplete"
): CompatOutputItem => ({
  id,
  type: "message",
  role: "assistant",
  status,
  content: text.length > 0
    ? [{
      type: "output_text",
      text,
      annotations: [],
      logprobs: []
    }]
    : []
})

const fromChatToolCallToOutputItem = (
  responseId: string,
  toolCall: ChatCompletionToolCall,
  index: number
): CompatOutputItem => {
  const id = toolCall.id ?? `${responseId}_tool_${index}`
  const name = toolCall.function?.name ?? "unknown_tool"
  const argumentsText = toolCall.function?.arguments ?? "{}"

  return {
    id,
    type: "function_call",
    call_id: id,
    name,
    arguments: argumentsText,
    status: "completed"
  }
}

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const isChatCompletionChunk = Schema.is(ChatCompletionChunk)

const decodeChatCompletionSseData = (
  data: string
): ChatCompletionChunk | "[DONE]" | undefined => {
  if (data === "[DONE]") {
    return data
  }
  const parsed = parseJson(data)
  return isChatCompletionChunk(parsed)
    ? parsed
    : undefined
}

const stringifyJson = (value: unknown): string =>
  typeof value === "string"
    ? value
    : JSON.stringify(value)

type StreamToolCallState = {
  readonly index: number
  readonly outputIndex: number
  readonly id: string
  name: string
  arguments: string
  added: boolean
}

type StreamAdapterState = {
  id: string
  model: string
  createdAt: number
  serviceTier: string | undefined
  usage: ChatCompletionUsage | undefined
  sequenceNumber: number
  createdEmitted: boolean
  messageId: string
  messageText: string
  messageAdded: boolean
  pendingFinishReason: string | null
  readonly toolCalls: Map<number, StreamToolCallState>
}

const makeChatStreamEventAdapter = () => {
  const state: StreamAdapterState = {
    id: "",
    model: "",
    createdAt: 0,
    serviceTier: undefined,
    usage: undefined,
    sequenceNumber: 0,
    createdEmitted: false,
    messageId: "",
    messageText: "",
    messageAdded: false,
    pendingFinishReason: null,
    toolCalls: new Map()
  }

  const nextSequence = () => {
    state.sequenceNumber += 1
    return state.sequenceNumber
  }

  const ensureCreatedEvent = (): Array<CompatResponseEvent> => {
    if (state.createdEmitted || state.id.length === 0) {
      return []
    }
    state.createdEmitted = true
    return [{
      type: "response.created",
      sequence_number: nextSequence(),
      response: {
        id: state.id,
        object: "response",
        model: state.model,
        status: "in_progress",
        created_at: state.createdAt,
        output: []
      }
    }]
  }

  const ensureMessageAdded = (): Array<CompatResponseEvent> => {
    if (state.messageAdded || state.id.length === 0) {
      return []
    }
    state.messageAdded = true
    state.messageId = `${state.id}_message`
    return [{
      type: "response.output_item.added",
      output_index: 0,
      sequence_number: nextSequence(),
      item: makeMessageOutputItem(state.messageId, "", "in_progress")
    }]
  }

  const toTerminalEventType = (finishReason: string | null): "response.completed" | "response.incomplete" =>
    finishReason === "length" || finishReason === "content_filter"
      ? "response.incomplete"
      : "response.completed"

  const flush = (): Array<CompatResponseEvent> => {
    if (!state.createdEmitted) {
      return []
    }

    const events: Array<CompatResponseEvent> = []
    const output: Array<CompatOutputItem> = []

    if (state.messageAdded) {
      const item = makeMessageOutputItem(state.messageId, state.messageText, "completed")
      output.push(item)
      events.push({
        type: "response.output_item.done",
        output_index: 0,
        sequence_number: nextSequence(),
        item
      })
    }

    const sortedToolCalls = globalThis.Array.from(state.toolCalls.values()).sort((a, b) => a.index - b.index)

    for (const toolCall of sortedToolCalls) {
      const item = fromChatToolCallToOutputItem(state.id, {
        id: toolCall.id,
        index: toolCall.index,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: toolCall.arguments
        }
      }, toolCall.index)
      output.push(item)
      events.push({
        type: "response.output_item.done",
        output_index: toolCall.outputIndex,
        sequence_number: nextSequence(),
        item
      })
    }

    const finishReason = state.pendingFinishReason
    const { status, incompleteDetails } = toCompatStatus(finishReason)

    events.push({
      type: toTerminalEventType(finishReason),
      sequence_number: nextSequence(),
      response: {
        id: state.id,
        object: "response",
        model: state.model,
        status,
        created_at: state.createdAt,
        output,
        ...(Predicate.isNotUndefined(incompleteDetails) ? { incomplete_details: incompleteDetails } : undefined),
        ...(Predicate.isNotUndefined(state.usage) ? { usage: toCompatUsage(state.usage) } : undefined),
        ...(Predicate.isNotUndefined(state.serviceTier) ? { service_tier: state.serviceTier } : undefined)
      }
    })

    state.pendingFinishReason = null

    return events
  }

  return (data: ChatCompletionChunk | "[DONE]"): Array<CompatResponseEvent> => {
    if (data === "[DONE]") {
      return flush()
    }

    state.id = data.id
    state.model = data.model
    state.createdAt = data.created
    state.serviceTier = data.service_tier
    state.usage = Predicate.isNotUndefined(data.usage) && Predicate.isNotNull(data.usage)
      ? data.usage
      : state.usage

    const events = [...ensureCreatedEvent()]

    const choice = data.choices[0]
    if (Predicate.isUndefined(choice)) {
      return events
    }

    if (Predicate.isNotUndefined(choice.delta?.content) && Predicate.isNotNull(choice.delta.content)) {
      events.push(...ensureMessageAdded())
      state.messageText += choice.delta.content
      events.push({
        type: "response.output_text.delta",
        item_id: state.messageId,
        output_index: 0,
        content_index: 0,
        delta: choice.delta.content,
        sequence_number: nextSequence()
      })
    }

    if (Predicate.isNotUndefined(choice.delta?.tool_calls)) {
      choice.delta.tool_calls.forEach((deltaTool, toolCallArrayIndex) => {
        const index = deltaTool.index ?? toolCallArrayIndex
        const outputIndex = index + 1
        const toolId = deltaTool.id ?? `${state.id}_tool_${index}`
        const toolName = deltaTool.function?.name ?? "unknown_tool"
        const argumentsDelta = deltaTool.function?.arguments ?? ""

        const current = state.toolCalls.get(index)
        const toolCall = Predicate.isUndefined(current)
          ? {
            index,
            outputIndex,
            id: toolId,
            name: toolName,
            arguments: argumentsDelta,
            added: false
          }
          : {
            ...current,
            name: deltaTool.function?.name ?? current.name,
            arguments: `${current.arguments}${argumentsDelta}`
          }

        state.toolCalls.set(index, toolCall)

        if (!toolCall.added) {
          toolCall.added = true
          events.push({
            type: "response.output_item.added",
            output_index: outputIndex,
            sequence_number: nextSequence(),
            item: {
              id: toolCall.id,
              type: "function_call",
              call_id: toolCall.id,
              name: toolCall.name,
              arguments: "",
              status: "in_progress"
            }
          })
        }

        if (toolCall.added && argumentsDelta.length > 0) {
          events.push({
            type: "response.function_call_arguments.delta",
            item_id: toolCall.id,
            output_index: outputIndex,
            sequence_number: nextSequence(),
            delta: argumentsDelta
          })
        }
      })
    }

    if (Predicate.isNotUndefined(choice.finish_reason) && Predicate.isNotNull(choice.finish_reason)) {
      state.pendingFinishReason = choice.finish_reason
    }

    return events
  }
}
