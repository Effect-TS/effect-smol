/**
 * @since 1.0.0
 */
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Encoding from "effect/Encoding"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import type { JsonObject } from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"
import * as Stream from "effect/Stream"
import type { Span } from "effect/Tracer"
import type { Mutable, Simplify } from "effect/Types"
import * as AiError from "effect/unstable/ai/AiError"
import type * as IdGenerator from "effect/unstable/ai/IdGenerator"
import * as LanguageModel from "effect/unstable/ai/LanguageModel"
import * as AiModel from "effect/unstable/ai/Model"
import type * as Prompt from "effect/unstable/ai/Prompt"
import type * as Response from "effect/unstable/ai/Response"
import { addGenAIAnnotations } from "effect/unstable/ai/Telemetry"
import * as Tool from "effect/unstable/ai/Tool"
import { AmazonBedrockClient } from "./AmazonBedrockClient.ts"
import type {
  BedrockFoundationModelId,
  CachePointBlock,
  ContentBlock,
  ConverseRequest,
  ConverseResponse,
  ConverseResponseStreamEvent,
  DocumentFormat,
  Message,
  SystemContentBlock,
  Tool as AmazonBedrockTool,
  ToolChoice,
  ToolConfiguration
} from "./AmazonBedrockSchema.ts"
import { ImageFormat } from "./AmazonBedrockSchema.ts"
import * as InternalUtilities from "./internal/utilities.ts"

const BEDROCK_CACHE_POINT: {
  readonly cachePoint: typeof CachePointBlock.Encoded
} = { cachePoint: { type: "default" } }

/**
 * @since 1.0.0
 * @category models
 */
export type Model = typeof BedrockFoundationModelId.Type

// =============================================================================
// Configuration
// =============================================================================

/**
 * @since 1.0.0
 * @category services
 */
export class Config extends Context.Service<Config, Config.Service>()(
  "@effect/ai-amazon-bedrock/AmazonBedrockLanguageModel/Config"
) {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<typeof Config.Service | undefined> = Effect.map(
    Effect.context<never>(),
    (context) => context.mapUnsafe.get(Config.key)
  )
}

/**
 * @since 1.0.0
 */
export declare namespace Config {
  /**
   * @since 1.0.0
   * @category configuration
   */
  export interface Service extends
    Simplify<
      Partial<
        Omit<
          typeof ConverseRequest.Encoded,
          "messages" | "system" | "toolConfig"
        >
      >
    >
  {}
}

// =============================================================================
// Amazon Bedrock Provider Options / Metadata
// =============================================================================

/**
 * @since 1.0.0
 * @category provider options
 */
export type AmazonBedrockReasoningInfo = {
  readonly type: "thinking"
  readonly signature: string
} | {
  readonly type: "redacted_thinking"
  readonly redactedData: string
}

declare module "effect/unstable/ai/Prompt" {
  export interface SystemMessageOptions extends ProviderOptions {
    readonly bedrock?: {
      readonly cachePoint?: typeof CachePointBlock.Encoded | null
    } | null
  }

  export interface UserMessageOptions extends ProviderOptions {
    readonly bedrock?: {
      readonly cachePoint?: typeof CachePointBlock.Encoded | null
    } | null
  }

  export interface AssistantMessageOptions extends ProviderOptions {
    readonly bedrock?: {
      readonly cachePoint?: typeof CachePointBlock.Encoded | null
    } | null
  }

  export interface ToolMessageOptions extends ProviderOptions {
    readonly bedrock?: {
      readonly cachePoint?: typeof CachePointBlock.Encoded | null
    } | null
  }

  export interface ReasoningPartOptions extends ProviderOptions {
    readonly bedrock?: AmazonBedrockReasoningInfo | null
  }
}

declare module "effect/unstable/ai/Response" {
  export interface ReasoningPartMetadata extends ProviderMetadata {
    readonly bedrock?: AmazonBedrockReasoningInfo | null
  }

  export interface FinishPartMetadata extends ProviderMetadata {
    readonly bedrock?: {
      readonly trace?: JsonObject | null
      readonly usage: {
        readonly cacheWriteInputTokens?: number | null
      }
    } | null
  }
}

// =============================================================================
// Amazon Bedrock Language Model
// =============================================================================

