/**
 * OpenAI Language Model implementation.
 *
 * Provides a LanguageModel implementation for OpenAI's responses API,
 * supporting text generation, structured output, tool calling, and streaming.
 *
 * @since 1.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Base64 from "effect/encoding/Base64"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as Redactable from "effect/Redactable"
import type * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import type { Span } from "effect/Tracer"
import type { DeepMutable, Simplify } from "effect/Types"
import * as AiError from "effect/unstable/ai/AiError"
import * as IdGenerator from "effect/unstable/ai/IdGenerator"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import * as AiModel from "effect/unstable/ai/Model"
import type * as Prompt from "effect/unstable/ai/Prompt"
import type * as Response from "effect/unstable/ai/Response"
import * as Tool from "effect/unstable/ai/Tool"
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import * as InternalUtilities from "./internal/utilities.ts"
import {
  type Annotation,
  type CreateResponse,
  type IncludeEnum,
  type InputContent,
  type InputItem,
  type MessageStatus,
  type ModelIdsResponses,
  type ModelIdsShared,
  OpenAiClient,
  type ReasoningItem,
  type Response as OpenAiResponse,
  type ResponseStreamEvent as OpenAiResponseStreamEvent,
  type ResponseUsage,
  type SummaryTextContent,
  type TextResponseFormatConfiguration,
  type Tool as OpenAiClientTool
} from "./OpenAiClient.ts"
import { addGenAIAnnotations } from "./OpenAiTelemetry.ts"

/**
 * @since 1.0.0
 * @category models
 */
export type Model = (ModelIdsResponses | ModelIdsShared) | (string & {})

/**
 * Image detail level for vision requests.
 */
type ImageDetail = "auto" | "low" | "high"

// =============================================================================
// Configuration
// =============================================================================

/**
 * Service definition for OpenAI language model configuration.
 *
 * @since 1.0.0
 * @category context
 */
export class Config extends ServiceMap.Service<
  Config,
  Simplify<
    & Partial<
      Omit<
        CreateResponse,
        "input" | "tools" | "tool_choice" | "stream" | "text"
      >
    >
    & {
      /**
       * File ID prefixes used to identify file IDs in Responses API.
       * When undefined, all file data is treated as base64 content.
       *
       * Examples:
       * - OpenAI: ['file-'] for IDs like 'file-abc123'
       * - Azure OpenAI: ['assistant-'] for IDs like 'assistant-abc123'
       */
      readonly fileIdPrefixes?: ReadonlyArray<string> | undefined
      /**
       * Configuration options for a text response from the model.
       */
      readonly text?: {
        /**
         * Constrains the verbosity of the model's response. Lower values will
         * result in more concise responses, while higher values will result in
         * more verbose responses.
         *
         * Defaults to `"medium"`.
         */
        readonly verbosity?: "low" | "medium" | "high" | undefined
      } | undefined
      /**
       * Whether to use strict JSON schema validation.
       *
       * Defaults to `true`.
       */
      readonly strictJsonSchema?: boolean | undefined
    }
  >
>()("@effect/ai-openai-compat/OpenAiLanguageModel/Config") {}

// =============================================================================
// Provider Options / Metadata
// =============================================================================

declare module "effect/unstable/ai/Prompt" {
  export interface FilePartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.
       */
      readonly imageDetail?: ImageDetail | null
    } | null
  }

  export interface ReasoningPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | null
      /**
       * The encrypted content of the reasoning item - populated when a response
       * is generated with `reasoning.encrypted_content` in the `include`
       * parameter.
       */
      readonly encryptedContent?: string | null
    } | null
  }

  export interface ToolCallPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | null
      /**
       * The status of item.
       */
      readonly status?: MessageStatus | null
    } | null
  }

  export interface ToolResultPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | null
      /**
       * The status of item.
       */
      readonly status?: MessageStatus | null
    } | null
  }

  export interface TextPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | null
      /**
       * The status of item.
       */
      readonly status?: MessageStatus | null
      /**
       * A list of annotations that apply to the output text.
       */
      readonly annotations?: ReadonlyArray<Annotation> | null
    } | null
  }
}

declare module "effect/unstable/ai/Response" {
  export interface TextPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
      /**
       * If the model emits a refusal content part, the refusal explanation
       * from the model will be contained in the metadata of an empty text
       * part.
       */
      readonly refusal?: string | null
      /**
       * The status of item.
       */
      readonly status?: MessageStatus | null
      /**
       * The text content part annotations.
       */
      readonly annotations?: ReadonlyArray<Annotation> | null
    }
  }

  export interface TextStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
    } | null
  }

  export interface TextEndPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
      readonly annotations?: ReadonlyArray<Annotation> | null
    } | null
  }

  export interface ReasoningPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
      readonly encryptedContent?: string | null
    } | null
  }

  export interface ReasoningStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
      readonly encryptedContent?: string | null
    } | null
  }

  export interface ReasoningDeltaPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
    } | null
  }

  export interface ReasoningEndPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
      readonly encryptedContent?: string
    } | null
  }

  export interface ToolCallPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string | null
    } | null
  }

  export interface DocumentSourcePartMetadata extends ProviderMetadata {
    readonly openai?:
      | {
        readonly type: "file_citation"
        /**
         * The index of the file in the list of files.
         */
        readonly index: number
        /**
         * The ID of the file.
         */
        readonly fileId: string
      }
      | {
        readonly type: "file_path"
        /**
         * The index of the file in the list of files.
         */
        readonly index: number
        /**
         * The ID of the file.
         */
        readonly fileId: string
      }
      | {
        readonly type: "container_file_citation"
        /**
         * The ID of the file.
         */
        readonly fileId: string
        /**
         * The ID of the container file.
         */
        readonly containerId: string
      }
      | null
  }

  export interface UrlSourcePartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly type: "url_citation"
      /**
       * The index of the first character of the URL citation in the message.
       */
      readonly startIndex: number
      /**
       * The index of the last character of the URL citation in the message.
       */
      readonly endIndex: number
    } | null
  }

  export interface FinishPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly serviceTier?: "default" | "auto" | "flex" | "scale" | "priority" | null
    } | null
  }
}

