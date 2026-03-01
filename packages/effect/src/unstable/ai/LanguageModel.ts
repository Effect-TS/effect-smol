/**
 * The `LanguageModel` module provides AI text generation capabilities with tool
 * calling support.
 *
 * This module offers a comprehensive interface for interacting with large
 * language models, supporting both streaming and non-streaming text generation,
 * structured output generation, and tool calling functionality. It provides a
 * unified API that can be implemented by different AI providers while
 * maintaining type safety and effect management.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * // Basic text generation
 * const program = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateText({
 *     prompt: "Explain quantum computing"
 *   })
 *
 *   console.log(response.text)
 *
 *   return response
 * })
 * ```
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * // Structured output generation
 * const ContactSchema = Schema.Struct({
 *   name: Schema.String,
 *   email: Schema.String
 * })
 *
 * const extractContact = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateObject({
 *     prompt: "Extract contact: John Doe, john@example.com",
 *     schema: ContactSchema
 *   })
 *
 *   return response.value
 * })
 * ```
 *
 * @since 4.0.0
 */
import type * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import * as FiberSet from "../../FiberSet.ts"
import { constFalse } from "../../Function.ts"
import type * as JsonSchema from "../../JsonSchema.ts"
import * as Option from "../../Option.ts"
import * as Predicate from "../../Predicate.ts"
import * as Queue from "../../Queue.ts"
import { CurrentConcurrency } from "../../References.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Sink from "../../Sink.ts"
import * as Stream from "../../Stream.ts"
import type { Span } from "../../Tracer.ts"
import type { Concurrency, Mutable, NoExcessProperties } from "../../Types.ts"
import * as AiError from "./AiError.ts"
import { defaultIdGenerator, IdGenerator } from "./IdGenerator.ts"
import * as InternalCodecTransformer from "./internal/codec-transformer.ts"
import * as Prompt from "./Prompt.ts"
import * as Response from "./Response.ts"
import type { SpanTransformer } from "./Telemetry.ts"
import { CurrentSpanTransformer } from "./Telemetry.ts"
import type * as Tool from "./Tool.ts"
import * as Toolkit from "./Toolkit.ts"

// =============================================================================
// Service Definition
// =============================================================================

/**
 * The `LanguageModel` service key for dependency injection.
 *
 * This provides access to language model functionality throughout your
 * application, enabling text generation, streaming, and structured output
 * capabilities.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   const model = yield* LanguageModel.LanguageModel
 *   const response = yield* model.generateText({
 *     prompt: "What is machine learning?"
 *   })
 *   return response.text
 * })
 * ```
 *
 * @since 4.0.0
 * @category services
 */
export class LanguageModel extends ServiceMap.Service<LanguageModel, Service>()(
  "effect/unstable/ai/LanguageModel"
) {}

/**
 * The service interface for language model operations.
 *
 * Defines the contract that all language model implementations must fulfill,
 * providing text generation, structured output, and streaming capabilities.
 *
 * @since 4.0.0
 * @category models
 */
export interface Service {
  /**
   * Generate text using the language model.
   */
  readonly generateText: <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>
  ) => Effect.Effect<
    GenerateTextResponse<Tools>,
    ExtractError<Options>,
    ExtractServices<Options>
  >

  /**
   * Generate a structured object from a schema using the language model.
   */
  readonly generateObject: <
    ObjectEncoded extends Record<string, any>,
    StructuredOutputSchema extends Schema.Encoder<ObjectEncoded, unknown>,
    Options extends NoExcessProperties<
      GenerateObjectOptions<any, StructuredOutputSchema>,
      Options
    >,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateObjectOptions<Tools, StructuredOutputSchema>
  ) => Effect.Effect<
    GenerateObjectResponse<Tools, StructuredOutputSchema["Type"]>,
    ExtractError<Options>,
    ExtractServices<Options> | StructuredOutputSchema["DecodingServices"]
  >

  /**
   * Generate text using the language model with streaming output.
   */
  readonly streamText: <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>
  ) => Stream.Stream<
    Response.StreamPart<Tools>,
    ExtractError<Options>,
    ExtractServices<Options>
  >
}

/**
 * A function that transforms a `Schema.Codec` into a provider-compatible form
 * for structured output generation.
 *
 * Different language model providers have varying constraints on the JSON
 * schemas they accept. A `CodecTransformer` rewrites a codec's encoded side to
 * satisfy those constraints while preserving the decoded type.
 *
 * @since 4.0.0
 * @category models
 */
export type CodecTransformer = <T, E, RD, RE>(schema: Schema.Codec<T, E, RD, RE>) => {
  readonly codec: Schema.Codec<T, unknown, RD, RE>
  readonly jsonSchema: JsonSchema.JsonSchema
}

/**
 * A `ServiceMap.Reference` that holds the current `CodecTransformer` used by
 * `LanguageModel.generateObject` to adapt structured output schemas for the
 * active provider.
 *
 * By default, this is the identity function (no transformation). Provider
 * packages (e.g. `@effect/ai-anthropic`) override this reference with a
 * provider-specific transformer so that schemas are automatically rewritten
 * before being sent to the model as well as before decoding the generated value.
 *
 * @since 4.0.0
 * @category services
 */
export const CurrentCodecTransformer: ServiceMap.Reference<CodecTransformer> =
  InternalCodecTransformer.CurrentCodecTransformer

/**
 * The default codec transformer that passes schemas through without
 * provider-specific rewrites.
 *
 * @since 4.0.0
 * @category services
 */
export const defaultCodecTransformer: CodecTransformer = InternalCodecTransformer.defaultCodecTransformer

/**
 * Configuration options for text generation.
 *
 * @since 4.0.0
 * @category models
 */
export interface GenerateTextOptions<Tools extends Record<string, Tool.Any>> {
  /**
   * The prompt input to use to generate text.
   */
  readonly prompt: Prompt.RawInput

  /**
   * A toolkit containing both the tools and the tool call handler to use to
   * augment text generation.
   */
  readonly toolkit?:
    | Toolkit.WithHandler<Tools>
    | Effect.Yieldable<
      Toolkit.Toolkit<Tools>,
      Toolkit.WithHandler<Tools>,
      never,
      any
    >
    | undefined

  /**
   * The tool choice mode for the language model.
   * - `auto` (default): The model can decide whether or not to call tools, as
   *   well as which tools to call.
   * - `required`: The model **must** call a tool but can decide which tool will
   *   be called.
   * - `none`: The model **must not** call a tool.
   * - `{ tool: <tool_name> }`: The model must call the specified tool.
   * - `{ mode?: "auto" (default) | "required", "oneOf": [<tool-names>] }`: The
   *   model is restricted to the subset of tools specified by `oneOf`. When
   *   `mode` is `"auto"` or omitted, the model can decide whether or not a tool
   *   from the allowed subset of tools can be called. When `mode` is
   *   `"required"`, the model **must** call one tool from the allowed subset of
   *   tools.
   */
  readonly toolChoice?:
    | ToolChoice<{ [Name in keyof Tools]: Tools[Name]["name"] }[keyof Tools]>
    | undefined

