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

    const decodeResponse = HttpClientResponse.schemaBodyJson(ChatCompletionResponse)

    const createResponse = (
      payload: typeof OpenAiSchema.CreateResponseRequestJson.Encoded
    ): Effect.Effect<
      [body: typeof OpenAiSchema.CreateResponse200.Type, response: HttpClientResponse.HttpClientResponse],
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
            ): [typeof OpenAiSchema.CreateResponse200.Type, HttpClientResponse.HttpClientResponse] => [
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
      Stream.Stream<typeof OpenAiSchema.CreateResponse200Sse.Type, AiError.AiError>
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

    const decodeEmbedding = HttpClientResponse.schemaBodyJson(OpenAiSchema.CreateEmbedding200)

    const createEmbedding = (
      payload: typeof OpenAiSchema.CreateEmbeddingRequestJson.Encoded
    ): Effect.Effect<typeof OpenAiSchema.CreateEmbedding200.Type, AiError.AiError> =>
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

type CompatCreateResponse = typeof OpenAiSchema.CreateResponseRequestJson.Encoded
type CompatResponse = typeof OpenAiSchema.CreateResponse200.Type
type CompatResponseEvent = typeof OpenAiSchema.CreateResponse200Sse.Type
type CompatOutputItem = CompatResponse["output"][number]
type CompatToolChoice = CompatCreateResponse["tool_choice"]
type CompatTool = typeof OpenAiSchema.Tool.Encoded
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

  return {
    type: "function",
    function: {
      name: tool.type,
      parameters: providerToolParameters(tool.type)
    }
  }
}

const providerToolParameters = (name: string): Readonly<Record<string, Schema.Json>> => {
  switch (name) {
    case "shell":
    case "local_shell": {
      return {
        type: "object",
        properties: {
          action: {
            type: "object",
            additionalProperties: true
          }
        },
        required: ["action"],
        additionalProperties: true
      }
    }
    case "apply_patch": {
      return {
        type: "object",
        properties: {
          call_id: { type: "string" },
          operation: { type: "object", additionalProperties: true }
        },
        required: ["operation"],
        additionalProperties: true
      }
    }
    default: {
      return {
        type: "object",
        additionalProperties: true
      }
    }
  }
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
  item: typeof OpenAiSchema.InputItem.Encoded
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

    case "local_shell_call": {
      return [{
        role: "assistant",
        content: null,
        tool_calls: [{
          id: item.call_id,
          type: "function",
          function: {
            name: "local_shell",
            arguments: JSON.stringify({ action: item.action })
          }
        }]
      }]
    }

    case "local_shell_call_output": {
      return [{
        role: "tool",
        tool_call_id: item.call_id,
        content: stringifyJson(item.output)
      }]
    }

    case "shell_call": {
      return [{
        role: "assistant",
        content: null,
        tool_calls: [{
          id: item.call_id,
          type: "function",
          function: {
            name: "shell",
            arguments: JSON.stringify({ action: item.action })
          }
        }]
      }]
    }

    case "shell_call_output": {
      return [{
        role: "tool",
        tool_call_id: item.call_id,
        content: stringifyJson(item.output)
      }]
    }

    case "apply_patch_call": {
      return [{
        role: "assistant",
        content: null,
        tool_calls: [{
          id: item.call_id,
          type: "function",
          function: {
            name: "apply_patch",
            arguments: JSON.stringify({ call_id: item.call_id, operation: item.operation })
          }
        }]
      }]
    }

    case "apply_patch_call_output": {
      return [{
        role: "tool",
        tool_call_id: item.call_id,
        content: stringifyJson(item)
      }]
    }

    default: {
      return []
    }
  }
}

const toAssistantChatMessageContent = (
  content: typeof OpenAiSchema.OutputMessage.Encoded["content"]
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
  content: string | ReadonlyArray<typeof OpenAiSchema.InputContent.Encoded>
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

const toCompatUsage = (usage: ChatCompletionUsage): typeof OpenAiSchema.ResponseUsage.Type => ({
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
  readonly incompleteDetails: typeof OpenAiSchema.Response.Type["incomplete_details"] | undefined
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

  if (name === "local_shell") {
    const parsed = parseJson(argumentsText)
    if (isRecord(parsed) && Predicate.hasProperty(parsed, "action")) {
      return {
        id,
        type: "local_shell_call",
        call_id: id,
        action: parsed.action,
        status: "completed"
      }
    }
  }

  if (name === "shell") {
    const parsed = parseJson(argumentsText)
    if (isRecord(parsed) && Predicate.hasProperty(parsed, "action")) {
      return {
        id,
        type: "shell_call",
        call_id: id,
        action: parsed.action,
        status: "completed"
      }
    }
  }

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

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

        if (!toolCall.added && toolCall.name !== "local_shell" && toolCall.name !== "shell") {
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