// =============================================================================
// Language Model
// =============================================================================

/**
 * @since 1.0.0
 * @category constructors
 */
export const model = (
  model: (string & {}) | Model,
  config?: Omit<typeof Config.Service, "model">
): AiModel.Model<"openai", LanguageModel.LanguageModel, OpenAiClient> =>
  AiModel.make("openai", layer({ model, config }))

// TODO
// /**
//  * @since 1.0.0
//  * @category constructors
//  */
// export const modelWithTokenizer = (
//   model: (string & {}) | Model,
//   config?: Omit<typeof Config.Service, "model">
// ): AiModel.Model<"openai", LanguageModel.LanguageModel | Tokenizer.Tokenizer, OpenAiClient> =>
//   AiModel.make("openai", layerWithTokenizer({ model, config }))

/**
 * Creates an OpenAI language model service.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*({ model, config: providerConfig }: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<typeof Config.Service, "model"> | undefined
}): Effect.fn.Return<LanguageModel.Service, never, OpenAiClient> {
  const client = yield* OpenAiClient

  const makeConfig = Effect.gen(function*() {
    const services = yield* Effect.services<never>()
    return { model, ...providerConfig, ...services.mapUnsafe.get(Config.key) }
  })

  const makeRequest = Effect.fnUntraced(
    function*<Tools extends ReadonlyArray<Tool.Any>>({ config, options, toolNameMapper }: {
      readonly config: typeof Config.Service
      readonly options: LanguageModel.ProviderOptions
      readonly toolNameMapper: Tool.NameMapper<Tools>
    }): Effect.fn.Return<CreateResponse, AiError.AiError> {
      const include = new Set<IncludeEnum>()
      const capabilities = getModelCapabilities(config.model!)
      const messages = yield* prepareMessages({
        config,
        options,
        capabilities,
        include,
        toolNameMapper
      })
      const { toolChoice, tools } = yield* prepareTools({
        config,
        options,
        toolNameMapper
      })
      const responseFormat = prepareResponseFormat({
        config,
        options
      })
      const request: CreateResponse = {
        ...config,
        input: messages,
        include: include.size > 0 ? Array.from(include) : null,
        text: {
          verbosity: config.text?.verbosity ?? null,
          format: responseFormat
        },
        ...(Predicate.isNotUndefined(tools) ? { tools } : undefined),
        ...(Predicate.isNotUndefined(toolChoice) ? { tool_choice: toolChoice } : undefined)
      }
      return request
    }
  )

  return yield* LanguageModel.make({
    generateText: Effect.fnUntraced(
      function*(options) {
        const config = yield* makeConfig
        const toolNameMapper = new Tool.NameMapper(options.tools)
        const request = yield* makeRequest({ config, options, toolNameMapper })
        annotateRequest(options.span, request)
        const [rawResponse, response] = yield* client.createResponse(request)
        annotateResponse(options.span, rawResponse)
        return yield* makeResponse({
          rawResponse,
          response,
          toolNameMapper
        })
      }
    ),
    streamText: Effect.fnUntraced(
      function*(options) {
        const config = yield* makeConfig
        const toolNameMapper = new Tool.NameMapper(options.tools)
        const request = yield* makeRequest({ config, options, toolNameMapper })
        annotateRequest(options.span, request)
        const [response, stream] = yield* client.createResponseStream(request)
        return yield* makeStreamResponse({
          stream,
          response,
          config,
          toolNameMapper
        })
      },
      (effect, options) =>
        effect.pipe(
          Stream.unwrap,
          Stream.map((response) => {
            annotateStreamResponse(options.span, response)
            return response
          })
        )
    )
  })
})

/**
 * Creates a layer for the OpenAI language model.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<typeof Config.Service, "model"> | undefined
}): Layer.Layer<LanguageModel.LanguageModel, never, OpenAiClient> =>
  Layer.effect(LanguageModel.LanguageModel, make(options))

/**
 * Provides config overrides for OpenAI language model operations.
 *
 * @since 1.0.0
 * @category configuration
 */