  /**
   * The concurrency level for resolving tool calls.
   */
  readonly concurrency?: Concurrency | undefined

  /**
   * When set to `true`, tool calls requested by the large language model
   * will not be auto-resolved by the framework.
   *
   * This option is useful when:
   *   1. The user wants to include tool call definitions from an `AiToolkit`
   *      in requests to the large language model so that the model has the
   *      capability to call tools
   *   2. The user wants to control the execution of tool call resolvers
   *      instead of having the framework handle tool call resolution
   */
  readonly disableToolCallResolution?: boolean | undefined
}

/**
 * Configuration options for structured object generation.
 *
 * @since 4.0.0
 * @category models
 */
export interface GenerateObjectOptions<
  Tools extends Record<string, Tool.Any>,
  StructuredOutputSchema extends Schema.Top
> extends GenerateTextOptions<Tools> {
  /**
   * The name of the structured output that should be generated. Used by some
   * large language model providers to provide additional guidance to the model.
   */
  readonly objectName?: string | undefined

  /**
   * The schema to be used to specify the structure of the object to generate.
   */
  readonly schema: StructuredOutputSchema
}

/**
 * The tool choice mode for the language model.
 * - `auto` (default): The model can decide whether or not to call tools, as
 *   well as which tools to call.
 * - `required`: The model **must** call a tool but can decide which tool will
 *   be called.
 * - `none`: The model **must not** call a tool.
 * - `{ tool: <tool_name> }`: The model must call the specified tool.
 * - `{ mode?: "auto" (default) | "required", "oneOf": [<tool-names>] }`: The
 *   model is restricted to the subset of tools specified by `oneOf`. When
 *   `mode` is `"auto"` or omitted, the model can decide whether or not a tool
 *   from the allowed subset of tools can be called. When `mode` is
 *   `"required"`, the model **must** call one tool from the allowed subset of
 *   tools.
 *
 * @since 4.0.0
 * @category models
 */
export type ToolChoice<ToolName extends string> =
  | "auto"
  | "none"
  | "required"
  | {
    readonly tool: ToolName
  }
  | {
    readonly mode?: "auto" | "required"
    readonly oneOf: ReadonlyArray<ToolName>
  }

/**
 * Response class for text generation operations.
 *
 * Contains the generated content and provides convenient accessors for
 * extracting different types of response parts like text, tool calls, and usage
 * information.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateText({
 *     prompt: "Explain photosynthesis"
 *   })
 *
 *   console.log(response.text) // Generated text content
 *   console.log(response.finishReason) // "stop", "length", etc.
 *   console.log(response.usage) // Usage information
 *
 *   return response
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export class GenerateTextResponse<Tools extends Record<string, Tool.Any>> {
  readonly content: Array<Response.Part<Tools>>

  constructor(content: Array<Response.Part<Tools>>) {
    this.content = content
  }

  /**
   * Extracts and concatenates all text parts from the response.
   */
  get text(): string {
    const text: Array<string> = []
    for (const part of this.content) {
      if (part.type === "text") {
        text.push(part.text)
      }
    }
    return text.join("")
  }

  /**
   * Returns all reasoning parts from the response.
   */
  get reasoning(): Array<Response.ReasoningPart> {
    return this.content.filter((part) => part.type === "reasoning")
  }

  /**
   * Extracts and concatenates all reasoning text, or undefined if none exists.
   */
  get reasoningText(): string | undefined {
    const text: Array<string> = []
    for (const part of this.content) {
      if (part.type === "reasoning") {
        text.push(part.text)
      }
    }
    return text.length === 0 ? undefined : text.join("")
  }

  /**
   * Returns all tool call parts from the response.
   */
  get toolCalls(): Array<Response.ToolCallParts<Tools>> {
    return this.content.filter((part) => part.type === "tool-call")
  }

  /**
   * Returns all tool result parts from the response.
   */
  get toolResults(): Array<Response.ToolResultParts<Tools>> {
    return this.content.filter((part) => part.type === "tool-result")
  }

  /**
   * The reason why text generation finished.
   */
  get finishReason(): Response.FinishReason {
    const finishPart = this.content.find((part) => part.type === "finish")
    return Predicate.isUndefined(finishPart) ? "unknown" : finishPart.reason
  }

  /**
   * Token usage statistics for the generation request.
   */
  get usage(): Response.Usage {
    const finishPart = this.content.find((part) => part.type === "finish")
    if (Predicate.isUndefined(finishPart)) {
      return new Response.Usage({
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
      })
    }
    return finishPart.usage
  }
}

/**
 * Response class for structured object generation operations.
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const UserSchema = Schema.Struct({
 *   name: Schema.String,
 *   email: Schema.String
 * })
 *
 * const program = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateObject({
 *     prompt: "Create user: John Doe, john@example.com",
 *     schema: UserSchema
 *   })
 *
 *   console.log(response.value) // { name: "John Doe", email: "john@example.com" }
 *   console.log(response.text) // Raw generated text
 *
 *   return response.value
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export class GenerateObjectResponse<
  Tools extends Record<string, Tool.Any>,
  A
> extends GenerateTextResponse<Tools> {
  /**
   * The parsed structured object that conforms to the provided schema.
   */
  readonly value: A

  constructor(value: A, content: Array<Response.Part<Tools>>) {
    super(content)
    this.value = value
  }
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Utility type that extracts the error type from LanguageModel options.
 *
 * Automatically infers the possible error types based on toolkit configuration
 * and tool call resolution settings.
 *
 * @since 4.0.0
 * @category utility types
 */
export type ExtractError<Options> = Options extends {
  readonly toolkit: Toolkit.WithHandler<infer _Tools>
  readonly disableToolCallResolution: true
} ? AiError.AiError
  : Options extends {
    readonly toolkit: Effect.Yieldable<
      Toolkit.Toolkit<infer _Tools>,
      Toolkit.WithHandler<infer _Tools>,
      infer _E,
      infer _R
    >
    readonly disableToolCallResolution: true
  } ? AiError.AiError | _E
  : Options extends {
    readonly toolkit: Toolkit.WithHandler<infer _Tools>
  } ? AiError.AiError | Tool.HandlerError<_Tools[keyof _Tools]>
  : Options extends {
    readonly toolkit: Effect.Yieldable<
      Toolkit.Toolkit<infer _Tools>,
      Toolkit.WithHandler<infer _Tools>,
      infer _E,
      infer _R
    >
  } ? AiError.AiError | Tool.HandlerError<_Tools[keyof _Tools]> | _E
  : AiError.AiError

/**
 * Utility type that extracts the context requirements from LanguageModel options.
 *
 * Automatically infers the required services based on the toolkit configuration.
 *
 * @since 4.0.0
 * @category utility types
 */
