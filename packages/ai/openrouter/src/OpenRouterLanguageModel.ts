/**
 * @since 1.0.0
 */
import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Base64 from "effect/encoding/Base64"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import type * as Schema from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/Stream"
import type { Span } from "effect/Tracer"
import type { Mutable, Simplify } from "effect/Types"
import * as AiError from "effect/unstable/ai/AiError"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import * as AiModel from "effect/unstable/ai/Model"
import type * as Prompt from "effect/unstable/ai/Prompt"
import type * as Response from "effect/unstable/ai/Response"
import { addGenAIAnnotations } from "effect/unstable/ai/Telemetry"
import * as Tool from "effect/unstable/ai/Tool"
import type * as Generated from "./Generated.ts"
import { ReasoningDetailsDuplicateTracker } from "./internal/utilities.ts"
import { OpenRouterClient } from "./OpenRouterClient.ts"

// =============================================================================
// Configuration
// =============================================================================

/**
 * Service definition for OpenRouter language model configuration.
 *
 * @since 1.0.0
 * @category services
 */
export class Config extends ServiceMap.Service<
  Config,
  Simplify<
    & Partial<
      Omit<
        typeof Generated.ChatGenerationParams.Encoded,
        "messages" | "response_format" | "tools" | "tool_choice" | "stream"
      >
    >
    & {
      /**
       * Whether to use strict JSON schema validation for structured outputs.
       *
       * Only applies to models that support structured outputs. Defaults to
       * `true` when structured outputs are supported.
       */
      readonly strictJsonSchema?: boolean | undefined
    }
  >
>()("@effect/ai-openrouter/OpenRouterLanguageModel/Config") {}

// =============================================================================
// Provider Options / Metadata
// =============================================================================

/**
 * @since 1.0.0
 * @category models
 */
export type ReasoningDetails = Exclude<typeof Generated.AssistantMessage.Encoded["reasoning_details"], undefined>

declare module "effect/unstable/ai/Prompt" {
  export interface SystemMessageOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }

  export interface UserMessageOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }

  export interface AssistantMessageOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
      /**
       * Reasoning details associated with the assistant message.
       */
      readonly reasoningDetails?: ReasoningDetails | null
    } | null
  }

  export interface ToolMessageOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }

  export interface TextPartOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }

  export interface ReasoningPartOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
      /**
       * Reasoning details associated with the reasoning part.
       */
      readonly reasoningDetails?: ReasoningDetails | null
    } | null
  }

  export interface FilePartOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * The name to give to the file. Will be prioritized over the file name
       * associated with the file part, if present.
       */
      readonly fileName?: string | null
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }

  export interface ToolCallPartOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * Reasoning details associated with the tool call part.
       */
      readonly reasoningDetails?: ReasoningDetails | null
    } | null
  }

  export interface ToolResultPartOptions extends ProviderOptions {
    readonly openrouter?: {
      /**
       * A breakpoint which marks the end of reusable content eligible for caching.
       */
      readonly cacheControl?: typeof Generated.ChatMessageContentItemCacheControl.Encoded | null
    } | null
  }
}

declare module "effect/unstable/ai/Response" {}

// =============================================================================
// Language Model
// =============================================================================

/**
 * @since 1.0.0
 * @category constructors
 */
export const model = (
  model: string,
  config?: Omit<typeof Config.Service, "model">
): AiModel.Model<"openai", LanguageModel.LanguageModel, OpenRouterClient> =>
  AiModel.make("openai", layer({ model, config }))