export const withConfigOverride: {
  (overrides: typeof Config.Service): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Config>>
  <A, E, R>(self: Effect.Effect<A, E, R>, overrides: typeof Config.Service): Effect.Effect<A, E, Exclude<R, Config>>
} = dual<
  (
    overrides: typeof Config.Service
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Config>>,
  <A, E, R>(self: Effect.Effect<A, E, R>, overrides: typeof Config.Service) => Effect.Effect<A, E, Exclude<R, Config>>
>(2, (self, overrides) =>
  Effect.flatMap(
    Effect.serviceOption(Config),
    (config) =>
      Effect.provideService(self, Config, {
        ...(config._tag === "Some" ? config.value : {}),
        ...overrides
      })
  ))

// =============================================================================
// Prompt Conversion
// =============================================================================

const getSystemMessageMode = (model: string): "system" | "developer" =>
  model.startsWith("o") ||
    model.startsWith("gpt-5") ||
    model.startsWith("codex-") ||
    model.startsWith("computer-use")
    ? "developer"
    : "system"

const prepareMessages = Effect.fnUntraced(
  function*<Tools extends ReadonlyArray<Tool.Any>>({
    config,
    options,
    capabilities,
    include,
    toolNameMapper
  }: {
    readonly config: typeof Config.Service
    readonly options: LanguageModel.ProviderOptions
    readonly include: Set<IncludeEnum>
    readonly capabilities: ModelCapabilities
    readonly toolNameMapper: Tool.NameMapper<Tools>
  }): Effect.fn.Return<ReadonlyArray<InputItem>, AiError.AiError> {
    const hasConversation = Predicate.isNotNullish(config.conversation)

    // Handle Included Features
    if (Predicate.isNotUndefined(config.top_logprobs)) {
      include.add("message.output_text.logprobs")
    }
    if (config.store === false && capabilities.isReasoningModel) {
      include.add("reasoning.encrypted_content")
    }

    const messages: Array<InputItem> = []

    for (const message of options.prompt.content) {
      switch (message.role) {
        case "system": {
          messages.push({
            role: getSystemMessageMode(config.model!),
            content: message.content
          })
          break
        }

        case "user": {
          const content: Array<InputContent> = []

          for (let index = 0; index < message.content.length; index++) {
            const part = message.content[index]

            switch (part.type) {
              case "text": {
                content.push({ type: "input_text", text: part.text })
                break
              }

              case "file": {
                if (part.mediaType.startsWith("image/")) {
                  const detail = getImageDetail(part)
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType

                  if (typeof part.data === "string" && isFileId(part.data, config)) {
                    content.push({ type: "input_image", file_id: part.data, detail })
                  }

                  if (part.data instanceof URL) {
                    content.push({ type: "input_image", image_url: part.data.toString(), detail })
                  }

                  if (part.data instanceof Uint8Array) {
                    const base64 = Base64.encode(part.data)
                    const imageUrl = `data:${mediaType};base64,${base64}`
                    content.push({ type: "input_image", image_url: imageUrl, detail })
                  }
                } else if (part.mediaType === "application/pdf") {
                  if (typeof part.data === "string" && isFileId(part.data, config)) {
                    content.push({ type: "input_file", file_id: part.data })
                  }

                  if (part.data instanceof URL) {
                    content.push({ type: "input_file", file_url: part.data.toString() })
                  }

                  if (part.data instanceof Uint8Array) {
                    const base64 = Base64.encode(part.data)
                    const fileName = part.fileName ?? `part-${index}.pdf`
                    const fileData = `data:application/pdf;base64,${base64}`
                    content.push({ type: "input_file", filename: fileName, file_data: fileData })
                  }
                } else {
                  return yield* AiError.make({
                    module: "OpenAiLanguageModel",
                    method: "prepareMessages",
                    reason: new AiError.InvalidRequestError({
                      description: `Detected unsupported media type for file: '${part.mediaType}'`
                    })
                  })
                }
              }
            }
          }

          messages.push({ role: "user", content })

          break
        }

        case "assistant": {
          const reasoningMessages: Record<string, DeepMutable<ReasoningItem>> = {}

          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                const id = getItemId(part)

                // When in conversation mode, skip items that already exist in the
                // conversation context to avoid "Duplicate item found" errors
                if (hasConversation && Predicate.isNotNull(id)) {
                  break
                }

                if (config.store === true && Predicate.isNotNull(id)) {
                  messages.push({ type: "item_reference", id })
                  break
                }

                messages.push({
                  id: id!,
                  type: "message",
                  role: "assistant",
                  status: part.options.openai?.status ?? "completed",
                  content: [{
                    type: "output_text",
                    text: part.text,
                    annotations: part.options.openai?.annotations ?? [],
                    logprobs: []
                  }]
                })

                break
              }

              case "reasoning": {
                const id = getItemId(part)
                const encryptedContent = getEncryptedContent(part)

                if (hasConversation && Predicate.isNotNull(id)) {
                  break
                }

                if (Predicate.isNotNull(id)) {
                  const message = reasoningMessages[id]

                  if (config.store === true) {
                    // Use item references to refer to reasoning (single reference)
                    // when the first part is encountered
                    if (Predicate.isUndefined(message)) {
                      messages.push({ type: "item_reference", id })

                      // Store unused reasoning message to mark its id as used
                      reasoningMessages[id] = {
                        type: "reasoning",
                        id,
                        summary: []
                      }
                    }
                  } else {
                    const summaryParts: Array<SummaryTextContent> = []

                    if (part.text.length > 0) {
                      summaryParts.push({ type: "summary_text", text: part.text })
                    }

                    if (Predicate.isUndefined(message)) {
                      reasoningMessages[id] = {
                        type: "reasoning",
                        id,
                        summary: summaryParts,
                        encrypted_content: encryptedContent ?? null
                      }

                      messages.push(reasoningMessages[id])
                    } else {
                      message.summary.push(...summaryParts)

                      // Update encrypted content to enable setting it in the
                      // last summary part
                      if (Predicate.isNotNull(encryptedContent)) {
                        message.encrypted_content = encryptedContent
                      }
                    }
                  }
                }

                break
              }

              case "tool-call": {
                const id = getItemId(part)
                const status = getStatus(part)

                if (hasConversation && Predicate.isNotNull(id)) {
                  break
                }

                if (config.store && Predicate.isNotNull(id)) {
                  messages.push({ type: "item_reference", id })
                  break
                }

                if (part.providerExecuted) {
                  break
                }

                const toolName = toolNameMapper.getProviderName(part.name)

                messages.push({
                  type: "function_call",
                  name: toolName,
                  call_id: part.id,
                  // @effect-diagnostics-next-line preferSchemaOverJson:off
                  arguments: JSON.stringify(part.params),
                  ...(Predicate.isNotNull(id) ? { id } : {}),
                  ...(Predicate.isNotNull(status) ? { status } : {})
                })

                break
              }

              // Assistant tool-result parts are always provider executed
              case "tool-result": {
                // Skip execution denied results - these have no corresponding
                // item in OpenAI's store
                if (
                  Predicate.hasProperty(part.result, "type") &&
                  part.result.type === "execution-denied"
                ) {
                  break
                }

                if (hasConversation) {
                  break
                }

                if (config.store === true) {
                  const id = getItemId(part) ?? part.id
                  messages.push({ type: "item_reference", id })
                }
              }
            }
          }

          break
        }

        case "tool": {
          for (const part of message.content) {
            if (part.type === "tool-approval-response") {
              continue
            }

            const status = getStatus(part)

            messages.push({
              type: "function_call_output",
              call_id: part.id,
              // @effect-diagnostics-next-line preferSchemaOverJson:off
              output: typeof part.result === "string" ? part.result : JSON.stringify(part.result),
              ...(Predicate.isNotNull(status) ? { status } : {})
            })
          }

          break
        }
      }
    }

    return messages
  }
)