export type ExtractServices<Options> = Options extends {
  readonly disableToolCallResolution: true
} ? never
  : Options extends {
    readonly toolkit: Toolkit.WithHandler<infer _Tools>
  }
  // Required for tool call execution
    ?
      | Tool.ResultEncodingServices<_Tools[keyof _Tools]>
      // Required for decoding large language model responses
      | Tool.ResultDecodingServices<_Tools[keyof _Tools]>
  : Options extends {
    readonly toolkit: Effect.Yieldable<
      Toolkit.Toolkit<infer _Tools>,
      Toolkit.WithHandler<infer _Tools>,
      infer _E,
      infer _R
    >
  }
  // Required for tool call execution
    ?
      | Tool.ResultEncodingServices<_Tools[keyof _Tools]>
      // Required for decoding large language model responses
      | Tool.ResultDecodingServices<_Tools[keyof _Tools]>
      | _R
  : never

// =============================================================================
// Service Constructor
// =============================================================================

/**
 * Configuration options passed along to language model provider
 * implementations.
 *
 * This interface defines the normalized options that are passed to the
 * underlying provider implementation, regardless of the specific provider being
 * used.
 *
 * @since 4.0.0
 * @category models
 */
export interface ProviderOptions {
  /**
   * The prompt messages to use to generate text.
   */
  readonly prompt: Prompt.Prompt

  /**
   * The tools that the large language model will have available to provide
   * additional information which can be incorporated into its text generation.
   */
  readonly tools: ReadonlyArray<Tool.Any>

  /**
   * The format which the response should be provided in.
   *
   * If `"text"` is specified, the large language model response will be
   * returned as text.
   *
   * If `"json"` is specified, the large language model respose will be provided
   * as an JSON object that conforms to the shape of the specified schema.
   *
   * Defaults to `{ type: "text" }`.
   */
  readonly responseFormat:
    | {
      readonly type: "text"
    }
    | {
      readonly type: "json"
      readonly objectName: string
      readonly schema: Schema.Top
    }

  /**
   * The tool choice mode for the language model.
   * - `auto` (default): The model can decide whether or not to call tools, as
   *   well as which tools to call.
   * - `required`: The model **must** call a tool but can decide which tool will
   *   be called.
   * - `none`: The model **must not** call a tool.
   * - `{ tool: <tool_name> }`: The model must call the specified tool.
   * - `{ mode?: "auto" (default) | "required", "oneOf": [<tool-names>] }`: The
   *   model is restricted to the subset of tools specified by `oneOf`. When
   *   `mode` is `"auto"` or omitted, the model can decide whether or not a tool
   *   from the allowed subset of tools can be called. When `mode` is
   *   `"required"`, the model **must** call one tool from the allowed subset of
   *   tools.
   */
  readonly toolChoice: ToolChoice<any>

  /**
   * The span to use to trace interactions with the large language model.
   */
  readonly span: Span
}

/**
 * Parameters required to construct a LanguageModel service.
 *
 * @since 4.0.0
 * @category models
 */
export interface ConstructorParams {
  /**
   * A method which requests text generation from the large language model
   * provider.
   *
   * The final result is returned when the large language model provider
   * finishes text generation.
   */
  readonly generateText: (
    options: ProviderOptions
  ) => Effect.Effect<Array<Response.PartEncoded>, AiError.AiError, IdGenerator>

  /**
   * A method which requests text generation from the large language model
   * provider.
   *
   * Intermediate results are streamed from the large language model provider.
   */
  readonly streamText: (
    options: ProviderOptions
  ) => Stream.Stream<Response.StreamPartEncoded, AiError.AiError, IdGenerator>
}

/**
 * Creates a LanguageModel service from provider-specific implementations.
 *
 * This constructor takes provider-specific implementations for text generation
 * and streaming text generation and returns a LanguageModel service.
 *
 * @since 4.0.0
 * @category constructors
 */