/**
 * Creates an OpenRouter language model service.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*({ model, config: providerConfig }: {
  readonly model: string
  readonly config?: Omit<typeof Config.Service, "model"> | undefined
}): Effect.fn.Return<LanguageModel.Service, never, OpenRouterClient> {
  const client = yield* OpenRouterClient

  const makeConfig = Effect.gen(function*() {
    const services = yield* Effect.services<never>()
    return { model, ...providerConfig, ...services.mapUnsafe.get(Config.key) }
  })

  const makeRequest = Effect.fnUntraced(
    function*({ config, options }: {
      readonly config: typeof Config.Service
      readonly options: LanguageModel.ProviderOptions
    }): Effect.fn.Return<typeof Generated.ChatGenerationParams.Encoded, AiError.AiError> {
      const messages = yield* prepareMessages({ options })
      const { tools, toolChoice } = yield* prepareTools({ options })
      const responseFormat = yield* getResponseFormat({ config, options })
      const request: typeof Generated.ChatGenerationParams.Encoded = {
        ...config,
        messages,
        ...(Predicate.isNotUndefined(responseFormat) ? { response_format: responseFormat } : undefined),
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
        const request = yield* makeRequest({ config, options })
        annotateRequest(options.span, request)
        const [rawResponse, response] = yield* client.createChatCompletion(request)
        annotateResponse(options.span, rawResponse)
        return [] // TODO
        // return yield* makeResponse({ options, rawResponse, response })
      }
    ),
    streamText: () => Stream.empty // TODO
  })
})

/**
 * Creates a layer for the OpenRouter language model.
 *
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: {
  readonly model: string
  readonly config?: Omit<typeof Config.Service, "model"> | undefined
}): Layer.Layer<LanguageModel.LanguageModel, never, OpenRouterClient> =>
  Layer.effect(LanguageModel.LanguageModel, make(options))

/**
 * Provides config overrides for OpenRouter language model operations.
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

const prepareMessages = Effect.fnUntraced(
  function*({ options }: {
    readonly options: LanguageModel.ProviderOptions
  }): Effect.fn.Return<ReadonlyArray<typeof Generated.Message.Encoded>, AiError.AiError> {
    const messages: Array<typeof Generated.Message.Encoded> = []

    const reasoningDetailsTracker = new ReasoningDetailsDuplicateTracker()

    for (const message of options.prompt.content) {
      switch (message.role) {
        case "system": {
          const cache_control = getCacheControl(message)

          messages.push({
            role: "system",
            content: [{
              type: "text",
              text: message.content,
              ...(Predicate.isNotNull(cache_control) ? { cache_control } : undefined)
            }]
          })

          break
        }

        case "user": {
          const content: Array<typeof Generated.ChatMessageContentItem.Encoded> = []

          // Get the message-level cache control
          const messageCacheControl = getCacheControl(message)

          if (message.content.length === 1 && message.content[0].type === "text") {
            messages.push({
              role: "user",
              content: Predicate.isNotNull(messageCacheControl)
                ? [{ type: "text", text: message.content[0].text, cache_control: messageCacheControl }]
                : message.content[0].text
            })

            break
          }

          // Find the index of the last text part in the message content
          let lastTextPartIndex = -1
          for (let i = message.content.length - 1; i >= 0; i--) {
            if (message.content[i].type === "text") {
              lastTextPartIndex = i
              break
            }
          }

          for (let index = 0; index < message.content.length; index++) {
            const part = message.content[index]
            const isLastTextPart = part.type === "text" && index === lastTextPartIndex
            const partCacheControl = getCacheControl(part)

            switch (part.type) {
              case "text": {
                const cache_control = Predicate.isNotNull(partCacheControl)
                  ? partCacheControl
                  : isLastTextPart
                  ? messageCacheControl
                  : null

                content.push({
                  type: "text",
                  text: part.text,
                  ...(Predicate.isNotNull(cache_control) ? { cache_control } : undefined)
                })

                break
              }

              case "file": {
                if (part.mediaType.startsWith("image/")) {
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType

                  content.push({
                    type: "image_url",
                    image_url: {
                      url: part.data instanceof URL
                        ? part.data.toString()
                        : part.data instanceof Uint8Array
                        ? `data:${mediaType};base64,${Base64.encode(part.data)}`
                        : part.data
                    },
                    ...(Predicate.isNotNull(partCacheControl) ? { cache_control: partCacheControl } : undefined)
                  })

                  break
                }

                const options = part.options.openrouter
                const fileName = options?.fileName ?? part.fileName ?? ""

                content.push({
                  type: "file",
                  file: {
                    filename: fileName,
                    file_data: part.data instanceof URL
                      ? part.data.toString()
                      : part.data instanceof Uint8Array
                      ? `data:${part.mediaType};base64,${Base64.encode(part.data)}`
                      : part.data
                  },
                  ...(Predicate.isNotNull(partCacheControl) ? { cache_control: partCacheControl } : undefined)
                } as any)

                break
              }
            }
          }

          messages.push({ role: "user", content })

          break
        }

        case "assistant": {
          let text = ""
          let reasoning = ""
          const toolCalls: Array<typeof Generated.ChatMessageToolCall.Encoded> = []

          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                text += part.text
                break
              }

              case "reasoning": {
                reasoning += part.text
                break
              }

              case "tool-call": {
                toolCalls.push({
                  type: "function",
                  id: part.id,
                  function: { name: part.name, arguments: JSON.stringify(part.params) }
                })
                break
              }

              default: {
                break
              }
            }
          }

          const messageReasoningDetails = message.options.openrouter?.reasoningDetails

          // Use message-level reasoning details if available, otherwise find from parts
          // Priority: message-level > first tool call > first reasoning part
          // This prevents duplicate thinking blocks when Claude makes parallel tool calls
          const candidateReasoningDetails: ReasoningDetails | null = Predicate.isNotNullish(messageReasoningDetails)
              && Array.isArray(messageReasoningDetails)
              && messageReasoningDetails.length > 0
            ? messageReasoningDetails
            : findFirstReasoningDetails(message.content)

          // Deduplicate reasoning details across all messages to prevent "Duplicate
          // item found with id" errors in multi-turn conversations.
          let reasoningDetails: ReasoningDetails | null = null
          if (Predicate.isNotNull(candidateReasoningDetails) && candidateReasoningDetails.length > 0) {
            const uniqueReasoningDetails: Mutable<ReasoningDetails> = []
            for (const detail of candidateReasoningDetails) {
              if (reasoningDetailsTracker.upsert(detail)) {
                uniqueReasoningDetails.push(detail)
              }
            }
            if (uniqueReasoningDetails.length > 0) {
              reasoningDetails = uniqueReasoningDetails
            }
          }

          messages.push({
            role: "assistant",
            content: text,
            reasoning: reasoning.length > 0 ? reasoning : null,
            ...(Predicate.isNotNull(reasoningDetails) ? { reasoning_details: reasoningDetails } : undefined),
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : undefined)
          })

          break
        }

        case "tool": {
          for (const part of message.content) {
            // Skip tool approval parts
            if (part.type === "tool-approval-response") {
              continue
            }

            messages.push({
              role: "tool",
              tool_call_id: part.id,
              content: JSON.stringify(part.result)
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
// Tool Conversion
// =============================================================================

const prepareTools = Effect.fnUntraced(
  function*({ options }: {
    readonly options: LanguageModel.ProviderOptions
  }): Effect.fn.Return<{
    readonly tools: ReadonlyArray<typeof Generated.ToolDefinitionJson.Encoded> | undefined
    readonly toolChoice: typeof Generated.ToolChoiceOption.Encoded | undefined
  }, AiError.AiError> {
    if (options.tools.length === 0) {
      return { tools: undefined, toolChoice: undefined }
    }

    const hasProviderDefinedTools = options.tools.some((tool) => Tool.isProviderDefined(tool))
    if (hasProviderDefinedTools) {
      return yield* AiError.make({
        module: "OpenRouterLanguageModel",
        method: "prepareTools",
        reason: new AiError.InvalidUserInputError({
          description: "Provider-defined tools are unsupported by the OpenRouter " +
            "provider integration at this time"
        })
      })
    }

    let tools: Array<typeof Generated.ToolDefinitionJson.Encoded> = []
    let toolChoice: typeof Generated.ToolChoiceOption.Encoded | undefined = undefined

    for (const tool of options.tools) {
      const description = Tool.getDescription(tool)
      const parameters = yield* tryJsonSchema(tool.parametersSchema, "prepareTools")
      const strict = Tool.getStrictMode(tool) ?? null

      tools.push({
        type: "function",
        function: {
          name: tool.name,
          parameters,
          strict,
          ...(Predicate.isNotUndefined(description) ? { description } : undefined)
        }
      })
    }

    if (options.toolChoice === "none") {
      toolChoice = "none"
    } else if (options.toolChoice === "auto") {
      toolChoice = "auto"
    } else if (options.toolChoice === "required") {
      toolChoice = "required"
    } else if ("tool" in options.toolChoice) {
      toolChoice = { type: "function", function: { name: options.toolChoice.tool } }
    } else {
      const allowedTools = new Set(options.toolChoice.oneOf)
      tools = tools.filter((tool) => allowedTools.has(tool.function.name))
      toolChoice = options.toolChoice.mode === "required" ? "required" : "auto"
    }

    return { tools, toolChoice }
  }
)

// =============================================================================
// Telemetry
// =============================================================================

const annotateRequest = (
  span: Span,
  request: typeof Generated.ChatGenerationParams.Encoded
): void => {
  addGenAIAnnotations(span, {
    system: "openrouter",
    operation: { name: "chat" },
    request: {
      model: request.model,
      temperature: request.temperature,
      topP: request.top_p,
      maxTokens: request.max_tokens,
      stopSequences: Arr.ensure(request.stop).filter(
        Predicate.isNotNullish
      )
    }
  })
}

const annotateResponse = (span: Span, response: Generated.SendChatCompletionRequest200): void => {
  addGenAIAnnotations(span, {
    response: {
      id: response.id,
      model: response.model,
      finishReasons: response.choices.map((choice) => choice.finish_reason).filter(Predicate.isNotNullish)
    },
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens
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
    addGenAIAnnotations(span, {
      response: {
        finishReasons: [part.reason]
      },
      usage: {
        inputTokens: part.usage.inputTokens.total,
        outputTokens: part.usage.outputTokens.total
      }
    })
  }
}

// =============================================================================
// Internal Utilities
// =============================================================================

const getCacheControl = (
  part:
    | Prompt.SystemMessage
    | Prompt.UserMessage
    | Prompt.AssistantMessage
    | Prompt.ToolMessage
    | Prompt.TextPart
    | Prompt.ReasoningPart
    | Prompt.FilePart
    | Prompt.ToolResultPart
): typeof Generated.ChatMessageContentItemCacheControl.Encoded | null => part.options.openrouter?.cacheControl ?? null

const findFirstReasoningDetails = (content: ReadonlyArray<Prompt.AssistantMessagePart>): ReasoningDetails | null => {
  for (const part of content) {
    // First try tool calls since they have complete accumulated reasoning details
    if (part.type === "tool-call") {
      const details = part.options.openrouter?.reasoningDetails
      if (Predicate.isNotNullish(details) && Array.isArray(details) && details.length > 0) {
        return details as ReasoningDetails
      }
    }

    // Fallback to reasoning parts which have delta reasoning details
    if (part.type === "reasoning") {
      const details = part.options.openrouter?.reasoningDetails
      if (Predicate.isNotNullish(details) && Array.isArray(details) && details.length > 0) {
        return details as ReasoningDetails
      }
    }
  }

  return null
}

const tryJsonSchema = <S extends Schema.Top>(schema: S, method: string) =>
  Effect.try({
    try: () => Tool.getJsonSchemaFromSchema(schema, { transformer: toCodecAnthropic }),
    catch: (error) => unsupportedSchemaError(error, method)
  })

const getResponseFormat = Effect.fnUntraced(function*({ config, options }: {
  readonly config: typeof Config.Service
  readonly options: LanguageModel.ProviderOptions
}): Effect.fn.Return<typeof Generated.ResponseFormatJSONSchema.Encoded | undefined, AiError.AiError> {
  if (options.responseFormat.type === "json") {
    const description = SchemaAST.resolveDescription(options.responseFormat.schema.ast)
    const jsonSchema = yield* tryJsonSchema(options.responseFormat.schema, "getResponseFormat")
    return {
      type: "json_schema",
      json_schema: {
        name: options.responseFormat.objectName,
        schema: jsonSchema,
        strict: config.strictJsonSchema ?? null,
        ...(Predicate.isNotUndefined(description) ? { description } : undefined)
      }
    }
  }
  return undefined
})