// =============================================================================
// HTTP Details
// =============================================================================

const buildHttpRequestDetails = (
  request: HttpClientRequest.HttpClientRequest
): typeof Response.HttpRequestDetails.Type => ({
  method: request.method,
  url: request.url,
  urlParams: Array.from(request.urlParams),
  hash: request.hash,
  headers: Redactable.redact(request.headers) as Record<string, string>
})

const buildHttpResponseDetails = (
  response: HttpClientResponse.HttpClientResponse
): typeof Response.HttpResponseDetails.Type => ({
  status: response.status,
  headers: Redactable.redact(response.headers) as Record<string, string>
})

// =============================================================================
// Response Conversion
// =============================================================================

type ResponseStreamEvent = OpenAiResponseStreamEvent

type NarrowKnownResponseStreamEvent<A> = A extends { readonly type: infer T extends string }
  ? string extends T ? never : A
  : never

type KnownResponseStreamEvent = NarrowKnownResponseStreamEvent<ResponseStreamEvent>

const hasObjectProperty = (value: Record<string, unknown>, key: string): boolean =>
  Predicate.hasProperty(value, key) && typeof value[key] === "object" && value[key] !== null

const hasStringProperty = (value: Record<string, unknown>, key: string): boolean =>
  Predicate.hasProperty(value, key) && typeof value[key] === "string"

const hasNumberProperty = (value: Record<string, unknown>, key: string): boolean =>
  Predicate.hasProperty(value, key) && typeof value[key] === "number"

const isKnownResponseStreamEvent = (
  event: ResponseStreamEvent
): event is KnownResponseStreamEvent => {
  const encodedEvent = event as Record<string, unknown>
  switch (event.type) {
    case "response.created": {
      if (!hasObjectProperty(encodedEvent, "response")) {
        return false
      }
      const response = encodedEvent.response as Record<string, unknown>
      return hasStringProperty(response, "id") &&
        hasStringProperty(response, "model") &&
        hasNumberProperty(response, "created_at")
    }
    case "response.completed":
    case "response.incomplete":
    case "response.failed": {
      return hasObjectProperty(encodedEvent, "response")
    }
    case "response.output_item.added":
    case "response.output_item.done": {
      return hasObjectProperty(encodedEvent, "item") && hasNumberProperty(encodedEvent, "output_index")
    }
    case "response.output_text.delta": {
      return hasStringProperty(encodedEvent, "item_id") && hasStringProperty(encodedEvent, "delta")
    }
    case "response.output_text.annotation.added": {
      return hasStringProperty(encodedEvent, "item_id") && hasObjectProperty(encodedEvent, "annotation")
    }
    case "response.function_call_arguments.delta": {
      return hasStringProperty(encodedEvent, "delta") && hasNumberProperty(encodedEvent, "output_index")
    }
    case "response.reasoning_summary_part.added":
    case "response.reasoning_summary_part.done": {
      return hasStringProperty(encodedEvent, "item_id") && hasNumberProperty(encodedEvent, "summary_index")
    }
    case "response.reasoning_summary_text.delta": {
      return hasStringProperty(encodedEvent, "item_id") &&
        hasStringProperty(encodedEvent, "delta") &&
        hasNumberProperty(encodedEvent, "summary_index")
    }
    case "error": {
      return true
    }
    default: {
      return false
    }
  }
}