export const make: (params: ConstructorParams) => Effect.Effect<Service> = Effect.fnUntraced(function*(params) {
  const codecTransformer = yield* InternalCodecTransformer.CurrentCodecTransformer

  const parentSpanTransformer = yield* Effect.serviceOption(
    CurrentSpanTransformer
  )
  const getSpanTransformer = Effect.serviceOption(
    CurrentSpanTransformer
  ).pipe(Effect.map(Option.orElse(() => parentSpanTransformer)))

  const idGenerator = yield* Effect.serviceOption(IdGenerator).pipe(
    Effect.map(Option.getOrElse(() => defaultIdGenerator))
  )

  const generateText = <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>
  ): Effect.Effect<
    GenerateTextResponse<Tools>,
    ExtractError<Options>,
    ExtractServices<Options>
  > =>
    Effect.useSpan(
      "LanguageModel.generateText",
      {
        attributes: {
          concurrency: options.concurrency,
          toolChoice: options.toolChoice
        }
      },
      Effect.fnUntraced(
        function*(span) {
          const spanTransformer = yield* getSpanTransformer

          const providerOptions: Mutable<ProviderOptions> = {
            prompt: Prompt.make(options.prompt),
            tools: [],
            toolChoice: "none",
            responseFormat: { type: "text" },
            span
          }
          const content = yield* generateContent(options, providerOptions)

          applySpanTransformer(
            spanTransformer,
            content as any,
            providerOptions
          )

          return new GenerateTextResponse(content)
        },
        Effect.catchTag("SchemaError", (error) =>
          Effect.fail(
            AiError.make({
              module: "LanguageModel",
              method: "generateText",
              reason: AiError.InvalidOutputError.fromSchemaError(error)
            })
          )),
        (effect, span) => Effect.withParentSpan(effect, span, { captureStackTrace: false }),
        Effect.provideService(IdGenerator, idGenerator),
        Effect.provideService(InternalCodecTransformer.CurrentCodecTransformer, codecTransformer)
      )
    ) as any

  const generateObject = <
    ObjectEncoded extends Record<string, any>,
    StructuredOutputSchema extends Schema.Encoder<ObjectEncoded, unknown>,
    Options extends NoExcessProperties<
      GenerateObjectOptions<any, StructuredOutputSchema>,
      Options
    >,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateObjectOptions<Tools, StructuredOutputSchema>
  ): Effect.Effect<
    GenerateObjectResponse<Tools, StructuredOutputSchema["Type"]>,
    ExtractError<Options>,
    ExtractServices<Options> | StructuredOutputSchema["DecodingServices"]
  > => {
    const objectName = getObjectName(options.objectName, options.schema)
    return Effect.useSpan(
      "LanguageModel.generateObject",
      {
        attributes: {
          objectName,
          concurrency: options.concurrency,
          toolChoice: options.toolChoice
        }
      },
      Effect.fnUntraced(
        function*(span) {
          const spanTransformer = yield* getSpanTransformer

          const providerOptions: Mutable<ProviderOptions> = {
            prompt: Prompt.make(options.prompt),
            tools: [],
            toolChoice: "none",
            responseFormat: {
              type: "json",
              objectName,
              schema: options.schema
            },
            span
          }

          const content = yield* generateContent(options, providerOptions)

          applySpanTransformer(
            spanTransformer,
            content as any,
            providerOptions
          )

          const { codec } = yield* Effect.try({
            try: () => codecTransformer(options.schema),
            catch: (error) =>
              AiError.make({
                module: "LanguageModel",
                method: "generateObject",
                reason: new AiError.UnsupportedSchemaError({
                  description: error instanceof Error ? error.message : String(error)
                })
              })
          })

          const value = yield* resolveStructuredOutput(content as any, codec)

          return new GenerateObjectResponse(value, content)
        },
        Effect.catchTag("SchemaError", (error) =>
          Effect.fail(
            AiError.make({
              module: "LanguageModel",
              method: "generateObject",
              reason: AiError.InvalidOutputError.fromSchemaError(error)
            })
          )),
        (effect, span) => Effect.withParentSpan(effect, span, { captureStackTrace: false }),
        Effect.provideService(IdGenerator, idGenerator),
        Effect.provideService(InternalCodecTransformer.CurrentCodecTransformer, codecTransformer)
      )
    ) as any
  }

  const streamText: <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>
  ) => Stream.Stream<
    Response.StreamPart<Tools>,
    ExtractError<Options>,
    ExtractServices<Options>
  > = Effect.fnUntraced(
    function*<
      Tools extends Record<string, Tool.Any>,
      Options extends NoExcessProperties<GenerateTextOptions<Tools>, Options>
    >(options: Options & GenerateTextOptions<Tools>) {
      const span = yield* Effect.makeSpanScoped("LanguageModel.streamText", {
        attributes: {
          concurrency: options.concurrency,
          toolChoice: options.toolChoice
        }
      })

      const providerOptions: Mutable<ProviderOptions> = {
        prompt: Prompt.make(options.prompt),
        tools: [],
        toolChoice: "none",
        responseFormat: { type: "text" },
        span
      }

      // Resolve the content stream for the request
      const stream = yield* streamContent(options, providerOptions)

      // Return the stream immediately if there is no span transformer
      const spanTransformer = yield* getSpanTransformer
      if (Option.isNone(spanTransformer)) {
        return stream
      }

      // Otherwise aggregate generated content and apply the span transformer
      // when the stream is finished
      const content: Array<Response.StreamPart<Tools>> = []
      return stream.pipe(
        Stream.mapArray((parts) => {
          content.push(...parts)
          return parts
        }),
        Stream.ensuring(
          Effect.sync(() => {
            spanTransformer.value({
              ...providerOptions,
              response: content as any
            })
          })
        )
      )
    },
    Stream.unwrap,
    Stream.mapError((error) =>
      Schema.isSchemaError(error)
        ? AiError.make({
          module: "LanguageModel",
          method: "streamText",
          reason: AiError.InvalidOutputError.fromSchemaError(error)
        })
        : error
    ),
    Stream.provideService(IdGenerator, idGenerator),
    Stream.provideService(InternalCodecTransformer.CurrentCodecTransformer, codecTransformer)
  ) as any

  const generateContent: <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>,
    providerOptions: Mutable<ProviderOptions>
  ) => Effect.Effect<
    Array<Response.Part<Tools>>,
    AiError.AiError | Schema.SchemaError,
    IdGenerator
  > = Effect.fnUntraced(function*<
    Tools extends Record<string, Tool.Any>,
    Options extends NoExcessProperties<GenerateTextOptions<Tools>, Options>
  >(
    options: Options & GenerateTextOptions<Tools>,
    providerOptions: Mutable<ProviderOptions>
  ) {
    const toolChoice = options.toolChoice ?? "auto"

    // Check for pending approvals that need resolution
    const { approved, denied } = collectToolApprovals(
      providerOptions.prompt.content,
      { excludeResolved: true }
    )
    const hasPendingApprovals = approved.length > 0 || denied.length > 0

    // If there is no toolkit, the generated content can be returned immediately
    if (Predicate.isUndefined(options.toolkit)) {
      // But first check if we have pending approvals that require a toolkit
      if (hasPendingApprovals) {
        return yield* AiError.make({
          module: "LanguageModel",
          method: "generateText",
          reason: new AiError.ToolkitRequiredError({
            pendingApprovals: [...approved, ...denied]
              .map((result) => result.toolCall?.name)
              .filter(Predicate.isNotUndefined)
          })
        })
      }
      const ResponseSchema = Schema.mutable(
        Schema.Array(Response.Part(Toolkit.empty))
      )
      const rawContent = yield* params.generateText(providerOptions)
      const content = yield* Schema.decodeEffect(ResponseSchema)(rawContent)
      return content as Array<Response.Part<Tools>>
    }

    // If there is a toolkit resolve and apply it to the provider options
    const toolkit = yield* resolveToolkit<Tools, any, any>(options.toolkit)

    // If the resolved toolkit is empty, return the generated content immediately
    if (Object.values(toolkit.tools).length === 0) {
      // But first check if we have pending approvals that require a toolkit
      if (hasPendingApprovals) {
        return yield* AiError.make({
          module: "LanguageModel",
          method: "generateText",
          reason: new AiError.ToolkitRequiredError({
            pendingApprovals: [...approved, ...denied]
              .map((result) => result.toolCall?.name)
              .filter(Predicate.isNotUndefined)
          })
        })
      }
      const ResponseSchema = Schema.mutable(
        Schema.Array(Response.Part(Toolkit.empty))
      )
      const rawContent = yield* params.generateText(providerOptions)
      const content = yield* Schema.decodeEffect(ResponseSchema)(rawContent)
      return content as Array<Response.Part<Tools>>
    }

    // Pre-resolve pending tool approvals before calling the LLM
    if (hasPendingApprovals) {
      for (const approval of approved) {
        if (approval.toolCall && !toolkit.tools[approval.toolCall.name]) {
          return yield* AiError.make({
            module: "LanguageModel",
            method: "generateText",
            reason: new AiError.ToolNotFoundError({
              toolName: approval.toolCall.name,
              availableTools: Object.keys(toolkit.tools)
            })
          })
        }
      }

      const approvedResults = yield* executeApprovedToolCalls(
        approved,
        toolkit,
        options.concurrency
      )
      const deniedResults = createDenialResults(denied)
      const preResolvedResults = [...approvedResults, ...deniedResults]

      if (preResolvedResults.length > 0) {
        providerOptions.prompt = Prompt.fromMessages([
          ...providerOptions.prompt.content,
          Prompt.makeMessage("tool", { content: preResolvedResults })
        ])
      }
    }

    // Strip all resolved approval artifacts (both current and from previous
    // rounds) in a single pass before sending to the provider.
    {
      const { approved: allResolved, denied: allDenied } = collectToolApprovals(
        providerOptions.prompt.content
      )
      if (allResolved.length > 0 || allDenied.length > 0) {
        providerOptions.prompt = stripResolvedApprovals(
          providerOptions.prompt,
          allResolved,
          allDenied
        )
      }
    }

    const tools = typeof toolChoice === "object" && "oneOf" in toolChoice
      ? Object.values(toolkit.tools).filter((tool) => toolChoice.oneOf.includes(tool.name))
      : Object.values(toolkit.tools)
    providerOptions.tools = tools
    providerOptions.toolChoice = toolChoice

    // Construct the response schema with the tools from the toolkit
    const ResponseSchema = Schema.mutable(
      Schema.Array(Response.Part(toolkit))
    )

    // If tool call resolution is disabled, return the response without
    // resolving the tool calls that were generated
    if (options.disableToolCallResolution === true) {
      const rawContent = yield* params.generateText(providerOptions)
      const content = yield* Schema.decodeEffect(ResponseSchema)(rawContent)
      return content as Array<Response.Part<Tools>>
    }

    const rawContent = yield* params.generateText(providerOptions)

    // Resolve the generated tool calls
    const toolResults = yield* resolveToolCalls(
      rawContent,
      toolkit,
      providerOptions.prompt.content,
      options.concurrency
    ).pipe(
      Stream.filter(
        (result) =>
          result.type === "tool-approval-request" ||
          result.preliminary === false
      ),
      Stream.runCollect
    )

    const content = yield* Schema.decodeEffect(ResponseSchema)(rawContent)

    // Return the content merged with the tool call results
    return [...content, ...toolResults] as Array<Response.Part<Tools>>
  })

  const streamContent: <
    Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
    Tools extends Record<string, Tool.Any> = {}
  >(
    options: Options & GenerateTextOptions<Tools>,
    providerOptions: Mutable<ProviderOptions>
  ) => Effect.Effect<
    Stream.Stream<
      Response.StreamPart<Tools>,
      AiError.AiError | Schema.SchemaError,
      IdGenerator
    >,
    Options extends {
      readonly toolkit: Effect.Effect<
        Toolkit.WithHandler<Tools>,
        infer _E,
        infer _R
      >
    } ? _E
      : never,
    Options extends {
      readonly toolkit: Effect.Effect<
        Toolkit.WithHandler<Tools>,
        infer _E,
        infer _R
      >
    } ? _R
      : never
  > = Effect.fnUntraced(function*<
    Tools extends Record<string, Tool.Any>,
    Options extends NoExcessProperties<GenerateTextOptions<Tools>, Options>
  >(
    options: Options & GenerateTextOptions<Tools>,
    providerOptions: Mutable<ProviderOptions>
  ) {
    const toolChoice = options.toolChoice ?? "auto"

    // Check for pending approvals that need resolution
    const { approved: pendingApproved, denied: pendingDenied } = collectToolApprovals(providerOptions.prompt.content, {
      excludeResolved: true
    })
    const hasPendingApprovals = pendingApproved.length > 0 || pendingDenied.length > 0

    // If there is no toolkit, return immediately
    if (Predicate.isUndefined(options.toolkit)) {
      // But first check if we have pending approvals that require a toolkit
      if (hasPendingApprovals) {
        return yield* AiError.make({
          module: "LanguageModel",
          method: "streamText",
          reason: new AiError.ToolkitRequiredError({
            pendingApprovals: [...pendingApproved, ...pendingDenied]
              .map((a) => a.toolCall?.name)
              .filter(Predicate.isNotUndefined)
          })
        })
      }
      const schema = Schema.NonEmptyArray(Response.StreamPart(Toolkit.empty))
      const decodeParts = Schema.decodeEffect(schema)
      return params
        .streamText(providerOptions)
        .pipe(
          Stream.mapArrayEffect((parts) => decodeParts(parts))
        ) as Stream.Stream<
          Response.StreamPart<Tools>,
          AiError.AiError | Schema.SchemaError,
          IdGenerator
        >
    }

    // If there is a toolkit resolve and apply it to the provider options
    const toolkit = "asEffect" in options.toolkit
      ? yield* options.toolkit
      : options.toolkit

    // If the toolkit is empty, return immediately
    if (Object.values(toolkit.tools).length === 0) {
      // But first check if we have pending approvals that require a toolkit
      if (hasPendingApprovals) {
        return yield* AiError.make({
          module: "LanguageModel",
          method: "streamText",
          reason: new AiError.ToolkitRequiredError({
            pendingApprovals: [...pendingApproved, ...pendingDenied]
              .map((a) => a.toolCall?.name)
              .filter(Predicate.isNotUndefined)
          })
        })
      }
      const schema = Schema.NonEmptyArray(Response.StreamPart(Toolkit.empty))
      const decodeParts = Schema.decodeEffect(schema)
      return params
        .streamText(providerOptions)
        .pipe(
          Stream.mapArrayEffect((parts) => decodeParts(parts))
        ) as Stream.Stream<
          Response.StreamPart<Tools>,
          AiError.AiError | Schema.SchemaError,
          IdGenerator
        >
    }

    // Pre-resolve pending tool approvals before calling the LLM
    let preResolvedStreamParts: Array<Response.StreamPart<Tools>> = []

    if (hasPendingApprovals) {
      for (const approval of pendingApproved) {
        if (approval.toolCall && !toolkit.tools[approval.toolCall.name]) {
          return yield* AiError.make({
            module: "LanguageModel",
            method: "streamText",
            reason: new AiError.ToolNotFoundError({
              toolName: approval.toolCall.name,
              availableTools: Object.keys(toolkit.tools)
            })
          })
        }
      }

      const approvedResults = yield* executeApprovedToolCalls(
        pendingApproved,
        toolkit,
        options.concurrency
      )
      const deniedResults = createDenialResults(pendingDenied)
      const preResolvedResults = [...approvedResults, ...deniedResults]

      if (preResolvedResults.length > 0) {
        providerOptions.prompt = Prompt.fromMessages([
          ...providerOptions.prompt.content,
          Prompt.makeMessage("tool", { content: preResolvedResults })
        ])
      }

      // Emit pre-resolved tool-results as stream parts so Chat.streamText
      // persists them to history. This lets collectToolApprovals find them
      // on subsequent rounds and skip the now-resolved approvals.
      // Note: r.result is already encoded (from executeApprovedToolCalls /
      // createDenialResults), so it goes into both result and encodedResult.
      for (const r of preResolvedResults) {
        preResolvedStreamParts.push(
          Response.makePart("tool-result", {
            id: r.id,
            name: r.name,
            providerExecuted: false,
            preliminary: false,
            result: r.result,
            encodedResult: r.result,
            isFailure: r.isFailure
          }) as Response.StreamPart<Tools>
        )
      }
    }

    // Strip all resolved approval artifacts (both current and from previous
    // rounds) in a single pass before sending to the provider.
    const { approved: allResolved, denied: allDenied } = collectToolApprovals(
      providerOptions.prompt.content
    )
    if (allResolved.length > 0 || allDenied.length > 0) {
      providerOptions.prompt = stripResolvedApprovals(
        providerOptions.prompt,
        allResolved,
        allDenied
      )
    }

    const tools = typeof toolChoice === "object" && "oneOf" in toolChoice
      ? Object.values(toolkit.tools).filter((tool) => toolChoice.oneOf.includes(tool.name))
      : Object.values(toolkit.tools)
    providerOptions.tools = tools
    providerOptions.toolChoice = toolChoice

    // If tool call resolution is disabled, return the response without
    // resolving the tool calls that were generated
    if (options.disableToolCallResolution === true) {
      const schema = Schema.NonEmptyArray(Response.StreamPart(toolkit))
      const decodeParts = Schema.decodeEffect(schema)
      return params
        .streamText(providerOptions)
        .pipe(
          Stream.mapArrayEffect((parts) => decodeParts(parts))
        ) as Stream.Stream<
          Response.StreamPart<Tools>,
          AiError.AiError | Schema.SchemaError,
          IdGenerator
        >
    }

    const ResponseSchema = Schema.NonEmptyArray(Response.StreamPart(toolkit))
    const decodeParts = Schema.decodeEffect(ResponseSchema)

    // Queue for decoded parts and tool results
    const queue = yield* Queue.make<
      Response.StreamPart<Tools>,
      | AiError.AiError
      | Cause.Done
      | Schema.SchemaError
    >()

    // Emit pre-resolved tool results so Chat.streamText persists them to
    // history. This ensures collectToolApprovals({ excludeResolved }) can
    // find the corresponding tool-results on future rounds.
    if (preResolvedStreamParts.length > 0) {
      yield* Queue.offerAll(queue, preResolvedStreamParts)
    }

    // FiberSet to track concurrent tool call handlers
    const toolCallFibers = yield* FiberSet.make<void, AiError.AiError>()

    // Helper function to handle tool calls with approval logic
    const handleToolCall = (part: Response.ToolCallPartEncoded) =>
      Effect.gen(function*() {
        const tool = toolkit.tools[part.name]
        if (!tool) {
          return
        }

        const needsApproval = yield* isApprovalNeeded(
          tool,
          part,
          providerOptions.prompt.content
        )

        if (needsApproval) {
          const idGen = yield* IdGenerator
          const approvalId = yield* idGen.generateId()
          const approvalPart = Response.makePart("tool-approval-request", {
            approvalId,
            toolCallId: part.id
          }) as Response.StreamPart<Tools>
          yield* Queue.offer(queue, approvalPart)
          return
        }

        yield* toolkit.handle(part.name, part.params as any).pipe(
          Stream.unwrap,
          Stream.runForEach((result) => {
            const toolResultPart = Response.makePart("tool-result", {
              id: part.id,
              name: part.name,
              providerExecuted: false,
              ...result
            }) as Response.StreamPart<Tools>
            return Queue.offer(queue, toolResultPart)
          })
        )
      })

    yield* params.streamText(providerOptions).pipe(
      Stream.runForEachArray(
        Effect.fnUntraced(function*(chunk) {
          const parts = yield* decodeParts(chunk)
          // Add decoded response parts to the output queue
          yield* Queue.offerAll(queue, parts)
          // Fork tool call handlers - use the raw chunk for encoded params
          for (const part of chunk) {
            if (part.type === "tool-call" && part.providerExecuted !== true) {
              yield* FiberSet.run(toolCallFibers, handleToolCall(part))
            }
          }
        })
      ),
      // Wait for all tool calls to either:
      // - complete (FiberSet.awaitEmpty)
      // - fail (FiberSet.join)
      Effect.andThen(
        Effect.raceFirst(
          FiberSet.join(toolCallFibers),
          FiberSet.awaitEmpty(toolCallFibers)
        )
      ),
      // And then end the queue
      Effect.andThen(Queue.end(queue)),
      Effect.tapCause((cause) => Queue.failCause(queue, cause)),
      Effect.forkScoped
    )

    return Stream.fromQueue(queue)
  }) as any

  return {
    generateText,
    generateObject,
    streamText
  } as const
})

