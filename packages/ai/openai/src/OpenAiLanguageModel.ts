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
import * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import type { Span } from "effect/Tracer"
import type { DeepMutable, Simplify } from "effect/Types"
import * as AiError from "effect/unstable/ai/AiError"
import * as IdGenerator from "effect/unstable/ai/IdGenerator"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import type * as Prompt from "effect/unstable/ai/Prompt"
import type * as Response from "effect/unstable/ai/Response"
import * as Tool from "effect/unstable/ai/Tool"
import type * as Generated from "./Generated.ts"
import * as InternalUtilities from "./internal/utilities.ts"
import { OpenAiClient } from "./OpenAiClient.ts"
import { addGenAIAnnotations } from "./OpenAiTelemetry.ts"
import * as OpenAiTool from "./OpenAiTool.ts"

/**
 * OpenAI model identifier type.
 *
 * @since 1.0.0
 * @category models
 */
export type Model = typeof Generated.ModelIdsResponses.Encoded

// =============================================================================
// Configuration
// =============================================================================

/**
 * Context tag for OpenAI language model configuration.
 *
 * @since 1.0.0
 * @category context
 */
export class Config extends ServiceMap.Service<
  Config,
  Simplify<
    & Partial<
      Omit<
        typeof Generated.CreateResponse.Encoded,
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
>()("@effect/ai-openai/OpenAiLanguageModel/Config") {}

// =============================================================================
// OpenAI Provider Options / Metadata
// =============================================================================

declare module "effect/unstable/ai/Prompt" {
  export interface FilePartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The detail level of the image to be sent to the model. One of `high`, `low`, or `auto`. Defaults to `auto`.
       */
      readonly imageDetail?: typeof Generated.ImageDetail.Encoded | undefined
    } | undefined
  }

  export interface ReasoningPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
      /**
       * The encrypted content of the reasoning item - populated when a response
       * is generated with `reasoning.encrypted_content` in the `include`
       * parameter.
       */
      readonly encryptedContent?: string | undefined
    } | undefined
  }

  export interface ToolCallPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
      /**
       * The status of item.
       */
      readonly status?: typeof Generated.Message.Encoded["status"] | undefined
    } | undefined
  }

  export interface ToolResultPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
      /**
       * The status of item.
       */
      readonly status?: typeof Generated.Message.Encoded["status"] | undefined
    } | undefined
  }

  export interface TextPartOptions extends ProviderOptions {
    readonly openai?: {
      /**
       * The ID of the item to reference.
       */
      readonly itemId?: string | undefined
      /**
       * The status of item.
       */
      readonly status?: typeof Generated.Message.Encoded["status"] | undefined
      /**
       * A list of annotations that apply to the output text.
       */
      readonly annotations?: ReadonlyArray<typeof Generated.Annotation.Encoded> | undefined
    } | undefined
  }
}

declare module "effect/unstable/ai/Response" {
  export interface TextPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
      /**
       * If the model emits a refusal content part, the refusal explanation
       * from the model will be contained in the metadata of an empty text
       * part.
       */
      readonly refusal?: string
      /**
       * The status of item.
       */
      readonly status?: typeof Generated.Message.Encoded["status"] | undefined
    }
  }

  export interface TextStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
    }
  }

  export interface ReasoningPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
      readonly encryptedContent?: string
    }
  }

  export interface ReasoningStartPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
      readonly encryptedContent?: string
    }
  }

  export interface ReasoningDeltaPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
    }
  }

  export interface ReasoningEndPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
      readonly encryptedContent?: string
    }
  }

  export interface ToolCallPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly itemId?: string
    }
  }

  export interface DocumentSourcePartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly type: "file_citation"
      /**
       * The index of the file in the list of files.
       */
      readonly index: number
    }
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
    }
  }

  export interface FinishPartMetadata extends ProviderMetadata {
    readonly openai?: {
      readonly serviceTier?: "default" | "auto" | "flex" | "scale" | "priority"
    }
  }
}

// =============================================================================
// OpenAI Language Model
// =============================================================================