const makeResponse = Effect.fnUntraced(
  function*<Tools extends ReadonlyArray<Tool.Any>>({
    rawResponse,
    response,
    toolNameMapper
  }: {
    readonly rawResponse: OpenAiResponse
    readonly response: HttpClientResponse.HttpClientResponse
    readonly toolNameMapper: Tool.NameMapper<Tools>
  }): Effect.fn.Return<
    Array<Response.PartEncoded>,
    AiError.AiError,
    IdGenerator.IdGenerator
  > {
    const idGenerator = yield* IdGenerator.IdGenerator

    let hasToolCalls = false
    const parts: Array<Response.PartEncoded> = []

    const createdAt = new Date(rawResponse.created_at * 1000)
    parts.push({
      type: "response-metadata",
      id: rawResponse.id,
      modelId: rawResponse.model as string,
      timestamp: DateTime.formatIso(DateTime.fromDateUnsafe(createdAt)),
      request: buildHttpRequestDetails(response.request)
    })

    for (const part of rawResponse.output) {
      switch (part.type) {
        case "function_call": {
          hasToolCalls = true
          const toolName = toolNameMapper.getCustomName(part.name)
          const toolParams = part.arguments
          const params = yield* Effect.try({
            try: () => Tool.unsafeSecureJsonParse(toolParams),
            catch: (cause) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "makeResponse",
                reason: new AiError.ToolParameterValidationError({
                  toolName,
                  toolParams: {},
                  description: `Faled to securely JSON parse tool parameters: ${cause}`
                })
              })
          })
          parts.push({
            type: "tool-call",
            id: part.call_id,
            name: toolName,
            params,
            metadata: { openai: { ...makeItemIdMetadata(part.id) } }
          })
          break
        }

        case "message": {
          for (const contentPart of part.content) {
            switch (contentPart.type) {
              case "output_text": {
                const annotationItems = contentPart.annotations ?? []
                const annotations = annotationItems.length > 0
                  ? { annotations: annotationItems as any }
                  : undefined

                parts.push({
                  type: "text",
                  text: contentPart.text,
                  metadata: {
                    openai: {
                      ...makeItemIdMetadata(part.id),
                      ...annotations
                    }
                  }
                })
                for (const annotation of annotationItems) {
                  if (annotation.type === "container_file_citation") {
                    parts.push({
                      type: "source",
                      sourceType: "document",
                      id: yield* idGenerator.generateId(),
                      mediaType: "text/plain",
                      title: annotation.filename,
                      fileName: annotation.filename,
                      metadata: {
                        openai: {
                          type: annotation.type,
                          fileId: annotation.file_id,
                          containerId: annotation.container_id
                        }
                      }
                    })
                  }
                  if (annotation.type === "file_citation") {
                    parts.push({
                      type: "source",
                      sourceType: "document",
                      id: yield* idGenerator.generateId(),
                      mediaType: "text/plain",
                      title: annotation.filename,
                      fileName: annotation.filename,
                      metadata: {
                        openai: {
                          type: annotation.type,
                          fileId: annotation.file_id,
                          index: annotation.index
                        }
                      }
                    })
                  }
                  if (annotation.type === "file_path") {
                    parts.push({
                      type: "source",
                      sourceType: "document",
                      id: yield* idGenerator.generateId(),
                      mediaType: "application/octet-stream",
                      title: annotation.file_id,
                      fileName: annotation.file_id,
                      metadata: {
                        openai: {
                          type: annotation.type,
                          fileId: annotation.file_id,
                          index: annotation.index
                        }
                      }
                    })
                  }
                  if (annotation.type === "url_citation") {
                    parts.push({
                      type: "source",
                      sourceType: "url",
                      id: yield* idGenerator.generateId(),
                      url: annotation.url,
                      title: annotation.title,
                      metadata: {
                        openai: {
                          type: annotation.type,
                          startIndex: annotation.start_index,
                          endIndex: annotation.end_index
                        }
                      }
                    })
                  }
                }
                break
              }
              case "refusal": {
                parts.push({
                  type: "text",
                  text: "",
                  metadata: { openai: { refusal: contentPart.refusal } }
                })
                break
              }
            }
          }
          break
        }

        case "reasoning": {
          const metadata = {
            openai: {
              ...makeItemIdMetadata(part.id),
              ...makeEncryptedContentMetadata(part.encrypted_content)
            }
          }
          // If there are no summary parts, we have to add an empty one to
          // propagate the part identifier and encrypted content
          if (part.summary.length === 0) {
            parts.push({ type: "reasoning", text: "", metadata })
          } else {
            for (const summary of part.summary) {
              parts.push({ type: "reasoning", text: summary.text, metadata })
            }
          }
          break
        }
      }
    }

    const finishReason = InternalUtilities.resolveFinishReason(
      rawResponse.incomplete_details?.reason,
      hasToolCalls
    )
    const serviceTier = normalizeServiceTier(rawResponse.service_tier)

    parts.push({
      type: "finish",
      reason: finishReason,
      usage: getUsage(rawResponse.usage),
      response: buildHttpResponseDetails(response),
      ...(Predicate.isNotUndefined(serviceTier) && { metadata: { openai: { serviceTier } } })
    })

    return parts
  }
)