// =============================================================================
// Accessors
// =============================================================================

/**
 * Generate text using a language model.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const program = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateText({
 *     prompt: "Write a haiku about programming",
 *     toolChoice: "none"
 *   })
 *
 *   console.log(response.text)
 *   console.log(response.usage.inputTokens.total)
 *
 *   return response
 * })
 * ```
 *
 * @since 4.0.0
 * @category text generation
 */
export const generateText = <
  Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
  Tools extends Record<string, Tool.Any> = {}
>(
  options: Options & GenerateTextOptions<Tools>
): Effect.Effect<
  GenerateTextResponse<Tools>,
  ExtractError<Options>,
  LanguageModel | ExtractServices<Options>
> =>
  Effect.flatMap(
    Effect.service(LanguageModel),
    (model) => model.generateText(options)
  )

/**
 * Generate a structured object from a schema using a language model.
 *
 * @example
 * ```ts
 * import { Effect, Schema } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const EventSchema = Schema.Struct({
 *   title: Schema.String,
 *   date: Schema.String,
 *   location: Schema.String
 * })
 *
 * const program = Effect.gen(function*() {
 *   const response = yield* LanguageModel.generateObject({
 *     prompt:
 *       "Extract event info: Tech Conference on March 15th in San Francisco",
 *     schema: EventSchema,
 *     objectName: "event"
 *   })
 *
 *   console.log(response.value)
 *   // { title: "Tech Conference", date: "March 15th", location: "San Francisco" }
 *
 *   return response.value
 * })
 * ```
 *
 * @since 4.0.0
 * @category object generation
 */