/**
 * Creates an OpenAI language model service.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*({ model, config: providerConfig }: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<typeof Config.Service, "model"> | undefined
}) {
  const client = yield* OpenAiClient

  const makeRequest = Effect.fnUntraced(
    function*(options): Effect.fn.Return<typeof Generated.CreateResponse.Encoded, AiError.AiError> {
      const services = yield* Effect.services<never>()
      const config = { model, ...providerConfig, ...services.mapUnsafe.get(Config.key) }
      const include = new Set<string>()
      const capabilities = getModelCapabilities(config.model)
      const toolNameMapper = OpenAiTool.createToolNameMapper(options.tools)
      const messages = yield* prepareMessages({
        config,
        options,
        capabilities,
        include,
        toolNameMapper
      })
      const { toolChoice, tools } = yield* prepareTools({
        options,
        toolNameMapper
      })
      const responseFormat = prepareResponseFormat({
        config,
        options
      })
      const request: typeof Generated.CreateResponse.Encoded = {
        ...config,
        input: messages,
        include: include.size > 0 ? include : null,
        text: { ...config.text, format: responseFormat },
        tools,
        tool_choice: toolChoice
      }
      return request
    }
  )

  return yield* LanguageModel.make({
    generateText: Effect.fnUntraced(
      function*(options) {
        const request = yield* makeRequest(options)
        annotateRequest(options.span, request)
        const rawResponse = yield* client.createResponse(request)
        annotateResponse(options.span, rawResponse)
        return yield* makeResponse(rawResponse, options)
      }
    ),
    streamText: Effect.fnUntraced(
      function*(options) {
        const request = yield* makeRequest(options)
        annotateRequest(options.span, request)
        return client.createResponseStream(request)
      },
      (effect, options) =>
        effect.pipe(
          Effect.flatMap((stream) => makeStreamResponse(stream, options)),
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
    readonly include: Set<string>
    readonly capabilities: ModelCapabilities
    readonly toolNameMapper: Tool.NameMapper<Tools>
  }): Effect.fn.Return<ReadonlyArray<typeof Generated.InputItem.Encoded>, AiError.AiError> {
    const hasConversation = Predicate.isNotNullish(config.conversation)

    // Provider-Defined Tools
    const applyPatchTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.ApplyPatch> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiApplyPatch"
    )
    const codeInterpreterTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.CodeInterpreter> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiCodeInterpreter"
    )
    const shellTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.FunctionShell> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiFunctionShell"
    )
    const localShellTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.LocalShell> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiLocalShell"
    )
    const webSearchTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.WebSearch> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiWebSearch"
    )
    const webSearchPreviewTool = options.tools.find((tool): tool is ReturnType<typeof OpenAiTool.WebSearchPreview> =>
      Tool.isProviderDefined(tool) && tool.name === "OpenAiWebSearchPreview"
    )

    // Handle Included Features
    if (Predicate.isNotUndefined(config.top_logprobs)) {
      include.add("message.output_text.logprobs")
    }
    if (config.store === false && capabilities.isReasoningModel) {
      include.add("reasoning.encrypted_content")
    }
    if (Predicate.isNotUndefined(codeInterpreterTool)) {
      include.add("code_interpreter_call.outputs")
    }
    if (Predicate.isNotUndefined(webSearchTool) || Predicate.isNotUndefined(webSearchPreviewTool)) {
      include.add("web_search_call.action.sources")
    }

    const messages: Array<typeof Generated.InputItem.Encoded> = []

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
          const content: Array<typeof Generated.InputContent.Encoded> = []

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
          const reasoningMessages: Record<string, DeepMutable<typeof Generated.ReasoningItem.Encoded>> = {}

          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                const id = getItemId(part)

                // When in conversation mode, skip items that already exist in the
                // conversation context to avoid "Duplicate item found" errors
                if (hasConversation && Predicate.isNotUndefined(id)) {
                  break
                }

                if (config.store === true && Predicate.isNotUndefined(id)) {
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
                    annotations: part.options.openai?.annotations ?? []
                  }]
                })

                break
              }

              case "reasoning": {
                const id = getItemId(part)
                const encryptedContent = getEncryptedContent(part)

                if (hasConversation && Predicate.isNotUndefined(id)) {
                  break
                }

                if (Predicate.isNotUndefined(id)) {
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
                    const summaryParts: Array<typeof Generated.SummaryTextContent.Encoded> = []

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
                      if (Predicate.isNotUndefined(encryptedContent)) {
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

                if (hasConversation && Predicate.isNotUndefined(id)) {
                  break
                }

                if (config.store && Predicate.isNotUndefined(id)) {
                  messages.push({ type: "item_reference", id })
                  break
                }

                if (part.providerExecuted) {
                  break
                }

                const toolName = toolNameMapper.getProviderName(part.name)

                if (Predicate.isNotUndefined(localShellTool) && toolName === "local_shell") {
                  const args = yield* Schema.decodeUnknownEffect(localShellTool.argsSchema)(part.params).pipe(
                    // TODO: more detailed, tool-call specific error
                    Effect.mapError((error) =>
                      AiError.make({
                        module: "OpenAiLanguageModel",
                        method: "prepareMessages",
                        reason: new AiError.InvalidRequestError({ description: error.message })
                      })
                    )
                  )

                  messages.push({
                    id: id!,
                    type: "local_shell_call",
                    call_id: part.id,
                    status: status ?? "completed",
                    action: args.action
                  })

                  break
                }

                if (Predicate.isNotUndefined(shellTool) && toolName === "shell") {
                  const args = yield* Schema.decodeUnknownEffect(shellTool.argsSchema)(part.params).pipe(
                    // TODO: more detailed, tool-call specific error
                    Effect.mapError((error) =>
                      AiError.make({
                        module: "OpenAiLanguageModel",
                        method: "prepareMessages",
                        reason: new AiError.InvalidRequestError({ description: error.message })
                      })
                    )
                  )

                  messages.push({
                    id: id!,
                    type: "shell_call",
                    call_id: part.id,
                    status: status ?? "completed",
                    action: args.action
                  })

                  break
                }

                messages.push({
                  type: "function_call",
                  name: toolName,
                  call_id: part.id,
                  arguments: JSON.stringify(part.params),
                  ...(Predicate.isNotUndefined(id) ? { id } : {}),
                  ...(Predicate.isNotUndefined(status) ? { status } : {})
                })

                break
              }

              // Assistant tool-result parts are always provider executed
              case "tool-result": {
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
            const id = getItemId(part) ?? part.id
            const status = getStatus(part)
            const toolName = toolNameMapper.getProviderName(part.name)

            if (Predicate.isNotUndefined(applyPatchTool) && toolName === "apply_patch") {
              messages.push({
                id,
                type: "apply_patch_call_output",
                call_id: part.id,
                ...(part.result as any)
              })
            }

            if (Predicate.isNotUndefined(shellTool) && toolName === "shell") {
              messages.push({
                id,
                type: "shell_call_output",
                call_id: part.id,
                output: part.result as any,
                ...(Predicate.isNotUndefined(status) ? { status } : {})
              })
            }

            if (Predicate.isNotUndefined(localShellTool) && toolName === "local_shell") {
              messages.push({
                id,
                type: "local_shell_call_output",
                call_id: part.id,
                output: part.result as any,
                ...(Predicate.isNotUndefined(status) ? { status } : {})
              })
            }

            messages.push({
              id,
              type: "function_call_output",
              call_id: part.id,
              output: JSON.stringify(part.result),
              ...(Predicate.isNotUndefined(status) ? { status } : {})
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
// Response Conversion
// =============================================================================

type ResponseStreamEvent = typeof Generated.ResponseStreamEvent.Type

const makeResponse: (
  response: Generated.Response,
  options: LanguageModel.ProviderOptions
) => Effect.Effect<
  Array<Response.PartEncoded>,
  AiError.AiError,
  IdGenerator.IdGenerator
> = Effect.fnUntraced(
  function*(response, options) {
    const idGenerator = yield* IdGenerator.IdGenerator

    const webSearchTool = options.tools.find((tool) =>
      Tool.isProviderDefined(tool) &&
      (tool.id === "openai.web_search" ||
        tool.id === "openai.web_search_preview")
    ) as Tool.AnyProviderDefined | undefined

    let hasToolCalls = false
    const parts: Array<Response.PartEncoded> = []

    const createdAt = new Date(response.created_at * 1000)
    parts.push({
      type: "response-metadata",
      id: response.id,
      modelId: response.model as string,
      timestamp: DateTime.formatIso(DateTime.fromDateUnsafe(createdAt))
    })

    for (const part of response.output) {
      switch (part.type) {
        case "message": {
          for (const contentPart of part.content) {
            switch (contentPart.type) {
              case "output_text": {
                parts.push({
                  type: "text",
                  text: contentPart.text,
                  metadata: { openai: { ...makeItemIdMetadata(part.id), status: part.status } }
                })

                for (const annotation of contentPart.annotations) {
                  if (annotation.type === "file_citation") {
                    parts.push({
                      type: "source",
                      sourceType: "document",
                      id: yield* idGenerator.generateId(),
                      mediaType: "text/plain",
                      title: annotation.filename ?? "Untitled Document",
                      metadata: { openai: { type: "file_citation", index: annotation.index } }
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
                          type: "url_citation",
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

        case "function_call": {
          hasToolCalls = true

          const toolName = part.name
          const toolParams = part.arguments

          const params = yield* Effect.try({
            try: () => Tool.unsafeSecureJsonParse(toolParams),
            catch: (cause) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "makeResponse",
                reason: new AiError.OutputParseError({
                  rawOutput: toolParams,
                  cause
                })
              })
          })

          parts.push({
            type: "tool-call",
            id: part.call_id,
            name: toolName,
            params,
            metadata: makeItemIdMetadata(part.id)
          })

          break
        }

        case "code_interpreter_call": {
          parts.push({
            type: "tool-call",
            id: part.id,
            name: "OpenAiCodeInterpreter",
            params: { code: part.code, container_id: part.container_id },
            providerName: "code_interpreter",
            providerExecuted: true
          })

          parts.push({
            type: "tool-result",
            id: part.id,
            name: "OpenAiCodeInterpreter",
            isFailure: false,
            result: part.outputs,
            providerName: "code_interpreter",
            providerExecuted: true
          })

          break
        }

        case "file_search_call": {
          parts.push({
            type: "tool-call",
            id: part.id,
            name: "OpenAiFileSearch",
            params: {},
            providerName: "file_search",
            providerExecuted: true
          })

          parts.push({
            type: "tool-result",
            id: part.id,
            name: "OpenAiFileSearch",
            isFailure: false,
            result: {
              status: part.status,
              queries: part.queries,
              ...(part.results && { results: part.results })
            },
            providerName: "file_search",
            providerExecuted: true
          })

          break
        }

        case "web_search_call": {
          parts.push({
            type: "tool-call",
            id: part.id,
            name: webSearchTool?.name ?? "OpenAiWebSearch",
            params: { action: part.action },
            providerName: webSearchTool?.providerName ?? "web_search",
            providerExecuted: true
          })

          parts.push({
            type: "tool-result",
            id: part.id,
            name: webSearchTool?.name ?? "OpenAiWebSearch",
            isFailure: false,
            result: { status: part.status },
            providerName: webSearchTool?.providerName ?? "web_search",
            providerExecuted: true
          })

          break
        }

        case "reasoning": {
          // If there are no summary parts, we have to add an empty one to
          // propagate the part identifier
          if (part.summary.length === 0) {
            parts.push({
              type: "reasoning",
              text: "",
              metadata: makeItemIdMetadata(part.id)
            })
          } else {
            for (const summary of part.summary) {
              const encryptedContent = part.encrypted_content ?? undefined
              parts.push({
                type: "reasoning",
                text: summary.text,
                metadata: {
                  openai: {
                    itemId: part.id,
                    ...(encryptedContent != null && { encryptedContent })
                  }
                }
              })
            }
          }

          break
        }
      }
    }

    const finishReason = InternalUtilities.resolveFinishReason(
      response.incomplete_details?.reason,
      hasToolCalls
    )

    parts.push({
      type: "finish",
      reason: finishReason,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens
      },
      ...(response.service_tier && { metadata: { openai: { serviceTier: response.service_tier } } })
    })

    return parts
  }
)

const makeStreamResponse: (
  stream: Stream.Stream<ResponseStreamEvent, AiError.AiError>,
  options: LanguageModel.ProviderOptions
) => Effect.Effect<
  Stream.Stream<Response.StreamPartEncoded, AiError.AiError>,
  never,
  IdGenerator.IdGenerator
> = Effect.fnUntraced(
  function*(stream, options) {
    const idGenerator = yield* IdGenerator.IdGenerator

    let hasToolCalls = false

    const activeReasoning: Record<string, {
      readonly summaryParts: Array<number>
      readonly encryptedContent: string | undefined
    }> = {}

    const activeToolCalls: Record<number, {
      readonly id: string
      readonly name: string
    }> = {}

    const webSearchTool = options.tools.find((tool) =>
      Tool.isProviderDefined(tool) &&
      (tool.id === "openai.web_search" ||
        tool.id === "openai.web_search_preview")
    ) as Tool.AnyProviderDefined | undefined

    return stream.pipe(
      Stream.mapEffect(Effect.fnUntraced(function*(event) {
        const parts: Array<Response.StreamPartEncoded> = []

        switch (event.type) {
          case "response.created": {
            const createdAt = new Date(event.response.created_at * 1000)
            parts.push({
              type: "response-metadata",
              id: event.response.id,
              modelId: event.response.model as string,
              timestamp: DateTime.formatIso(DateTime.fromDateUnsafe(createdAt))
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
            parts.push({
              type: "finish",
              reason: InternalUtilities.resolveFinishReason(
                event.response.incomplete_details?.reason,
                hasToolCalls
              ),
              usage: {
                inputTokens: event.response.usage?.input_tokens,
                outputTokens: event.response.usage?.output_tokens,
                totalTokens: (event.response.usage?.input_tokens ?? 0) + (event.response.usage?.output_tokens ?? 0),
                reasoningTokens: event.response.usage?.output_tokens_details?.reasoning_tokens,
                cachedInputTokens: event.response.usage?.input_tokens_details?.cached_tokens
              },
              ...(event.response.service_tier && { metadata: { openai: { serviceTier: event.response.service_tier } } })
            })
            break
          }

          case "response.output_item.added": {
            switch (event.item.type) {
              case "computer_call": {
                // TODO(Max): support computer use
                break
              }

              case "file_search_call": {
                activeToolCalls[event.output_index] = {
                  id: event.item.id,
                  name: "OpenAiFileSearch"
                }
                parts.push({
                  type: "tool-params-start",
                  id: event.item.id,
                  name: "OpenAiFileSearch",
                  providerName: "file_search",
                  providerExecuted: true
                })
                break
              }

              case "function_call": {
                activeToolCalls[event.output_index] = {
                  id: event.item.call_id,
                  name: event.item.name
                }
                parts.push({
                  type: "tool-params-start",
                  id: event.item.call_id,
                  name: event.item.name
                })
                break
              }

              case "message": {
                parts.push({
                  type: "text-start",
                  id: event.item.id,
                  metadata: makeItemIdMetadata(event.item.id)
                })
                break
              }

              case "reasoning": {
                const encryptedContent = event.item.encrypted_content ?? undefined
                activeReasoning[event.item.id] = {
                  summaryParts: [0],
                  encryptedContent
                }
                parts.push({
                  type: "reasoning-start",
                  id: `${event.item.id}:0`,
                  metadata: {
                    openai: {
                      itemId: event.item.id,
                      ...(encryptedContent && { encryptedContent })
                    }
                  }
                })
                break
              }

              case "web_search_call": {
                activeToolCalls[event.output_index] = {
                  id: event.item.id,
                  name: webSearchTool?.name ?? "OpenAiWebSearch"
                }
                parts.push({
                  type: "tool-params-start",
                  id: event.item.id,
                  name: webSearchTool?.name ?? "OpenAiWebSearch",
                  providerName: webSearchTool?.providerName ?? "web_search",
                  providerExecuted: true
                })
                break
              }
            }

            break
          }

          case "response.output_item.done": {
            switch (event.item.type) {
              case "code_interpreter_call": {
                parts.push({
                  type: "tool-call",
                  id: event.item.id,
                  name: "OpenAiCodeInterpreter",
                  params: { code: event.item.code, container_id: event.item.container_id },
                  providerName: "code_interpreter",
                  providerExecuted: true
                })
                parts.push({
                  type: "tool-result",
                  id: event.item.id,
                  name: "OpenAiCodeInterpreter",
                  isFailure: false,
                  result: { outputs: event.item.outputs },
                  providerName: "code_interpreter",
                  providerExecuted: true
                })
                break
              }

              // TODO(Max): support computer use
              case "computer_call": {
                break
              }

              case "file_search_call": {
                delete activeToolCalls[event.output_index]
                parts.push({
                  type: "tool-params-end",
                  id: event.item.id
                })
                parts.push({
                  type: "tool-call",
                  id: event.item.id,
                  name: "OpenAiFileSearch",
                  params: {},
                  providerName: "file_search",
                  providerExecuted: true
                })
                parts.push({
                  type: "tool-result",
                  id: event.item.id,
                  name: "OpenAiFileSearch",
                  isFailure: false,
                  result: {
                    status: event.item.status,
                    queries: event.item.queries,
                    ...(event.item.results && { results: event.item.results })
                  },
                  providerName: "file_search",
                  providerExecuted: true
                })
                break
              }

              case "function_call": {
                hasToolCalls = true

                const toolName = event.item.name
                const toolParams = event.item.arguments

                const params = yield* Effect.try({
                  try: () => Tool.unsafeSecureJsonParse(toolParams),
                  catch: (cause) =>
                    AiError.make({
                      module: "OpenAiLanguageModel",
                      method: "makeStreamResponse",
                      reason: new AiError.OutputParseError({
                        rawOutput: toolParams,
                        cause
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
                  metadata: makeItemIdMetadata(event.item.id)
                })

                delete activeToolCalls[event.output_index]

                break
              }

              case "message": {
                parts.push({
                  type: "text-end",
                  id: event.item.id
                })
                break
              }

              case "reasoning": {
                const reasoningPart = activeReasoning[event.item.id]
                const encryptedContent = event.item.encrypted_content ?? undefined
                for (const summaryIndex of reasoningPart.summaryParts) {
                  parts.push({
                    type: "reasoning-end",
                    id: `${event.item.id}:${summaryIndex}`,
                    metadata: {
                      openai: {
                        itemId: event.item.id,
                        ...(encryptedContent && { encryptedContent })
                      }
                    }
                  })
                }
                delete activeReasoning[event.item.id]
                break
              }

              case "web_search_call": {
                delete activeToolCalls[event.output_index]
                parts.push({
                  type: "tool-params-end",
                  id: event.item.id
                })
                parts.push({
                  type: "tool-call",
                  id: event.item.id,
                  name: "OpenAiWebSearch",
                  params: { action: event.item.action },
                  providerName: "web_search",
                  providerExecuted: true
                })
                parts.push({
                  type: "tool-result",
                  id: event.item.id,
                  name: "OpenAiWebSearch",
                  isFailure: false,
                  result: { status: event.item.status },
                  providerName: "web_search",
                  providerExecuted: true
                })
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
            if (event.annotation.type === "file_citation") {
              const filename = event.annotation.filename as string | undefined
              const fileId = event.annotation.file_id as string
              parts.push({
                type: "source",
                sourceType: "document",
                id: yield* idGenerator.generateId(),
                mediaType: "text/plain",
                title: filename ?? "Untitled Document",
                fileName: filename ?? fileId
              })
            }
            if (event.annotation.type === "url_citation") {
              parts.push({
                type: "source",
                sourceType: "url",
                id: yield* idGenerator.generateId(),
                url: event.annotation.url as string,
                title: event.annotation.title as string
              })
            }
            break
          }

          case "response.function_call_arguments.delta": {
            const toolCallPart = activeToolCalls[event.output_index]
            if (toolCallPart != null) {
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
              if (reasoningPart != null) {
                reasoningPart.summaryParts.push(event.summary_index)
              }
              parts.push({
                type: "reasoning-start",
                id: `${event.item_id}:${event.summary_index}`,
                metadata: {
                  openai: {
                    itemId: event.item_id,
                    ...(reasoningPart?.encryptedContent && { encryptedContent: reasoningPart.encryptedContent })
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
              metadata: makeItemIdMetadata(event.item_id)
            })
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
  request: typeof Generated.CreateResponse.Encoded
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

const annotateResponse = (span: Span, response: Generated.Response): void => {
  const finishReason = response.incomplete_details?.reason as string | undefined
  addGenAIAnnotations(span, {
    response: {
      id: response.id,
      model: response.model as string,
      finishReasons: finishReason != null ? [finishReason] : undefined
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
        inputTokens: part.usage.inputTokens,
        outputTokens: part.usage.outputTokens
      },
      openai: {
        response: { serviceTier }
      }
    })
  }
}

// =============================================================================
// Tool Calling
// =============================================================================

type OpenAiToolChoice = typeof Generated.CreateResponse.Encoded["tool_choice"]

const prepareTools = Effect.fnUntraced(function*<Tools extends ReadonlyArray<Tool.Any>>({
  options,
  toolNameMapper
}: {
  readonly options: LanguageModel.ProviderOptions
  readonly toolNameMapper: Tool.NameMapper<Tools>
}): Effect.fn.Return<{
  readonly tools: ReadonlyArray<typeof Generated.Tool.Encoded> | undefined
  readonly toolChoice: OpenAiToolChoice | undefined
}, AiError.AiError> {
  // Return immediately if no tools are in the toolkit
  if (options.tools.length === 0) {
    return { tools: undefined, toolChoice: undefined }
  }

  const tools: Array<typeof Generated.Tool.Encoded> = []
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
      tools.push({
        type: "function",
        name: tool.name,
        description: Tool.getDescription(tool) ?? null,
        parameters: Tool.getJsonSchema(tool),
        strict: true
      })
    }

    if (Tool.isProviderDefined(tool)) {
      const openAiTool = tool as OpenAiTool.OpenAiTool
      switch (openAiTool.name) {
        case "OpenAiApplyPatch": {
          tools.push({ type: "apply_patch" })
          break
        }
        case "OpenAiCodeInterpreter": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "code_interpreter"
          })
          break
        }
        case "OpenAiFileSearch": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "file_search"
          })
          break
        }
        case "OpenAiFunctionShell": {
          tools.push({ type: "shell" })
          break
        }
        case "OpenAiImageGeneration": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "image_generation"
          })
          break
        }
        case "OpenAiLocalShell": {
          tools.push({ type: "local_shell" })
          break
        }
        case "OpenAiMcp": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "mcp"
          })
          break
        }
        case "OpenAiWebSearch": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "web_search"
          })
          break
        }
        case "OpenAiWebSearchPreview": {
          const args = yield* Schema.decodeUnknownEffect(openAiTool.argsSchema)(tool.args).pipe(
            Effect.mapError((error) =>
              AiError.make({
                module: "OpenAiLanguageModel",
                method: "prepareTools",
                reason: new AiError.InvalidRequestError({ cause: error })
              })
            )
          )
          tools.push({
            ...args,
            type: "web_search_preview"
          })
          break
        }
        default: {
          return yield* AiError.make({
            module: "OpenAiLanguageModel",
            method: "prepareTools",
            reason: new AiError.InvalidRequestError({
              description: `Received request to call unknown provider-defined tool '${tool.name}'`
            })
          })
        }
      }
    }
  }

  if (options.toolChoice === "auto" || options.toolChoice === "none" || options.toolChoice === "required") {
    toolChoice = options.toolChoice
  }

  if (typeof options.toolChoice === "object" && "tool" in options.toolChoice) {
    const toolName = toolNameMapper.getProviderName(options.toolChoice.tool)
    const providerNames = toolNameMapper.providerNames
    if (providerNames.includes(toolName)) {
      toolChoice = { type: toolName as any }
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
): string | undefined => part.options.openai?.itemId
const getStatus = (
  part:
    | Prompt.TextPart
    | Prompt.ToolCallPart
    | Prompt.ToolResultPart
): typeof Generated.Message.Encoded["status"] | undefined => part.options.openai?.status
const getEncryptedContent = (
  part: Prompt.ReasoningPart
): string | undefined => part.options.openai?.encryptedContent

const getImageDetail = (part: Prompt.FilePart): typeof Generated.ImageDetail.Encoded =>
  part.options.openai?.imageDetail ?? "auto"

const makeItemIdMetadata = (itemId: string | undefined) => Predicate.isNotUndefined(itemId) ? { itemId } : undefined

const prepareResponseFormat = ({ config, options }: {
  readonly config: typeof Config.Service
  readonly options: LanguageModel.ProviderOptions
}): typeof Generated.TextResponseFormatConfiguration.Encoded => {
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