const makeStreamResponse = Effect.fnUntraced(
  function*<Tools extends ReadonlyArray<Tool.Any>>({
    stream,
    response,
    config,
    toolNameMapper
  }: {
    readonly config: typeof Config.Service
    readonly stream: Stream.Stream<ResponseStreamEvent, AiError.AiError>
    readonly response: HttpClientResponse.HttpClientResponse
    readonly toolNameMapper: Tool.NameMapper<Tools>
  }): Effect.fn.Return<
    Stream.Stream<Response.StreamPartEncoded, AiError.AiError>,
    AiError.AiError,
    IdGenerator.IdGenerator
  > {
    const idGenerator = yield* IdGenerator.IdGenerator

    let hasToolCalls = false

    // Track annotations for current message to include in text-end metadata
    const activeAnnotations: Array<Annotation> = []

    // Track active reasoning items with state machine for proper concluding logic
    const activeReasoning: Record<string, {
      readonly encryptedContent: string | undefined
      readonly summaryParts: Record<number, "active" | "can-conclude" | "concluded">
    }> = {}

    // Track active tool calls
    const activeToolCalls: Record<number, {
      readonly id: string
      readonly name: string
    }> = {}

    return stream.pipe(
      Stream.mapEffect(Effect.fnUntraced(function*(event) {
        const parts: Array<Response.StreamPartEncoded> = []

        if (!isKnownResponseStreamEvent(event)) {
          return parts
        }

        switch (event.type) {
          case "response.created": {
            const createdAt = new Date(event.response.created_at * 1000)
            parts.push({
              type: "response-metadata",
              id: event.response.id,
              modelId: event.response.model,
              timestamp: DateTime.formatIso(DateTime.fromDateUnsafe(createdAt)),
              request: buildHttpRequestDetails(response.request)
            })
            break
          }

          case "error": {
            parts.push({ type: "error", error: event })
            break
          }

          case "response.completed":
          case "response.incomplete":
          case "response.failed": {
            const serviceTier = normalizeServiceTier(event.response.service_tier)
            parts.push({
              type: "finish",
              reason: InternalUtilities.resolveFinishReason(
                event.response.incomplete_details?.reason,
                hasToolCalls
              ),
              usage: getUsage(event.response.usage),
              response: buildHttpResponseDetails(response),
              ...(Predicate.isNotUndefined(serviceTier) && { metadata: { openai: { serviceTier } } })
            })
            break
          }

          case "response.output_item.added": {
            switch (event.item.type) {
              case "function_call": {
                const toolName = toolNameMapper.getCustomName(event.item.name)
                activeToolCalls[event.output_index] = {
                  id: event.item.call_id,
                  name: toolName
                }
                parts.push({
                  type: "tool-params-start",
                  id: event.item.call_id,
                  name: toolName
                })
                break
              }

              case "message": {
                // Clear annotations for new message
                activeAnnotations.length = 0
                parts.push({
                  type: "text-start",
                  id: event.item.id,
                  metadata: { openai: { ...makeItemIdMetadata(event.item.id) } }
                })
                break
              }

              case "reasoning": {
                const encryptedContent = event.item.encrypted_content ?? undefined
                activeReasoning[event.item.id] = {
                  encryptedContent,
                  summaryParts: { 0: "active" }
                }
                parts.push({
                  type: "reasoning-start",
                  id: `${event.item.id}:0`,
                  metadata: {
                    openai: {
                      ...makeItemIdMetadata(event.item.id),
                      ...makeEncryptedContentMetadata(event.item.encrypted_content)
                    }
                  }
                })
                break
              }

              default: {
                break
              }
            }

            break
          }

          case "response.output_item.done": {
            switch (event.item.type) {
              case "function_call": {
                delete activeToolCalls[event.output_index]
                hasToolCalls = true
                const toolName = toolNameMapper.getCustomName(event.item.name)
                const toolParams = event.item.arguments
                const params = yield* Effect.try({
                  try: () => Tool.unsafeSecureJsonParse(toolParams),
                  catch: (cause) =>
                    AiError.make({
                      module: "OpenAiLanguageModel",
                      method: "makeStreamResponse",
                      reason: new AiError.ToolParameterValidationError({
                        toolName,
                        toolParams: {},
                        description: `Failed securely JSON parse tool parameters: ${cause}`
                      })
                    })
                })
                parts.push({
                  type: "tool-params-end",
                  id: event.item.call_id
                })
                parts.push({
                  type: "tool-call",
                  id: event.item.call_id,
                  name: toolName,
                  params,
                  metadata: { openai: { ...makeItemIdMetadata(event.item.id) } }
                })
                break
              }

              case "message": {
                const annotations = activeAnnotations.length > 0
                  ? { annotations: activeAnnotations.slice() }
                  : undefined
                parts.push({
                  type: "text-end",
                  id: event.item.id,
                  metadata: { openai: { ...annotations, ...makeItemIdMetadata(event.item.id) } }
                })
                break
              }

              case "reasoning": {
                const reasoningPart = activeReasoning[event.item.id]
                for (const [summaryIndex, status] of Object.entries(reasoningPart.summaryParts)) {
                  if (status === "active" || status === "can-conclude") {
                    parts.push({
                      type: "reasoning-end",
                      id: `${event.item.id}:${summaryIndex}`,
                      metadata: {
                        openai: {
                          ...makeItemIdMetadata(event.item.id),
                          ...makeEncryptedContentMetadata(event.item.encrypted_content)
                        }
                      }
                    })
                  }
                }
                delete activeReasoning[event.item.id]
                break
              }

              default: {
                break
              }
            }

            break
          }

          case "response.output_text.delta": {
            parts.push({
              type: "text-delta",
              id: event.item_id,
              delta: event.delta
            })
            break
          }

          case "response.output_text.annotation.added": {
            const annotation = event.annotation as Annotation
            // Track annotation for text-end metadata
            activeAnnotations.push(annotation)
            if (annotation.type === "container_file_citation") {
              parts.push({
                type: "source",
                sourceType: "document",
                id: yield* idGenerator.generateId(),
                mediaType: "text/plain",
                title: annotation.filename,
                fileName: annotation.filename,
                metadata: {
                  openai: {
                    type: annotation.type,
                    fileId: annotation.file_id,
                    containerId: annotation.container_id
                  }
                }
              })
            } else if (annotation.type === "file_citation") {
              parts.push({
                type: "source",
                sourceType: "document",
                id: yield* idGenerator.generateId(),
                mediaType: "text/plain",
                title: annotation.filename,
                fileName: annotation.filename,
                metadata: {
                  openai: {
                    type: annotation.type,
                    fileId: annotation.file_id,
                    index: annotation.index
                  }
                }
              })
            } else if (annotation.type === "file_path") {
              parts.push({
                type: "source",
                sourceType: "document",
                id: yield* idGenerator.generateId(),
                mediaType: "application/octet-stream",
                title: annotation.file_id,
                fileName: annotation.file_id,
                metadata: {
                  openai: {
                    type: annotation.type,
                    fileId: annotation.file_id,
                    index: annotation.index
                  }
                }
              })
            } else if (annotation.type === "url_citation") {
              parts.push({
                type: "source",
                sourceType: "url",
                id: yield* idGenerator.generateId(),
                url: annotation.url,
                title: annotation.title,
                metadata: {
                  openai: {
                    type: annotation.type,
                    startIndex: annotation.start_index,
                    endIndex: annotation.end_index
                  }
                }
              })
            }
            break
          }

          case "response.function_call_arguments.delta": {
            const toolCallPart = activeToolCalls[event.output_index]
            if (Predicate.isNotUndefined(toolCallPart)) {
              parts.push({
                type: "tool-params-delta",
                id: toolCallPart.id,
                delta: event.delta
              })
            }
            break
          }

          case "response.reasoning_summary_part.added": {
            // The first reasoning start is pushed in the `response.output_item.added` block
            if (event.summary_index > 0) {
              const reasoningPart = activeReasoning[event.item_id]
              if (Predicate.isNotUndefined(reasoningPart)) {
                // Conclude all can-conclude parts before starting new one
                for (const [summaryIndex, status] of Object.entries(reasoningPart.summaryParts)) {
                  if (status === "can-conclude") {
                    parts.push({
                      type: "reasoning-end",
                      id: `${event.item_id}:${summaryIndex}`,
                      metadata: {
                        openai: {
                          ...makeItemIdMetadata(event.item_id),
                          ...makeEncryptedContentMetadata(reasoningPart.encryptedContent)
                        }
                      }
                    })
                    reasoningPart.summaryParts[Number(summaryIndex)] = "concluded"
                  }
                }
                reasoningPart.summaryParts[event.summary_index] = "active"
              }
              parts.push({
                type: "reasoning-start",
                id: `${event.item_id}:${event.summary_index}`,
                metadata: {
                  openai: {
                    ...makeItemIdMetadata(event.item_id),
                    ...makeEncryptedContentMetadata(reasoningPart.encryptedContent)
                  }
                }
              })
            }
            break
          }

          case "response.reasoning_summary_text.delta": {
            parts.push({
              type: "reasoning-delta",
              id: `${event.item_id}:${event.summary_index}`,
              delta: event.delta,
              metadata: { openai: { ...makeItemIdMetadata(event.item_id) } }
            })
            break
          }

          case "response.reasoning_summary_part.done": {
            // When OpenAI stores message data, we can immediately conclude the
            // reasoning part given that we do not need the encrypted content
            if (config.store === true) {
              parts.push({
                type: "reasoning-end",
                id: `${event.item_id}:${event.summary_index}`,
                metadata: { openai: { ...makeItemIdMetadata(event.item_id) } }
              })
              // Mark the summary part concluded
              activeReasoning[event.item_id].summaryParts[event.summary_index] = "concluded"
            } else {
              // Mark the summary part as can-conclude given we still need a
              // final summary part with the encrypted content
              activeReasoning[event.item_id].summaryParts[event.summary_index] = "can-conclude"
            }
            break
          }
        }

        return parts
      })),
      Stream.flattenIterable
    )
  }
)