export const generateObject = <
  ObjectEncoded extends Record<string, any>,
  StructuredOutputSchema extends Schema.Encoder<ObjectEncoded, unknown>,
  Options extends NoExcessProperties<
    GenerateObjectOptions<any, StructuredOutputSchema>,
    Options
  >,
  Tools extends Record<string, Tool.Any> = {}
>(
  options: Options & GenerateObjectOptions<Tools, StructuredOutputSchema>
): Effect.Effect<
  GenerateObjectResponse<Tools, StructuredOutputSchema["Type"]>,
  ExtractError<Options>,
  ExtractServices<Options> | StructuredOutputSchema["DecodingServices"] | LanguageModel
> =>
  Effect.flatMap(
    Effect.service(LanguageModel),
    (model) => model.generateObject(options)
  )

/**
 * Generate text using a language model with streaming output.
 *
 * Returns a stream of response parts that are emitted as soon as they are
 * available from the model, enabling real-time text generation experiences.
 *
 * @example
 * ```ts
 * import { Console, Effect, Stream } from "effect"
 * import { LanguageModel } from "effect/unstable/ai"
 *
 * const program = LanguageModel.streamText({
 *   prompt: "Write a story about a space explorer"
 * }).pipe(Stream.runForEach((part) => {
 *   if (part.type === "text-delta") {
 *     return Console.log(part.delta)
 *   }
 *   return Effect.void
 * }))
 * ```
 *
 * @since 4.0.0
 * @category text generation
 */