/**
 * @since 1.0.0
 * @category models
 */
export const model = (
  modelName: (string & {}) | Model,
  config?: Omit<Config.Service, "model"> | undefined
): AiModel.Model<"amazon-bedrock", LanguageModel.LanguageModel, AmazonBedrockClient> =>
  AiModel.make("amazon-bedrock", modelName, layer({ model: modelName, config }))

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*(options: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<Config.Service, "model"> | undefined
}) {
  const client = yield* AmazonBedrockClient

  const makeRequest = Effect.fnUntraced(
    function*(providerOptions: LanguageModel.ProviderOptions) {
      const context = yield* Effect.context<never>()
      const config = { modelId: options.model, ...options.config, ...context.mapUnsafe.get(Config.key) }
      const { messages, system } = yield* prepareMessages(providerOptions)
      const { additionalTools, betas, toolConfig, nameMapper } = yield* prepareTools(providerOptions, config)
      const responseFormat = providerOptions.responseFormat
      const request: typeof ConverseRequest.Encoded = {
        ...config,
        system,
        messages,
        // Handle tool configuration
        ...(responseFormat.type === "json"
          ? {
            toolConfig: {
              tools: [{
                toolSpec: {
                  name: responseFormat.objectName,
                  description: SchemaAST.resolveDescription(responseFormat.schema.ast) ??
                    "Respond with a JSON object",
                  inputSchema: {
                    json: Tool.getJsonSchemaFromSchema(responseFormat.schema) as any
                  }
                }
              }],
              toolChoice: { tool: { name: responseFormat.objectName } }
            }
          }
          : Predicate.isNotUndefined(toolConfig.tools) && (toolConfig.tools as Array<any>).length > 0
          ? { toolConfig }
          : {}),
        // Handle additional model request fields
        ...(Predicate.isNotUndefined(additionalTools)
          ? {
            additionalModelRequestFields: {
              ...config.additionalModelRequestFields,
              ...additionalTools
            }
          }
          : {})
      }
      return { betas, request, nameMapper }
    }
  )

  return yield* LanguageModel.make({
    generateText: Effect.fnUntraced(
      function*(options) {
        const { betas, request, nameMapper } = yield* makeRequest(options)
        annotateRequest(options.span, request)
        const anthropicBeta = betas.size > 0 ? Array.from(betas).join(",") : undefined
        const rawResponse = yield* client.converse({
          params: anthropicBeta !== undefined ? { "anthropic-beta": anthropicBeta } : undefined,
          payload: request
        })
        annotateResponse(options.span, request, rawResponse)
        return yield* makeResponse(request, rawResponse, options, nameMapper)
      }
    ),
    streamText: Effect.fnUntraced(
      function*(options) {
        const { betas, request, nameMapper } = yield* makeRequest(options)
        annotateRequest(options.span, request)
        const anthropicBeta = betas.size > 0 ? Array.from(betas).join(",") : undefined
        const stream = client.converseStream({
          params: anthropicBeta !== undefined ? { "anthropic-beta": anthropicBeta } : undefined,
          payload: request
        })
        return { request, stream, nameMapper }
      },
      (effect, options) =>
        effect.pipe(
          Effect.flatMap(({ request, stream, nameMapper }) => makeStreamResponse(request, stream, options, nameMapper)),
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
 * @since 1.0.0
 * @category layers
 */
export const layer = (options: {
  readonly model: (string & {}) | Model
  readonly config?: Omit<Config.Service, "model"> | undefined
}): Layer.Layer<LanguageModel.LanguageModel, never, AmazonBedrockClient> =>
  Layer.effect(LanguageModel.LanguageModel, make({ model: options.model, config: options.config }))

/**
 * @since 1.0.0
 * @category configuration
 */
export const withConfigOverride: {
  (config: Config.Service): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, config: Config.Service): Effect.Effect<A, E, R>
} = dual<
  (config: Config.Service) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(self: Effect.Effect<A, E, R>, config: Config.Service) => Effect.Effect<A, E, R>
>(2, (self, overrides) =>
  Effect.flatMap(
    Config.getOrUndefined,
    (config) => Effect.provideService(self, Config, { ...config, ...overrides })
  ))

// =============================================================================
// Prompt Conversion
// =============================================================================

const prepareMessages: (options: LanguageModel.ProviderOptions) => Effect.Effect<{
  readonly system: ReadonlyArray<typeof SystemContentBlock.Encoded>
  readonly messages: ReadonlyArray<typeof Message.Encoded>
}, AiError.AiError> = Effect.fnUntraced(
  function*(options) {
    const groups = groupMessages(options.prompt)

    const system: Array<typeof SystemContentBlock.Encoded> = []
    const messages: Array<typeof Message.Encoded> = []

    let documentCounter = 0
    const nextDocumentName = () => `document-${++documentCounter}`

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const isLastGroup = i === groups.length - 1

      switch (group.type) {
        case "system": {
          if (messages.length > 0) {
            return yield* AiError.make({
              module: "AmazonBedrockLanguageModel",
              method: "prepareMessages",
              reason: new AiError.InvalidUserInputError({
                description: "Multiple system messages separated by user / assistant messages"
              })
            })
          }
          for (const message of group.messages) {
            system.push({ text: message.content })
            if (Predicate.isNotUndefined(getCachePoint(message))) {
              system.push(BEDROCK_CACHE_POINT)
            }
          }
          break
        }

        case "user": {
          const content: Array<typeof ContentBlock.Encoded> = []

          for (const message of group.messages) {
            switch (message.role) {
              case "user": {
                for (let j = 0; j < message.content.length; j++) {
                  const part = message.content[j]

                  switch (part.type) {
                    case "text": {
                      content.push({ text: part.text })
                      break
                    }

                    case "file": {
                      if (part.data instanceof URL) {
                        return yield* AiError.make({
                          module: "AmazonBedrockLanguageModel",
                          method: "prepareMessages",
                          reason: new AiError.InvalidUserInputError({
                            description: "File URL inputs are not supported at this time"
                          })
                        })
                      }
                      if (part.mediaType.startsWith("image/")) {
                        content.push({
                          image: {
                            format: yield* getImageFormat(part.mediaType),
                            source: { bytes: convertToBase64(part.data) }
                          }
                        })
                      } else {
                        content.push({
                          document: {
                            format: yield* getDocumentFormat(part.mediaType),
                            name: nextDocumentName(),
                            source: { bytes: convertToBase64(part.data) }
                          }
                        })
                      }
                      break
                    }
                  }
                }
                break
              }

              case "tool": {
                for (const part of message.content) {
                  if (part.type !== "tool-result") continue
                  content.push({
                    toolResult: {
                      toolUseId: part.id,
                      content: [{ text: JSON.stringify(part.result) }]
                    }
                  })
                }
                break
              }
            }

            if (getCachePoint(message)) {
              content.push(BEDROCK_CACHE_POINT)
            }
          }

          messages.push({ role: "user", content })

          break
        }

        case "assistant": {
          const content: Array<typeof ContentBlock.Encoded> = []

          for (let j = 0; j < group.messages.length; j++) {
            const message = group.messages[j]
            const isLastMessage = j === group.messages.length - 1

            for (let k = 0; k < message.content.length; k++) {
              const part = message.content[k]
              const isLastPart = k === message.content.length - 1

              switch (part.type) {
                case "text": {
                  // Skip empty text blocks
                  if (part.text.trim().length === 0) {
                    break
                  }
                  content.push({
                    // Amazon Bedrock does not allow trailing whitespace in
                    // assistant content blocks
                    text: trimIfLast(isLastGroup, isLastMessage, isLastPart, part.text)
                  })
                  break
                }

                case "reasoning": {
                  const options = part.options.bedrock
                  if (options != null) {
                    if (options.type === "thinking") {
                      content.push({
                        reasoningContent: {
                          reasoningText: {
                            // Amazon Bedrock does not allow trailing whitespace in
                            // assistant content blocks
                            text: trimIfLast(isLastGroup, isLastMessage, isLastPart, part.text),
                            signature: options.signature
                          }
                        }
                      })
                    }
                    if (options.type === "redacted_thinking") {
                      content.push({
                        reasoningContent: {
                          redactedContent: options.redactedData
                        }
                      })
                    }
                  }
                  break
                }

                case "tool-call": {
                  content.push({
                    toolUse: {
                      toolUseId: part.id,
                      name: part.name,
                      input: part.params
                    }
                  })
                  break
                }
              }
            }

            if (getCachePoint(message)) {
              content.push(BEDROCK_CACHE_POINT)
            }
          }

          messages.push({ role: "assistant", content })

          break
        }
      }
    }

    return { system, messages }
  }
)

// =============================================================================
// Response Conversion
// =============================================================================

const makeResponse: (
  request: typeof ConverseRequest.Encoded,
  response: ConverseResponse,
  options: LanguageModel.ProviderOptions,
  nameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>
) => Effect.Effect<
  Array<Response.PartEncoded>,
  never,
  IdGenerator.IdGenerator
> = Effect.fnUntraced(function*(request, response, options, nameMapper) {
  const parts: Array<Response.PartEncoded> = []

  parts.push({
    type: "response-metadata",
    id: undefined,
    modelId: request.modelId,
    timestamp: DateTime.formatIso(yield* DateTime.now),
    request: undefined
  })

  for (const part of response.output.message.content) {
    if ("text" in part) {
      if (options.responseFormat.type === "text") {
        parts.push({
          type: "text",
          text: part.text
        })
      }
    } else if ("reasoningContent" in part) {
      if ("reasoningText" in part.reasoningContent) {
        const signature = part.reasoningContent.reasoningText.signature
        parts.push({
          type: "reasoning",
          text: part.reasoningContent.reasoningText.text,
          metadata: Predicate.isNotUndefined(signature) ?
            { bedrock: { type: "thinking" as const, signature } }
            : undefined
        })
      }
      if ("redactedContent" in part.reasoningContent) {
        parts.push({
          type: "reasoning",
          text: "",
          metadata: {
            bedrock: {
              type: "redacted_thinking" as const,
              redactedData: part.reasoningContent.redactedContent
            }
          }
        })
      }
    } else if ("toolUse" in part) {
      if (options.responseFormat.type === "json") {
        parts.push({
          type: "text",
          text: JSON.stringify(part.toolUse.input)
        })
      } else {
        const customName = nameMapper.getCustomName(part.toolUse.name)
        parts.push({
          type: "tool-call",
          id: part.toolUse.toolUseId,
          name: customName,
          params: part.toolUse.input,
          providerExecuted: false
        })
      }
    }
  }

  const finishReason = InternalUtilities.resolveFinishReason(response.stopReason)
  const cacheReadTokens = response.usage.cacheReadInputTokens ?? 0
  const cacheWriteTokens = response.usage.cacheWriteInputTokens ?? 0

  parts.push({
    type: "finish",
    reason: finishReason,
    usage: {
      inputTokens: {
        uncached: response.usage.inputTokens,
        total: response.usage.inputTokens + cacheReadTokens + cacheWriteTokens,
        cacheRead: cacheReadTokens,
        cacheWrite: cacheWriteTokens
      },
      outputTokens: {
        total: response.usage.outputTokens,
        text: undefined,
        reasoning: undefined
      }
    },
    response: undefined,
    metadata: {
      bedrock: {
        ...(response.trace !== undefined
          ? { trace: response.trace as unknown as JsonObject }
          : undefined),
        usage: {
          ...(response.usage.cacheWriteInputTokens !== undefined
            ? { cacheWriteInputTokens: response.usage.cacheWriteInputTokens }
            : undefined)
        }
      } as any
    }
  })

  return parts
})

const makeStreamResponse: (
  request: typeof ConverseRequest.Encoded,
  stream: Stream.Stream<ConverseResponseStreamEvent, AiError.AiError>,
  options: LanguageModel.ProviderOptions,
  nameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>
) => Effect.Effect<
  Stream.Stream<Response.StreamPartEncoded, AiError.AiError>,
  never,
  IdGenerator.IdGenerator
> = Effect.fnUntraced(
  function*(request, stream, options, nameMapper) {
    const contentBlocks: Record<
      number,
      | {
        readonly type: "text"
      }
      | {
        readonly type: "reasoning"
      }
      | {
        readonly type: "tool-call"
        readonly id: string
        readonly name: string
        params: string
        readonly providerExecuted: boolean
      }
    > = {}

    let trace: JsonObject | undefined = undefined
    let cacheWriteInputTokens: number | undefined = undefined
    let finishReason: Response.FinishReason | undefined = undefined
    let hasMetadata = false
    const usage: Mutable<typeof Response.Usage.Encoded> = {
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

    const tryEmitFinish = (parts: Array<Response.StreamPartEncoded>) => {
      if (finishReason !== undefined && hasMetadata) {
        parts.push({
          type: "finish",
          reason: finishReason,
          usage,
          response: undefined,
          metadata: {
            bedrock: {
              ...(trace !== undefined ? { trace } : undefined),
              usage: {
                ...(cacheWriteInputTokens !== undefined
                  ? { cacheWriteInputTokens }
                  : undefined)
              }
            } as any
          }
        })
      }
    }

    return stream.pipe(
      Stream.mapEffect(Effect.fnUntraced(function*(event) {
        const parts: Array<Response.StreamPartEncoded> = []

        if ("messageStart" in event) {
          parts.push({
            type: "response-metadata",
            id: undefined,
            modelId: request.modelId,
            timestamp: DateTime.formatIso(yield* DateTime.now),
            request: undefined
          })
        } else if ("messageStop" in event) {
          finishReason = InternalUtilities.resolveFinishReason(event.messageStop.stopReason)
          tryEmitFinish(parts)
        } else if ("contentBlockStart" in event) {
          const index = event.contentBlockStart.contentBlockIndex
          const block = event.contentBlockStart
          if (Predicate.isNotUndefined(block.start.toolUse)) {
            const toolUse = block.start.toolUse
            const toolName = toolUse.name
            const customName = nameMapper.getCustomName(toolName)

            contentBlocks[index] = {
              type: "tool-call",
              id: toolUse.toolUseId,
              name: customName,
              params: "",
              providerExecuted: false
            }
            if (options.responseFormat.type === "text") {
              parts.push({
                type: "tool-params-start",
                id: toolUse.toolUseId,
                name: toolUse.name,
                providerExecuted: false
              })
            }
          } else {
            contentBlocks[index] = { type: "text" }
            parts.push({
              type: "text-start",
              id: index.toString()
            })
          }
        } else if ("contentBlockDelta" in event) {
          const index = event.contentBlockDelta.contentBlockIndex
          const delta = event.contentBlockDelta.delta

          if ("text" in delta) {
            const block = contentBlocks[index]
            if (Predicate.isUndefined(block)) {
              contentBlocks[index] = { type: "text" }
              if (options.responseFormat.type === "text") {
                parts.push({
                  type: "text-start",
                  id: index.toString()
                })
              }
            }
            if (options.responseFormat.type === "text") {
              parts.push({
                type: "text-delta",
                id: index.toString(),
                delta: delta.text
              })
            }
          } else if ("reasoningContent" in delta) {
            if ("text" in delta.reasoningContent) {
              const block = contentBlocks[index]
              if (Predicate.isUndefined(block)) {
                contentBlocks[index] = { type: "reasoning" }
                parts.push({
                  type: "reasoning-start",
                  id: index.toString()
                })
              }
              parts.push({
                type: "reasoning-delta",
                id: index.toString(),
                delta: delta.reasoningContent.text
              })
            } else if ("signature" in delta.reasoningContent) {
              parts.push({
                type: "reasoning-delta",
                id: index.toString(),
                delta: "",
                metadata: {
                  bedrock: {
                    type: "thinking" as const,
                    signature: delta.reasoningContent.signature
                  }
                }
              })
            } else {
              parts.push({
                type: "reasoning-delta",
                id: index.toString(),
                delta: "",
                metadata: {
                  bedrock: {
                    type: "redacted_thinking" as const,
                    redactedData: delta.reasoningContent.redactedContent
                  }
                }
              })
            }
          } else if ("toolUse" in delta) {
            const block = contentBlocks[index]
            if (Predicate.isNotUndefined(block) && block.type === "tool-call") {
              const params = delta.toolUse.input
              if (options.responseFormat.type === "text") {
                parts.push({
                  type: "tool-params-delta",
                  id: block.id,
                  delta: params
                })
              }
              block.params += params
            }
          }
        } else if ("contentBlockStop" in event) {
          const index = event.contentBlockStop.contentBlockIndex
          const block = contentBlocks[index]
          if (Predicate.isNotUndefined(block)) {
            switch (block.type) {
              case "text": {
                if (options.responseFormat.type === "text") {
                  parts.push({
                    type: "text-end",
                    id: index.toString()
                  })
                }
                break
              }

              case "reasoning": {
                parts.push({
                  type: "reasoning-end",
                  id: index.toString()
                })
                break
              }

              case "tool-call": {
                if (options.responseFormat.type === "text") {
                  parts.push({
                    type: "tool-params-end",
                    id: block.id
                  })

                  const toolName = block.name
                  const toolParams = block.params

                  const params = yield* Effect.try({
                    try: () => Tool.unsafeSecureJsonParse(toolParams),
                    catch: () =>
                      AiError.make({
                        module: "AmazonBedrockLanguageModel",
                        method: "makeStreamResponse",
                        reason: new AiError.InvalidOutputError({
                          description: "Failed to securely parse tool call parameters " +
                            `for tool '${toolName}':\nParameters: ${toolParams}`
                        })
                      })
                  })

                  parts.push({
                    type: "tool-call",
                    id: block.id,
                    name: toolName,
                    params,
                    providerExecuted: block.providerExecuted
                  })
                } else {
                  parts.push({
                    type: "text-start",
                    id: index.toString()
                  })
                  parts.push({
                    type: "text-delta",
                    id: index.toString(),
                    delta: block.params
                  })
                  parts.push({
                    type: "text-end",
                    id: index.toString()
                  })
                }
                break
              }
            }
            delete contentBlocks[index]
          }
        } else if ("metadata" in event) {
          const cacheRead = event.metadata.usage.cacheReadInputTokens ?? 0
          const cacheWrite = event.metadata.usage.cacheWriteInputTokens ?? 0
          usage.inputTokens = {
            uncached: event.metadata.usage.inputTokens,
            total: event.metadata.usage.inputTokens + cacheRead + cacheWrite,
            cacheRead,
            cacheWrite
          }
          usage.outputTokens = {
            total: event.metadata.usage.outputTokens,
            text: undefined,
            reasoning: undefined
          }
          if (Predicate.isNotUndefined(event.metadata.usage.cacheWriteInputTokens)) {
            cacheWriteInputTokens = event.metadata.usage.cacheWriteInputTokens
          }
          if (Predicate.isNotUndefined(event.metadata.trace)) {
            trace = event.metadata.trace as unknown as JsonObject
          }
          hasMetadata = true
          tryEmitFinish(parts)
        } else if ("internalServerException" in event) {
          parts.push({ type: "error", error: event.internalServerException })
        } else if ("modelStreamErrorException" in event) {
          parts.push({ type: "error", error: event.modelStreamErrorException })
        } else if ("serviceUnavailableException" in event) {
          parts.push({ type: "error", error: event.serviceUnavailableException })
        } else if ("throttlingException" in event) {
          parts.push({ type: "error", error: event.throttlingException })
        } else if ("validationException" in event) {
          parts.push({ type: "error", error: event.validationException })
        }

        return parts
      })),
      Stream.flattenIterable
    )
  }
)

// =============================================================================
// Tool Calling
// =============================================================================

// Map of known Anthropic provider tool IDs to their required betas
const anthropicToolBetas: Record<string, string> = {
  "anthropic.bash_20241022": "computer-use-2024-10-22",
  "anthropic.bash_20250124": "computer-use-2025-01-24",
  "anthropic.computer_use_20241022": "computer-use-2024-10-22",
  "anthropic.computer_20250124": "computer-use-2025-01-24",
  "anthropic.computer_20251124": "computer-use-2025-11-24",
  "anthropic.text_editor_20241022": "computer-use-2024-10-22",
  "anthropic.text_editor_20250124": "computer-use-2025-01-24",
  "anthropic.text_editor_20250429": "computer-use-2025-01-24",
  "anthropic.code_execution_20250522": "code-execution-2025-05-22",
  "anthropic.code_execution_20250825": "code-execution-2025-08-25",
  "anthropic.memory_20250818": "context-management-2025-06-27",
  "anthropic.web_search_20250305": "",
  "anthropic.web_fetch_20250910": "web-fetch-2025-09-10",
  "anthropic.tool_search_tool_bm25_20251119": "advanced-tool-use-2025-11-20",
  "anthropic.tool_search_tool_regex_20251119": ""
}

const prepareTools: (
  options: LanguageModel.ProviderOptions,
  config: Config.Service
) => Effect.Effect<{
  readonly betas: ReadonlySet<string>
  readonly toolConfig: Partial<typeof ToolConfiguration.Encoded>
  readonly additionalTools?: Record<string, unknown> | undefined
  readonly nameMapper: Tool.NameMapper<ReadonlyArray<Tool.Any>>
}, AiError.AiError> = Effect.fnUntraced(function*(options, config) {
  const betas = new Set<string>()
  const nameMapper = new Tool.NameMapper(options.tools)

  if (options.tools.length === 0) {
    return { toolConfig: {}, betas, nameMapper }
  }

  const isAnthropicModel = config.modelId!.includes("anthropic.")
  const userDefinedTools: Array<Tool.Any> = []
  const providerDefinedTools: Array<Tool.AnyProviderDefined> = []
  for (const tool of options.tools) {
    if (Tool.isUserDefined(tool)) {
      userDefinedTools.push(tool)
    } else if (Tool.isProviderDefined(tool)) {
      providerDefinedTools.push(tool as Tool.AnyProviderDefined)
    }
  }

  const hasAnthropicTools = isAnthropicModel && providerDefinedTools.length > 0

  let tools: Array<typeof AmazonBedrockTool.Encoded> = []
  let additionalTools: Record<string, unknown> | undefined = undefined

  // Handle Anthropic provider-defined tools for Anthropic models on Bedrock
  if (hasAnthropicTools) {
    for (const providerTool of providerDefinedTools) {
      // Add required betas
      const beta = anthropicToolBetas[providerTool.id]
      if (Predicate.isNotUndefined(beta) && beta.length > 0) {
        betas.add(beta)
      }

      // Add tool definition in Bedrock format
      const description = Tool.getDescription(providerTool as any)
      tools.push({
        toolSpec: {
          name: providerTool.providerName,
          ...(description !== undefined ? { description } : undefined),
          inputSchema: {
            json: Tool.getJsonSchema(providerTool as any) as any
          }
        }
      })
    }
  }

  // Handle conversion of user-defined tools to Amazon Bedrock tool definitions
  for (const tool of userDefinedTools) {
    const description = Tool.getDescription(tool as any)
    tools.push({
      toolSpec: {
        name: tool.name,
        ...(description !== undefined ? { description } : undefined),
        inputSchema: {
          json: Tool.getJsonSchema(tool as any) as any
        }
      }
    })
  }

  // Handle resolution of tool choice for Amazon Bedrock user-defined tools
  let toolChoice: typeof ToolChoice.Encoded | undefined = undefined
  if (!hasAnthropicTools && tools.length > 0 && Predicate.isNotUndefined(options.toolChoice)) {
    if (options.toolChoice === "none") {
      tools.length = 0
      toolChoice = undefined
    } else if (options.toolChoice === "auto") {
      toolChoice = { auto: {} }
    } else if (options.toolChoice === "required") {
      toolChoice = { any: {} }
    } else if ("tool" in options.toolChoice) {
      toolChoice = { tool: { name: options.toolChoice.tool } }
    } else {
      const allowedTools = new Set(options.toolChoice.oneOf)
      tools = tools.filter((tool) => allowedTools.has(tool.toolSpec?.name))
      toolChoice = options.toolChoice.mode === "auto" ? { auto: {} } : { any: {} }
    }
  }

  const toolConfig: Partial<typeof ToolConfiguration.Encoded> = tools.length > 0
    ? { tools, ...(toolChoice !== undefined ? { toolChoice } : undefined) }
    : {}

  return { additionalTools, betas, toolConfig, nameMapper }
})

// =============================================================================
// Telemetry
// =============================================================================

const annotateRequest = (
  span: Span,
  request: typeof ConverseRequest.Encoded
): void => {
  addGenAIAnnotations(span, {
    system: "aws.bedrock",
    operation: { name: "chat" },
    request: {
      model: request.modelId,
      temperature: request.inferenceConfig?.temperature,
      topP: request.inferenceConfig?.topP,
      maxTokens: request.inferenceConfig?.maxTokens,
      stopSequences: request.inferenceConfig?.stopSequences ?? []
    }
  })
}

const annotateResponse = (
  span: Span,
  request: typeof ConverseRequest.Encoded,
  response: ConverseResponse
): void => {
  addGenAIAnnotations(span, {
    response: {
      model: request.modelId,
      finishReasons: response.stopReason ? [response.stopReason] : undefined
    },
    usage: {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens
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
        inputTokens: part.usage.inputTokens?.total,
        outputTokens: part.usage.outputTokens?.total
      }
    })
  }
}

// =============================================================================
// Utilities
// =============================================================================

type ContentGroup = SystemMessageGroup | AssistantMessageGroup | UserMessageGroup

interface SystemMessageGroup {
  readonly type: "system"
  readonly messages: Array<Prompt.SystemMessage>
}

interface AssistantMessageGroup {
  readonly type: "assistant"
  readonly messages: Array<Prompt.AssistantMessage>
}

interface UserMessageGroup {
  readonly type: "user"
  readonly messages: Array<Prompt.ToolMessage | Prompt.UserMessage>
}

const groupMessages = (prompt: Prompt.Prompt): Array<ContentGroup> => {
  const messages: Array<ContentGroup> = []
  let current: ContentGroup | undefined = undefined
  for (const message of prompt.content) {
    switch (message.role) {
      case "system": {
        if (current?.type !== "system") {
          current = { type: "system", messages: [] }
          messages.push(current)
        }
        current.messages.push(message)
        break
      }
      case "assistant": {
        if (current?.type !== "assistant") {
          current = { type: "assistant", messages: [] }
          messages.push(current)
        }
        current.messages.push(message)
        break
      }
      case "tool":
      case "user": {
        if (current?.type !== "user") {
          current = { type: "user", messages: [] }
          messages.push(current)
        }
        current.messages.push(message)
        break
      }
    }
  }
  return messages
}

const trimIfLast = (
  isLastGroup: boolean,
  isLastMessage: boolean,
  isLastPart: boolean,
  text: string
) => isLastGroup && isLastMessage && isLastPart ? text.trim() : text

const getCachePoint = (
  part:
    | Prompt.SystemMessage
    | Prompt.UserMessage
    | Prompt.AssistantMessage
    | Prompt.ToolMessage
): typeof CachePointBlock.Encoded | undefined => part.options.bedrock?.cachePoint ?? undefined

const convertToBase64 = (data: string | Uint8Array): string =>
  typeof data === "string" ? data : Encoding.encodeBase64(data)

const DOCUMENT_MIME_TYPES: Record<string, typeof DocumentFormat.Type> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
  "text/plain": "txt",
  "text/markdown": "md"
}

const getDocumentFormat: (
  mediaType: string
) => Effect.Effect<typeof DocumentFormat.Type, AiError.AiError> = Effect.fnUntraced(
  function*(mediaType) {
    const format = DOCUMENT_MIME_TYPES[mediaType]

    if (Predicate.isUndefined(format)) {
      return yield* AiError.make({
        module: "AmazonBedrockLanguageModel",
        method: "getDocumentFormat",
        reason: new AiError.InvalidUserInputError({
          description: `Unsupported document MIME type: ${mediaType} - expected ` +
            `one of: ${Object.keys(DOCUMENT_MIME_TYPES)}`
        })
      })
    }

    return format
  }
)

const getImageFormat: (
  mediaType: string
) => Effect.Effect<typeof ImageFormat.Type, AiError.AiError> = Effect.fnUntraced(
  function*(mediaType) {
    const format = ImageFormat.literals.find((format: string) => mediaType === `image/${format}`)

    if (Predicate.isUndefined(format)) {
      return yield* AiError.make({
        module: "AmazonBedrockLanguageModel",
        method: "getImageFormat",
        reason: new AiError.InvalidUserInputError({
          description: `Unsupported image MIME type: ${mediaType} - expected ` +
            `one of: ${ImageFormat.literals.map((format: string) => `image/${format}`).join(",")}`
        })
      })
    }

    return format
  }
)