// =============================================================================
// Telemetry
// =============================================================================

const annotateRequest = (
  span: Span,
  request: CreateResponse
): void => {
  addGenAIAnnotations(span, {
    system: "openai",
    operation: { name: "chat" },
    request: {
      model: request.model as string,
      temperature: request.temperature as number | undefined,
      topP: request.top_p as number | undefined,
      maxTokens: request.max_output_tokens as number | undefined
    },
    openai: {
      request: {
        responseFormat: (request.text as any)?.format?.type,
        serviceTier: request.service_tier as string | undefined
      }
    }
  })
}

const annotateResponse = (span: Span, response: OpenAiResponse): void => {
  const finishReason = response.incomplete_details?.reason as string | undefined
  addGenAIAnnotations(span, {
    response: {
      id: response.id,
      model: response.model as string,
      finishReasons: Predicate.isNotUndefined(finishReason) ? [finishReason] : undefined
    },
    usage: {
      inputTokens: response.usage?.input_tokens as number | undefined,
      outputTokens: response.usage?.output_tokens as number | undefined
    },
    openai: {
      response: {
        serviceTier: response.service_tier as string | undefined
      }
    }
  })
}

const annotateStreamResponse = (span: Span, part: Response.StreamPartEncoded) => {
  if (part.type === "response-metadata") {
    addGenAIAnnotations(span, {
      response: {
        id: part.id,
        model: part.modelId
      }
    })
  }
  if (part.type === "finish") {
    const serviceTier = (part.metadata as any)?.openai?.serviceTier as string | undefined
    addGenAIAnnotations(span, {
      response: {
        finishReasons: [part.reason]
      },
      usage: {
        inputTokens: part.usage.inputTokens.total,
        outputTokens: part.usage.outputTokens.total
      },
      openai: {
        response: { serviceTier }
      }
    })
  }
}

// =============================================================================
// Tool Conversion
// =============================================================================

type OpenAiToolChoice = CreateResponse["tool_choice"]

const prepareTools = Effect.fnUntraced(function*<Tools extends ReadonlyArray<Tool.Any>>({
  config,
  options,
  toolNameMapper
}: {
  readonly config: typeof Config.Service
  readonly options: LanguageModel.ProviderOptions
  readonly toolNameMapper: Tool.NameMapper<Tools>
}): Effect.fn.Return<{
  readonly tools: ReadonlyArray<OpenAiClientTool> | undefined
  readonly toolChoice: OpenAiToolChoice | undefined
}, AiError.AiError> {
  // Return immediately if no tools are in the toolkit
  if (options.tools.length === 0) {
    return { tools: undefined, toolChoice: undefined }
  }

  const tools: Array<OpenAiClientTool> = []
  let toolChoice: OpenAiToolChoice | undefined = undefined

  // Filter the incoming tools down to the set of allowed tools as indicated by
  // the tool choice. This must be done here given that there is no tool name
  // in OpenAI's provider-defined tools, so there would be no way to perform
  // this filter otherwise
  let allowedTools = options.tools
  if (typeof options.toolChoice === "object" && "oneOf" in options.toolChoice) {
    const allowedToolNames = new Set(options.toolChoice.oneOf)
    allowedTools = options.tools.filter((tool) => allowedToolNames.has(tool.name))
    toolChoice = options.toolChoice.mode === "required" ? "required" : "auto"
  }

  // Convert the tools in the toolkit to the provider-defined format
  for (const tool of allowedTools) {
    if (Tool.isUserDefined(tool)) {
      const strict = Tool.getStrictMode(tool) ?? config.strictJsonSchema ?? true
      tools.push({
        type: "function",
        name: tool.name,
        description: Tool.getDescription(tool) ?? null,
        parameters: Tool.getJsonSchema(tool) as { readonly [x: string]: Schema.Json },
        strict
      })
    }

    if (Tool.isProviderDefined(tool)) {
      tools.push({
        type: "function",
        name: tool.providerName,
        description: Tool.getDescription(tool) ?? null,
        parameters: Tool.getJsonSchema(tool) as { readonly [x: string]: Schema.Json },
        strict: config.strictJsonSchema ?? true
      })
    }
  }

  if (options.toolChoice === "auto" || options.toolChoice === "none" || options.toolChoice === "required") {
    toolChoice = options.toolChoice
  }

  if (typeof options.toolChoice === "object" && "tool" in options.toolChoice) {
    const toolName = toolNameMapper.getProviderName(options.toolChoice.tool)
    const providerNames = toolNameMapper.providerNames
    if (providerNames.includes(toolName)) {
      toolChoice = { type: "function", name: toolName }
    } else {
      toolChoice = { type: "function", name: options.toolChoice.tool }
    }
  }

  return { tools, toolChoice }
})