export const streamText = <
  Options extends NoExcessProperties<GenerateTextOptions<any>, Options>,
  Tools extends Record<string, Tool.Any> = {}
>(
  options: Options & GenerateTextOptions<Tools>
): Stream.Stream<
  Response.StreamPart<Tools>,
  ExtractError<Options>,
  ExtractServices<Options> | LanguageModel
> =>
  Stream.unwrap(Effect.map(
    Effect.service(LanguageModel),
    (model) => model.streamText(options)
  ))

// =============================================================================
// Tool Approval Helpers
// =============================================================================

interface ApprovalResult {
  readonly approvalId: string
  readonly toolCallId: string
  readonly approved: boolean
  readonly reason?: string | undefined
  readonly toolCall?: Prompt.ToolCallPart | undefined
}

interface CollectToolApprovalsOptions {
  readonly excludeResolved?: boolean
}

const collectToolApprovals = (
  messages: ReadonlyArray<Prompt.Message>,
  options?: CollectToolApprovalsOptions
): {
  readonly approved: Array<ApprovalResult>
  readonly denied: Array<ApprovalResult>
} => {
  const requests = new Map<
    string,
    Pick<ApprovalResult, "approvalId" | "toolCallId">
  >()
  const responses: Array<Omit<ApprovalResult, "toolCallId" | "toolCall">> = []
  const toolCallsById = new Map<string, Prompt.ToolCallPart>()
  const toolResultIds = new Set<string>()

  // Collect all tool approval requests, responses, tool calls, and tool results
  for (const message of messages) {
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "tool-approval-request") {
          requests.set(part.approvalId, {
            approvalId: part.approvalId,
            toolCallId: part.toolCallId
          })
        }
        if (part.type === "tool-call") {
          toolCallsById.set(part.id, part)
        }
      }
    }
    if (message.role === "tool") {
      for (const part of message.content) {
        if (part.type === "tool-approval-response") {
          responses.push({
            approvalId: part.approvalId,
            approved: part.approved,
            reason: part.reason
          })
        }
        if (part.type === "tool-result") {
          toolResultIds.add(part.id)
        }
      }
    }
  }

  const approved: Array<ApprovalResult> = []
  const denied: Array<ApprovalResult> = []

  for (const response of responses) {
    const request = requests.get(response.approvalId)
    if (Predicate.isNotUndefined(request)) {
      // Skip if already resolved
      if (options?.excludeResolved && toolResultIds.has(request.toolCallId)) {
        continue
      }

      const result: ApprovalResult = {
        ...response,
        toolCallId: request.toolCallId,
        toolCall: toolCallsById.get(request.toolCallId)
      }

      if (response.approved) {
        approved.push(result)
      } else {
        denied.push(result)
      }
    }
  }

  return { approved, denied }
}

/**
 * Strip resolved approval artifacts from the prompt before sending to the
 * provider. After pre-resolving approvals (executing approved tools and
 * creating denial results), the original `tool-approval-request` parts in
 * assistant messages and `tool-approval-response` parts in tool messages are
 * no longer needed. Leaving them in causes provider-specific errors (e.g.
 * OpenAI rejects `mcp_approval_response` items that reference approval
 * requests it never issued).
 */
const stripResolvedApprovals = (
  prompt: Prompt.Prompt,
  approved: ReadonlyArray<ApprovalResult>,
  denied: ReadonlyArray<ApprovalResult>
): Prompt.Prompt => {
  const resolvedApprovalIds = new Set<string>()
  for (const a of approved) resolvedApprovalIds.add(a.approvalId)
  for (const d of denied) resolvedApprovalIds.add(d.approvalId)

  const cleanedMessages: Array<Prompt.Message> = []

  for (const message of prompt.content) {
    if (message.role === "assistant") {
      const filteredContent = message.content.filter(
        (part) =>
          part.type !== "tool-approval-request" ||
          !resolvedApprovalIds.has(part.approvalId)
      )
      if (filteredContent.length > 0) {
        cleanedMessages.push(
          Prompt.makeMessage("assistant", {
            content: filteredContent,
            options: message.options
          })
        )
      }
    } else if (message.role === "tool") {
      const filteredContent = message.content.filter(
        (part) =>
          part.type !== "tool-approval-response" ||
          !resolvedApprovalIds.has(part.approvalId)
      )
      if (filteredContent.length > 0) {
        cleanedMessages.push(
          Prompt.makeMessage("tool", {
            content: filteredContent,
            options: message.options
          })
        )
      }
    } else {
      cleanedMessages.push(message)
    }
  }

  return Prompt.fromMessages(cleanedMessages)
}

const isApprovalNeeded = Effect.fnUntraced(function*<T extends Tool.Any>(
  tool: T,
  toolCall: Response.ToolCallPartEncoded,
  messages: ReadonlyArray<Prompt.Message>
): Effect.fn.Return<boolean, Schema.SchemaError, Tool.HandlerServices<T>> {
  if (Predicate.isUndefined(tool.needsApproval)) {
    return false
  }

  if (typeof tool.needsApproval === "function") {
    const params = yield* Schema.decodeUnknownEffect(tool.parametersSchema)(
      toolCall.params
    ) as any

    const result = tool.needsApproval(params, {
      toolCallId: toolCall.id,
      messages
    })

    return Effect.isEffect(result) ? yield* result : result
  }

  return tool.needsApproval
}, Effect.orElseSucceed(constFalse))

const executeApprovedToolCalls = <Tools extends Record<string, Tool.Any>>(
  approvals: ReadonlyArray<ApprovalResult>,
  toolkit: Toolkit.WithHandler<Tools>,
  concurrency: Concurrency | undefined
): Effect.Effect<
  Array<Prompt.ToolResultPart>,
  Tool.HandlerError<Tools[keyof Tools]> | AiError.AiError,
  Tool.HandlerServices<Tools[keyof Tools]>
> => {
  const executeTool = Effect.fnUntraced(function*(approval: ApprovalResult) {
    const toolCall = approval.toolCall

    if (Predicate.isUndefined(toolCall)) {
      return yield* Effect.die("Approval missing tool call reference")
    }

    const tool = toolkit.tools[toolCall.name]

    if (Predicate.isUndefined(tool)) {
      return yield* AiError.make({
        module: "LanguageModel",
        method: "generateText",
        reason: new AiError.ToolNotFoundError({
          toolName: toolCall.name,
          availableTools: Object.keys(toolkit.tools)
        })
      })
    }

    const resultStream = yield* toolkit.handle(
      toolCall.name,
      toolCall.params as any
    )

    const terminalResult = yield* resultStream.pipe(
      Stream.filter((result) => result.preliminary === false),
      Stream.run(Sink.last()),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.die("Tool handler did not produce a final result"),
          onSome: Effect.succeed
        })
      )
    )

    return Prompt.makePart("tool-result", {
      id: approval.toolCallId,
      name: toolCall.name,
      isFailure: terminalResult.isFailure,
      result: terminalResult.encodedResult
    })
  })

  return Effect.gen(function*() {
    const resolveConcurrency = concurrency === "inherit"
      ? yield* Effect.service(CurrentConcurrency)
      : (concurrency ?? "unbounded")

    return yield* Effect.forEach(approvals, executeTool, {
      concurrency: resolveConcurrency
    })
  })
}

const createDenialResults = (
  denials: ReadonlyArray<ApprovalResult>
): ReadonlyArray<Prompt.ToolResultPart> => {
  const results: Array<Prompt.ToolResultPart> = []
  for (const denial of denials) {
    if (Predicate.isNotUndefined(denial.toolCall)) {
      results.push(
        Prompt.makePart("tool-result", {
          id: denial.toolCallId,
          name: denial.toolCall.name,
          isFailure: true,
          result: { type: "execution-denied", reason: denial.reason }
        })
      )
    }
  }
  return results
}

// =============================================================================
// Tool Call Resolution
// =============================================================================

type ToolResolutionResult<Tools extends Record<string, Tool.Any>> =
  | Response.ToolResultPart<
    Tool.Name<Tools[keyof Tools]>,
    Tool.Success<Tools[keyof Tools]>,
    Tool.Failure<Tools[keyof Tools]>
  >
  | Response.ToolApprovalRequestPart

const resolveToolCalls = <Tools extends Record<string, Tool.Any>>(
  content: ReadonlyArray<Response.AllPartsEncoded>,
  toolkit: Toolkit.WithHandler<Tools>,
  messages: ReadonlyArray<Prompt.Message>,
  concurrency: Concurrency | undefined
): Stream.Stream<
  ToolResolutionResult<Tools>,
  Tool.HandlerError<Tools[keyof Tools]> | AiError.AiError,
  Tool.HandlerServices<Tools[keyof Tools]> | IdGenerator
> => {
  const toolCalls: Array<Response.ToolCallPartEncoded> = []

  for (const part of content) {
    if (part.type === "tool-call") {
      if (part.providerExecuted === true) {
        continue
      }
      toolCalls.push(part)
    }
  }

  const { approved, denied } = collectToolApprovals(messages)
  const approvedToolCallIds = new Set(
    approved.map((approval) => approval.toolCallId)
  )
  const deniedByToolCallId = new Map(
    denied.map((denial) => [denial.toolCallId, denial])
  )

  const streams = toolCalls.map((toolCall) =>
    Effect.gen(function*() {
      const tool = toolkit.tools[toolCall.name]
      if (!tool) {
        return Stream.empty
      }

      if (deniedByToolCallId.has(toolCall.id)) {
        const denial = deniedByToolCallId.get(toolCall.id)!
        return Stream.succeed(
          Response.makePart("tool-result", {
            id: toolCall.id,
            name: toolCall.name,
            providerExecuted: false,
            isFailure: true,
            result: { type: "execution-denied", reason: denial.reason },
            encodedResult: { type: "execution-denied", reason: denial.reason },
            preliminary: false
          }) as ToolResolutionResult<Tools>
        )
      }

      if (approvedToolCallIds.has(toolCall.id)) {
        return toolkit.handle(toolCall.name, toolCall.params as any).pipe(
          Stream.unwrap,
          Stream.map(
            (result) =>
              Response.makePart("tool-result", {
                id: toolCall.id,
                name: toolCall.name,
                providerExecuted: false,
                ...result
              }) as ToolResolutionResult<Tools>
          )
        )
      }

      const needsApproval = yield* isApprovalNeeded(tool, toolCall, messages)
      if (needsApproval) {
        const generator = yield* IdGenerator
        const approvalId = yield* generator.generateId()
        return Stream.succeed(
          Response.makePart("tool-approval-request", {
            approvalId,
            toolCallId: toolCall.id
          }) as ToolResolutionResult<Tools>
        )
      }

      return toolkit.handle(toolCall.name, toolCall.params as any).pipe(
        Stream.unwrap,
        Stream.map(
          (result) =>
            Response.makePart("tool-result", {
              id: toolCall.id,
              name: toolCall.name,
              providerExecuted: false,
              ...result
            }) as ToolResolutionResult<Tools>
        )
      )
    }).pipe(Stream.unwrap)
  )

  const resolveConcurrency = concurrency === "inherit"
    ? Effect.service(CurrentConcurrency)
    : Effect.succeed(concurrency ?? "unbounded")

  return resolveConcurrency.pipe(
    Effect.map((concurrency) => Stream.mergeAll(streams, { concurrency })),
    Stream.unwrap
  )
}

// =============================================================================
// Utilities
// =============================================================================

const resolveToolkit = <Tools extends Record<string, Tool.Any>, E, R>(
  toolkit:
    | Toolkit.WithHandler<Tools>
    | Effect.Yieldable<Toolkit.Toolkit<any>, Toolkit.WithHandler<Tools>, E, R>
): Effect.Effect<Toolkit.WithHandler<Tools>, E, R> =>
  "asEffect" in toolkit ? toolkit.asEffect() : Effect.succeed(toolkit)

/** @internal */
export const getObjectName = <StructuredOutputSchema extends Schema.Top>(
  objectName: string | undefined,
  schema: StructuredOutputSchema
): string => {
  if (Predicate.isNotUndefined(objectName)) {
    return objectName
  }
  if ("identifier" in schema && typeof schema.identifier === "string") {
    return schema.identifier
  }
  const identifier = AST.resolveIdentifier(schema.ast)
  if (typeof identifier === "string") {
    return identifier
  }
  return "generateObject"
}

const resolveStructuredOutput = Effect.fnUntraced(function*<
  StructuredOutputSchema extends Schema.Top
>(response: ReadonlyArray<Response.AllParts<any>>, schema: StructuredOutputSchema) {
  const text: Array<string> = []
  for (const part of response) {
    if (part.type === "text") {
      text.push(part.text)
    }
  }

  if (text.length === 0) {
    return yield* AiError.make({
      module: "LanguageModel",
      method: "generateObject",
      reason: new AiError.StructuredOutputError({
        description: "No text content in response"
      })
    })
  }

  const decode = Schema.decodeEffect(Schema.fromJsonString(schema))
  return yield* Effect.mapError(decode(text.join("")), (error) =>
    AiError.make({
      module: "LanguageModel",
      method: "generateObject",
      reason: AiError.StructuredOutputError.fromSchemaError(error)
    }))
})

const applySpanTransformer = (
  transformer: Option.Option<SpanTransformer>,
  response: ReadonlyArray<Response.AllParts<any>>,
  options: ProviderOptions
): void => {
  if (Option.isSome(transformer)) {
    transformer.value({ ...options, response: response as any })
  }
}