// =============================================================================
// Utilities
// =============================================================================

const isFileId = (data: string, config: typeof Config.Service): boolean =>
  config.fileIdPrefixes != null && config.fileIdPrefixes.some((prefix) => data.startsWith(prefix))

const getItemId = (
  part:
    | Prompt.TextPart
    | Prompt.ReasoningPart
    | Prompt.ToolCallPart
    | Prompt.ToolResultPart
): string | null => part.options.openai?.itemId ?? null
const getStatus = (
  part:
    | Prompt.TextPart
    | Prompt.ToolCallPart
    | Prompt.ToolResultPart
): MessageStatus | null => part.options.openai?.status ?? null
const getEncryptedContent = (
  part: Prompt.ReasoningPart
): string | null => part.options.openai?.encryptedContent ?? null

const getImageDetail = (part: Prompt.FilePart): ImageDetail => part.options.openai?.imageDetail ?? "auto"

const makeItemIdMetadata = (itemId: string | undefined) => Predicate.isNotUndefined(itemId) ? { itemId } : undefined

const makeEncryptedContentMetadata = (encryptedContent: string | null | undefined) =>
  Predicate.isNotNullish(encryptedContent) ? { encryptedContent } : undefined

const normalizeServiceTier = (
  serviceTier: string | undefined
): "default" | "auto" | "flex" | "scale" | "priority" | null | undefined => {
  switch (serviceTier) {
    case undefined:
      return undefined
    case "default":
    case "auto":
    case "flex":
    case "scale":
    case "priority":
      return serviceTier
    default:
      return null
  }
}

const prepareResponseFormat = ({ config, options }: {
  readonly config: typeof Config.Service
  readonly options: LanguageModel.ProviderOptions
}): TextResponseFormatConfiguration => {
  if (options.responseFormat.type === "json") {
    const name = options.responseFormat.objectName
    const schema = options.responseFormat.schema
    return {
      type: "json_schema",
      name,
      description: AST.resolveDescription(schema.ast) ?? "Response with a JSON object",
      schema: Tool.getJsonSchemaFromSchema(schema) as any,
      strict: config.strictJsonSchema ?? true
    }
  }
  return { type: "text" }
}

interface ModelCapabilities {
  readonly isReasoningModel: boolean
  readonly systemMessageMode: "remove" | "system" | "developer"
  readonly supportsFlexProcessing: boolean
  readonly supportsPriorityProcessing: boolean
  /**
   * Allow temperature, topP, logProbs when reasoningEffort is none.
   */
  readonly supportsNonReasoningParameters: boolean
}

const getModelCapabilities = (modelId: string): ModelCapabilities => {
  const supportsFlexProcessing = modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini") ||
    (modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-chat"))

  const supportsPriorityProcessing = modelId.startsWith("gpt-4") ||
    modelId.startsWith("gpt-5-mini") ||
    (modelId.startsWith("gpt-5") &&
      !modelId.startsWith("gpt-5-nano") &&
      !modelId.startsWith("gpt-5-chat")) ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini")

  // Use allowlist approach: only known reasoning models should use 'developer' role
  // This prevents issues with fine-tuned models, third-party models, and custom models
  const isReasoningModel = modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini") ||
    modelId.startsWith("codex-mini") ||
    modelId.startsWith("computer-use-preview") ||
    (modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-chat"))

  // https://platform.openai.com/docs/guides/latest-model#gpt-5-1-parameter-compatibility
  // GPT-5.1 and GPT-5.2 support temperature, topP, logProbs when reasoningEffort is none
  const supportsNonReasoningParameters = modelId.startsWith("gpt-5.1") || modelId.startsWith("gpt-5.2")

  const systemMessageMode = isReasoningModel ? "developer" : "system"

  return {
    supportsFlexProcessing,
    supportsPriorityProcessing,
    isReasoningModel,
    systemMessageMode,
    supportsNonReasoningParameters
  }
}

const getUsage = (usage: ResponseUsage | null | undefined): Response.Usage => {
  if (Predicate.isNullish(usage)) {
    return {
      inputTokens: {
        uncached: undefined,
        total: undefined,
        cacheRead: undefined,
        cacheWrite: undefined
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined
      }
    }
  }

  const inputTokens = usage.input_tokens
  const outputTokens = usage.output_tokens
  const cachedTokens = getUsageDetailNumber(usage.input_tokens_details, "cached_tokens") ?? 0
  const reasoningTokens = getUsageDetailNumber(usage.output_tokens_details, "reasoning_tokens") ?? 0

  return {
    inputTokens: {
      uncached: inputTokens - cachedTokens,
      total: inputTokens,
      cacheRead: cachedTokens,
      cacheWrite: undefined
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens - reasoningTokens,
      reasoning: reasoningTokens
    }
  }
}

const getUsageDetailNumber = (
  details: unknown,
  field: string
): number | undefined => {
  if (typeof details !== "object" || details === null) {
    return undefined
  }

  const value = (details as Record<string, unknown>)[field]
  return typeof value === "number" ? value : undefined
}
