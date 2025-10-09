/**
 * The `Tool` module provides functionality for defining and managing tools
 * that language models can call to augment their capabilities.
 *
 * This module enables creation of both user-defined and provider-defined tools,
 * with full schema validation, type safety, and handler support. Tools allow
 * AI models to perform actions like searching databases, calling APIs, or
 * executing code within your application context.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * // Define a simple calculator tool
 * const Calculator = Tool.make("Calculator", {
 *   description: "Performs basic arithmetic operations",
 *   parameters: {
 *     operation: Schema.Literal("add", "subtract", "multiply", "divide"),
 *     a: Schema.Number,
 *     b: Schema.Number
 *   },
 *   success: Schema.Number
 * })
 * ```
 *
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import type * as Struct from "../../data/Struct.ts"
import type * as Effect from "../../Effect.ts"
import { constFalse, constTrue, identity } from "../../Function.ts"
import { pipeArguments } from "../../interfaces/Pipeable.ts"
import * as SchemaAnnotations from "../../schema/Annotations.ts"
import * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as JsonSchema from "../../schema/ToJsonSchema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Types from "../../types/Types.ts"

// =============================================================================
// Type Ids
// =============================================================================

const TypeId = "~effect/ai/Tool" as const

const ProviderDefinedTypeId = "~effect/ai/Tool/ProviderDefined" as const

// =============================================================================
// Models
// =============================================================================

/**
 * The strategy used for handling errors returned from tool call handler
 * execution.
 *
 * If set to `"error"` (the default), errors that occur during tool call handler
 * execution will be returned in the error channel of the calling effect.
 *
 * If set to `"return"`, errors that occur during tool call handler execution
 * will be captured and returned as part of the tool call result.
 *
 * @since 4.0.0
 * @category models
 */
export type FailureMode = "error" | "return"

/**
 * A user-defined tool that language models can call to perform actions.
 *
 * Tools represent actionable capabilities that large language models can invoke
 * to extend their functionality beyond text generation. Each tool has a defined
 * schema for parameters, results, and failures.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * // Create a weather lookup tool
 * const GetWeather = Tool.make("GetWeather", {
 *   description: "Get current weather for a location",
 *   parameters: {
 *     location: Schema.String,
 *     units: Schema.Literal("celsius", "fahrenheit")
 *   },
 *   success: Schema.Struct({
 *     temperature: Schema.Number,
 *     condition: Schema.String,
 *     humidity: Schema.Number
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Tool<
  out Name extends string,
  out Config extends {
    readonly parameters: AnyStructSchema
    readonly success: Schema.Top
    readonly failure: Schema.Top
    readonly failureMode: FailureMode
  },
  out Requirements = never
> {
  readonly [TypeId]: {
    readonly _Requirements: Types.Covariant<Requirements>
  }

  /**
   * The tool identifier which is used to uniquely identify the tool.
   */
  readonly id: string

  /**
   * The name of the tool.
   */
  readonly name: Name

  /**
   * The optional description of the tool.
   */
  readonly description?: string | undefined

  /**
   * The strategy used for handling errors returned from tool call handler
   * execution.
   *
   * If set to `"error"` (the default), errors that occur during tool call
   * handler execution will be returned in the error channel of the calling
   * effect.
   *
   * If set to `"return"`, errors that occur during tool call handler execution
   * will be captured and returned as part of the tool call result.
   */
  readonly failureMode: FailureMode

  /**
   * A `Schema` representing the parameters that a tool must be called with.
   */
  readonly parametersSchema: Config["parameters"]

  /**
   * A `Schema` representing the value that a tool must return when called if
   * the tool call is successful.
   */
  readonly successSchema: Config["success"]

  /**
   * A `Schema` representing the value that a tool must return when called if
   * it fails.
   */
  readonly failureSchema: Config["failure"]

  /**
   * A `ServiceMap` containing tool annotations which can store metadata about
   * the tool.
   */
  readonly annotations: ServiceMap.ServiceMap<never>

  /**
   * Adds a _request-level_ dependency which must be provided before the tool
   * call handler can be executed.
   *
   * This can be useful when you want to enforce that a particular dependency
   * **MUST** be provided to each request to the large language model provider
   * instead of being provided when creating the tool call handler layer.
   */
  addDependency<Identifier, Service>(
    tag: ServiceMap.Key<Identifier, Service>
  ): Tool<Name, Config, Identifier | Requirements>

  /**
   * Set the schema to use to validate the result of a tool call when successful.
   */
  setSuccess<SuccessSchema extends Schema.Top>(
    schema: SuccessSchema
  ): Tool<
    Name,
    {
      readonly parameters: Config["parameters"]
      readonly success: SuccessSchema
      readonly failure: Config["failure"]
      readonly failureMode: Config["failureMode"]
    },
    Requirements
  >

  /**
   * Set the schema to use to validate the result of a tool call when it fails.
   */
  setFailure<FailureSchema extends Schema.Top>(
    schema: FailureSchema
  ): Tool<
    Name,
    {
      readonly parameters: Config["parameters"]
      readonly success: Config["success"]
      readonly failure: FailureSchema
      readonly failureMode: Config["failureMode"]
    },
    Requirements
  >

  /**
   * Set the schema to use to validate the result of a tool call when successful.
   */
  setParameters<
    ParametersSchema extends Schema.Struct<any> | Schema.Struct.Fields
  >(
    schema: ParametersSchema
  ): Tool<
    Name,
    {
      readonly parameters: ParametersSchema extends Schema.Struct<infer _> ? ParametersSchema
        : ParametersSchema extends Schema.Struct.Fields ? Schema.Struct<ParametersSchema>
        : never
      readonly success: Config["success"]
      readonly failure: Config["failure"]
      readonly failureMode: Config["failureMode"]
    },
    Requirements
  >

  /**
   * Add an annotation to the tool.
   */
  annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): Tool<Name, Config, Requirements>

  /**
   * Add many annotations to the tool.
   */
  annotateMerge<I>(context: ServiceMap.ServiceMap<I>): Tool<Name, Config, Requirements>
}

/**
 * A provider-defined tool is a tool which is built into a large language model
 * provider (e.g. web search, code execution).
 *
 * These tools are executed by the large language model provider rather than
 * by your application. However, they can optionally require custom handlers
 * implemented in your application to process provider generated results.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * // Define a web search tool provided by OpenAI
 * const WebSearch = Tool.providerDefined({
 *   id: "openai.web_search",
 *   toolkitName: "WebSearch",
 *   providerName: "web_search",
 *   args: {
 *     query: Schema.String
 *   },
 *   success: Schema.Struct({
 *     results: Schema.Array(Schema.Struct({
 *       title: Schema.String,
 *       url: Schema.String,
 *       snippet: Schema.String
 *     }))
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface ProviderDefined<
  Name extends string,
  Config extends {
    readonly args: AnyStructSchema
    readonly parameters: AnyStructSchema
    readonly success: Schema.Top
    readonly failure: Schema.Top
    readonly failureMode: FailureMode
  },
  RequiresHandler extends boolean = false
> extends
  Tool<
    Name,
    {
      readonly parameters: Config["parameters"]
      readonly success: Config["success"]
      readonly failure: Config["failure"]
      readonly failureMode: Config["failureMode"]
    }
  >
{
  readonly [ProviderDefinedTypeId]: typeof ProviderDefinedTypeId

  /**
   * The arguments passed to the provider-defined tool.
   */
  readonly args: Config["args"]["Encoded"]

  /**
   * A `Schema` representing the arguments provided by the end-user which will
   * be used to configure the behavior of the provider-defined tool.
   */
  readonly argsSchema: Config["args"]

  /**
   * Name of the tool as recognized by the large language model provider.
   */
  readonly providerName: string

  /**
   * If set to `true`, this provider-defined tool will require a user-defined
   * tool call handler to be provided when converting the `Toolkit` containing
   * this tool into a `Layer`.
   */
  readonly requiresHandler: RequiresHandler
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a user-defined tool.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * const UserDefinedTool = Tool.make("Calculator", {
 *   description: "Performs basic arithmetic operations",
 *   parameters: {
 *     operation: Schema.Literal("add", "subtract", "multiply", "divide"),
 *     a: Schema.Number,
 *     b: Schema.Number
 *   },
 *   success: Schema.Number
 * })
 *
 * const ProviderDefinedTool = Tool.providerDefined({
 *   id: "openai.web_search",
 *   toolkitName: "WebSearch",
 *   providerName: "web_search",
 *   args: {
 *     query: Schema.String
 *   },
 *   success: Schema.Struct({
 *     results: Schema.Array(Schema.Struct({
 *       title: Schema.String,
 *       url: Schema.String,
 *       snippet: Schema.String
 *     }))
 *   })
 * })
 *
 * console.log(Tool.isUserDefined(UserDefinedTool))      // true
 * console.log(Tool.isUserDefined(ProviderDefinedTool))  // false
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isUserDefined = (u: unknown): u is Tool<string, any, any> =>
  Predicate.hasProperty(u, TypeId) && !isProviderDefined(u)

/**
 * Type guard to check if a value is a provider-defined tool.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * const UserDefinedTool = Tool.make("Calculator", {
 *   description: "Performs basic arithmetic operations",
 *   parameters: {
 *     operation: Schema.Literal("add", "subtract", "multiply", "divide"),
 *     a: Schema.Number,
 *     b: Schema.Number
 *   },
 *   success: Schema.Number
 * })
 *
 * const ProviderDefinedTool = Tool.providerDefined({
 *   id: "openai.web_search",
 *   toolkitName: "WebSearch",
 *   providerName: "web_search",
 *   args: {
 *     query: Schema.String
 *   },
 *   success: Schema.Struct({
 *     results: Schema.Array(Schema.Struct({
 *       title: Schema.String,
 *       url: Schema.String,
 *       snippet: Schema.String
 *     }))
 *   })
 * })
 *
 * console.log(Tool.isUserDefined(UserDefinedTool))      // false
 * console.log(Tool.isUserDefined(ProviderDefinedTool))  // true
 * ```
 *
 * @since 4.0.0
 * @category guards
 */
export const isProviderDefined = (
  u: unknown
): u is ProviderDefined<string, any> => Predicate.hasProperty(u, ProviderDefinedTypeId)

// =============================================================================
// utility types
// =============================================================================

/**
 * A type which represents any `Tool`.
 *
 * @since 4.0.0
 * @category utility types
 */
export interface Any extends
  Tool<any, {
    readonly parameters: AnyStructSchema
    readonly success: Schema.Top
    readonly failure: Schema.Top
    readonly failureMode: FailureMode
  }, any>
{}

/**
 * A type which represents any provider-defined `Tool`.
 *
 * @since 4.0.0
 * @category utility types
 */
export interface AnyProviderDefined extends
  ProviderDefined<any, {
    readonly args: AnyStructSchema
    readonly parameters: AnyStructSchema
    readonly success: Schema.Top
    readonly failure: Schema.Top
    readonly failureMode: FailureMode
  }, any>
{}

/**
 * @since 4.0.0
 * @category utility types
 */
export interface AnyStructSchema extends Schema.Top {
  readonly fields: Schema.Struct.Fields
}

/**
 * A utility type to extract the `Name` type from an `Tool`.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Name<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Name
  : never

/**
 * A utility type to extract the type of the tool call parameters.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Parameters<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? Schema.Struct.Type<_Config["parameters"]["fields"]>
  : never

/**
 * A utility type to extract the encoded type of the tool call parameters.
 *
 * @since 4.0.0
 * @category utility types
 */
export type ParametersEncoded<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["parameters"]["Encoded"]
  : never

/**
 * A utility type to extract the schema for the parameters which an `Tool`
 * must be called with.
 *
 * @since 4.0.0
 * @category utility types
 */
export type ParametersSchema<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["parameters"]
  : never

/**
 * A utility type to extract the type of the tool call result when it succeeds.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Success<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["success"]["Type"]
  : never

/**
 * A utility type to extract the encoded type of the tool call result when
 * it succeeds.
 *
 * @since 4.0.0
 * @category utility types
 */
export type SuccessEncoded<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["success"]["Encoded"]
  : never

/**
 * A utility type to extract the schema for the return type of a tool call when
 * the tool call succeeds.
 *
 * @since 4.0.0
 * @category utility types
 */
export type SuccessSchema<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["success"]
  : never

/**
 * A utility type to extract the type of the tool call result when it fails.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Failure<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["failure"]["Type"]
  : never

/**
 * A utility type to extract the encoded type of the tool call result when
 * it fails.
 *
 * @since 4.0.0
 * @category utility types
 */
export type FailureEncoded<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["failure"]["Encoded"]
  : never

/**
 * A utility type to extract the type of the tool call result whether it
 * succeeds or fails.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Result<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? Success<T> | Failure<T>
  : never

/**
 * A utility type to extract the encoded type of the tool call result whether
 * it succeeds or fails.
 *
 * @since 4.0.0
 * @category utility types
 */
export type ResultEncoded<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? SuccessEncoded<T> | FailureEncoded<T>
  : never

/**
 * A utility type to extract the requirements of a `Tool`.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Services<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? // Parameters must be decoded when received from a model
    | _Config["parameters"]["DecodingServices"]
    // A tool call `result`, whether success or failure, is encoded and returned
    // as the `encodedResult` along with the `result`
    | _Config["success"]["EncodingServices"]
    | _Config["failure"]["EncodingServices"]
    // Per-request requirements
    | _Requirements
  : never

/**
 * Represents an `Tool` that has been implemented within the application.
 *
 * @since 4.0.0
 * @category models
 */
export interface Handler<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
  readonly services: ServiceMap.ServiceMap<never>
  readonly handler: (params: any) => Effect.Effect<any, any>
}

/**
 * Represents the result of calling the handler for a particular `Tool`.
 *
 * @since 4.0.0
 * @category models
 */
export interface HandlerResult<Tool extends Any> {
  /**
   * Whether the result of executing the tool call handler was an error or not.
   */
  readonly isFailure: boolean
  /**
   * The result of executing the handler for a particular tool.
   */
  readonly result: Result<Tool>
  /**
   * The pre-encoded tool call result of executing the handler for a particular
   * tool as a JSON-serializable value. The encoded result can be incorporated
   * into subsequent requests to the large language model.
   */
  readonly encodedResult: unknown
}

/**
 * A utility type which represents the possible errors that can be raised by
 * a tool call's handler.
 *
 * @since 4.0.0
 * @category utility types
 */
export type HandlerError<T> = T extends Tool<
  infer _Name,
  infer _Config,
  infer _Requirements
> ? _Config["failureMode"] extends "error" ? _Config["failure"]["Type"]
  : never
  : never

/**
 * A utility type to create a union of `Handler` types for all tools in a
 * record.
 *
 * @since 4.0.0
 * @category utility types
 */
export type HandlersFor<Tools extends Record<string, Any>> = {
  [Name in keyof Tools]: RequiresHandler<Tools[Name]> extends true ? Handler<Tools[Name]["name"]>
    : never
}[keyof Tools]

/**
 * A utility type to determine if the specified tool requires a user-defined
 * handler to be implemented.
 *
 * @since 4.0.0
 * @category utility types
 */
export type RequiresHandler<Tool extends Any> = Tool extends ProviderDefined<
  infer _Name,
  infer _Config,
  infer _RequiresHandler
> ? _RequiresHandler
  : true

// =============================================================================
// Constructors
// =============================================================================

const Proto = {
  [TypeId]: { _Requirements: identity },
  pipe() {
    return pipeArguments(this, arguments)
  },
  addDependency(this: Any) {
    return userDefinedProto({ ...this })
  },
  setParameters(this: Any, parametersSchema: Schema.Struct<any> | Schema.Struct.Fields) {
    return userDefinedProto({
      ...this,
      parametersSchema: Schema.isSchema(parametersSchema)
        ? (parametersSchema as any)
        : Schema.Struct(parametersSchema as any)
    })
  },
  setSuccess(this: Any, successSchema: Schema.Top) {
    return userDefinedProto({ ...this, successSchema })
  },
  setFailure(this: Any, failureSchema: Schema.Top) {
    return userDefinedProto({ ...this, failureSchema })
  },
  annotate<I, S>(this: Any, tag: ServiceMap.Key<I, S>, value: S) {
    return userDefinedProto({
      ...this,
      annotations: ServiceMap.add(this.annotations, tag, value)
    })
  },
  annotateMerge<I>(this: Any, context: ServiceMap.ServiceMap<I>) {
    return userDefinedProto({
      ...this,
      annotations: ServiceMap.merge(this.annotations, context)
    })
  }
}

const ProviderDefinedProto = {
  ...Proto,
  [ProviderDefinedTypeId]: ProviderDefinedTypeId
}

const userDefinedProto = <
  const Name extends string,
  Parameters extends AnyStructSchema,
  Success extends Schema.Top,
  Failure extends Schema.Top,
  Mode extends FailureMode
>(options: {
  readonly name: Name
  readonly description?: string | undefined
  readonly parametersSchema: Parameters
  readonly successSchema: Success
  readonly failureSchema: Failure
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly failureMode: Mode
}): Tool<
  Name,
  {
    readonly parameters: Parameters
    readonly success: Success
    readonly failure: Failure
    readonly failureMode: Mode
  }
> => {
  const self = Object.assign(Object.create(Proto), options)
  self.id = `effect/ai/Tool/${options.name}`
  return self
}

const providerDefinedProto = <
  const Name extends string,
  Args extends AnyStructSchema,
  Parameters extends AnyStructSchema,
  Success extends Schema.Top,
  Failure extends Schema.Top,
  RequiresHandler extends boolean,
  Mode extends FailureMode
>(options: {
  readonly id: string
  readonly name: Name
  readonly providerName: string
  readonly args: Args["Encoded"]
  readonly argsSchema: Args
  readonly requiresHandler: RequiresHandler
  readonly parametersSchema: Parameters
  readonly successSchema: Success
  readonly failureSchema: Failure
  readonly failureMode: FailureMode
}): ProviderDefined<
  Name,
  {
    readonly args: Args
    readonly parameters: Parameters
    readonly success: Success
    readonly failure: Failure
    readonly failureMode: Mode
  },
  RequiresHandler
> => Object.assign(Object.create(ProviderDefinedProto), options)

const constEmptyStruct = Schema.Struct({})

/**
 * Creates a user-defined tool with the specified name and configuration.
 *
 * This is the primary constructor for creating custom tools that AI models
 * can call. The tool definition includes parameter validation, success/failure
 * schemas, and optional service dependencies.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * // Simple tool with no parameters
 * const GetCurrentTime = Tool.make("GetCurrentTime", {
 *   description: "Returns the current timestamp",
 *   success: Schema.Number
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make = <
  const Name extends string,
  Parameters extends Schema.Struct.Fields = {},
  Success extends Schema.Top = typeof Schema.Void,
  Failure extends Schema.Top = typeof Schema.Never,
  Mode extends FailureMode | undefined = undefined,
  Dependencies extends Array<ServiceMap.Key<any, any>> = []
>(name: Name, options?: {
  /**
   * An optional description explaining what the tool does.
   */
  readonly description?: string | undefined
  /**
   * Schema defining the parameters this tool accepts.
   */
  readonly parameters?: Parameters | undefined
  /**
   * Schema for successful tool execution results.
   */
  readonly success?: Success | undefined
  /**
   * Schema for tool execution failures.
   */
  readonly failure?: Failure | undefined
  /**
   * The strategy used for handling errors returned from tool call handler
   * execution.
   *
   * If set to `"error"` (the default), errors that occur during tool call handler
   * execution will be returned in the error channel of the calling effect.
   *
   * If set to `"return"`, errors that occur during tool call handler execution
   * will be captured and returned as part of the tool call result.
   */
  readonly failureMode?: Mode
  /**
   * Service dependencies required by the tool handler.
   */
  readonly dependencies?: Dependencies | undefined
}): Tool<
  Name,
  {
    readonly parameters: Schema.Struct<Parameters>
    readonly success: Success
    readonly failure: Failure
    readonly failureMode: Mode extends undefined ? "error" : Mode
  },
  ServiceMap.Key.Identifier<Dependencies[number]>
> => {
  const successSchema = options?.success ?? Schema.Void
  const failureSchema = options?.failure ?? Schema.Never
  return userDefinedProto({
    name,
    description: options?.description,
    parametersSchema: options?.parameters
      ? Schema.Struct(options?.parameters as any)
      : constEmptyStruct,
    successSchema,
    failureSchema,
    failureMode: options?.failureMode ?? "error",
    annotations: ServiceMap.empty()
  }) as any
}

/**
 * Creates a provider-defined tool which leverages functionality built into a
 * large language model provider (e.g. web search, code execution).
 *
 * These tools are executed by the large language model provider rather than
 * by your application. However, they can optionally require custom handlers
 * implemented in your application to process provider generated results.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * // Web search tool provided by OpenAI
 * const WebSearch = Tool.providerDefined({
 *   id: "openai.web_search",
 *   toolkitName: "WebSearch",
 *   providerName: "web_search",
 *   args: {
 *     query: Schema.String
 *   },
 *   success: Schema.Struct({
 *     results: Schema.Array(Schema.Struct({
 *       title: Schema.String,
 *       url: Schema.String,
 *       content: Schema.String
 *     }))
 *   })
 * })
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const providerDefined = <
  const Name extends string,
  Args extends Schema.Struct.Fields = {},
  Parameters extends Schema.Struct.Fields = {},
  Success extends Schema.Top = typeof Schema.Void,
  Failure extends Schema.Top = typeof Schema.Never,
  RequiresHandler extends boolean = false
>(options: {
  /**
   * Unique identifier following format `<provider>.<tool-name>`.
   */
  readonly id: `${string}.${string}`
  /**
   * Name used by the Toolkit to identify this tool.
   */
  readonly toolkitName: Name
  /**
   * Name of the tool as recognized by the AI provider.
   */
  readonly providerName: string
  /**
   * Schema for user-provided configuration arguments.
   */
  readonly args: Args
  /**
   * Whether this tool requires a custom handler implementation.
   */
  readonly requiresHandler?: RequiresHandler | undefined
  /**
   * Schema for parameters the provider sends when calling the tool.
   */
  readonly parameters?: Parameters | undefined
  /**
   * Schema for successful tool execution results.
   */
  readonly success?: Success | undefined
  /**
   * Schema for failed tool execution results.
   */
  readonly failure?: Failure | undefined
}) =>
<Mode extends FailureMode | undefined = undefined>(
  args: RequiresHandler extends true ? Struct.Simplify<
      Schema.Struct.Encoded<Args> & {
        /**
         * The strategy used for handling errors returned from tool call handler
         * execution.
         *
         * If set to `"error"` (the default), errors that occur during tool call handler
         * execution will be returned in the error channel of the calling effect.
         *
         * If set to `"return"`, errors that occur during tool call handler execution
         * will be captured and returned as part of the tool call result.
         */
        readonly failureMode?: Mode
      }
    >
    : Struct.Simplify<Schema.Struct.Encoded<Args>>
): ProviderDefined<
  Name,
  {
    readonly args: Schema.Struct<Args>
    readonly parameters: Schema.Struct<Parameters>
    readonly success: Success
    readonly failure: Failure
    readonly failureMode: Mode extends undefined ? "error" : Mode
  },
  RequiresHandler
> => {
  const failureMode = "failureMode" in args ? args.failureMode : undefined
  const successSchema = options?.success ?? Schema.Void
  const failureSchema = options?.failure ?? Schema.Never
  return providerDefinedProto({
    id: options.id,
    name: options.toolkitName,
    providerName: options.providerName,
    args,
    argsSchema: Schema.Struct(options.args as any),
    requiresHandler: options.requiresHandler ?? false,
    parametersSchema: options?.parameters
      ? Schema.Struct(options?.parameters as any)
      : constEmptyStruct,
    successSchema,
    failureSchema,
    failureMode: failureMode ?? "error"
  }) as any
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Extracts the description from a tool's metadata.
 *
 * Returns the tool's description if explicitly set, otherwise attempts to
 * extract it from the parameter schema's AST annotations.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const myTool = Tool.make("example", {
 *   description: "This is an example tool"
 * })
 *
 * const description = Tool.getDescription(myTool)
 * console.log(description) // "This is an example tool"
 * ```
 *
 * @since 4.0.0
 * @category utilities
 */
export const getDescription = <Tool extends Any>(tool: Tool): string | undefined =>
  tool.description ?? SchemaAnnotations.getDescription(tool.parametersSchema.ast)

/**
 * Generates a JSON Schema for a tool.
 *
 * This function creates a JSON Schema representation that can be used by
 * large language models to indicate the structure and type of the parameters
 * that a given tool call should receive.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Tool } from "effect/unstable/ai"
 *
 * const weatherTool = Tool.make("get_weather", {
 *   parameters: {
 *     location: Schema.String,
 *     units: Schema.optional(Schema.Literal("celsius", "fahrenheit"))
 *   }
 * })
 *
 * const jsonSchema = Tool.getJsonSchema(weatherTool)
 * console.log(jsonSchema)
 * // {
 * //   type: "object",
 * //   properties: {
 * //     location: { type: "string" },
 * //     units: { type: "string", enum: ["celsius", "fahrenheit"] }
 * //   },
 * //   required: ["location"]
 * // }
 * ```
 *
 * @since 4.0.0
 * @category utilities
 */
export const getJsonSchema = <Tool extends Any>(tool: Tool): JsonSchema.JsonSchema => {
  const schema = tool.parametersSchema
  const props = AST.isTypeLiteral(schema.ast) ? schema.ast.propertySignatures : []
  if (props.length === 0) {
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    }
  }
  const $defs = {}
  const jsonSchema = JsonSchema.makeDraft2020_12(schema, {
    definitions: $defs,
    topLevelReferenceStrategy: "skip"
  })
  delete jsonSchema.$schema
  if (Object.keys($defs).length === 0) return jsonSchema
  jsonSchema.$defs = $defs
  return jsonSchema
}

// =============================================================================
// Annotations
// =============================================================================

/**
 * Annotation for providing a human-readable title for tools.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const myTool = Tool.make("calculate_tip")
 *   .annotate(Tool.Title, "Tip Calculator")
 * ```
 *
 * @since 4.0.0
 * @category annotations
 */
export class Title extends ServiceMap.Key<Title, string>()("effect/ai/Tool/Title") {}

/**
 * Annotation indicating whether a tool only reads data without making changes.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const readOnlyTool = Tool.make("get_user_info")
 *   .annotate(Tool.Readonly, true)
 * ```
 *
 * @since 4.0.0
 * @category annotations
 */
export const Readonly = ServiceMap.Reference<boolean>("effect/ai/Tool/Readonly", {
  defaultValue: constFalse
})

/**
 * Annotation indicating whether a tool performs destructive operations.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const safeTool = Tool.make("search_database")
 *   .annotate(Tool.Destructive, false)
 * ```
 *
 * @since 4.0.0
 * @category annotations
 */
export const Destructive = ServiceMap.Reference<boolean>("effect/ai/Tool/Destructive", {
  defaultValue: constTrue
})

/**
 * Annotation indicating whether a tool can be called multiple times safely.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const idempotentTool = Tool.make("get_current_time")
 *   .annotate(Tool.Idempotent, true)
 * ```
 *
 * @since 4.0.0
 * @category annotations
 */
export const Idempotent = ServiceMap.Reference<boolean>("effect/ai/Tool/Idempotent", {
  defaultValue: constFalse
})

/**
 * Annotation indicating whether a tool can handle arbitrary external data.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 *
 * const restrictedTool = Tool.make("internal_operation")
 *   .annotate(Tool.OpenWorld, false)
 * ```
 *
 * @since 4.0.0
 * @category annotations
 */
export const OpenWorld = ServiceMap.Reference<boolean>("effect/ai/Tool/OpenWorld", {
  defaultValue: constTrue
})

// Licensed under BSD-3-Clause (below code only)
// Code adapted from https://github.com/fastify/secure-json-parse/blob/783fcb1b5434709466759847cec974381939673a/index.js
//
// Copyright (c) Effectful Technologies, Inc (https://effectful.co)
// Copyright (c) 2019 The Fastify Team
// Copyright (c) 2019, Sideway Inc, and project contributors
// All rights reserved.
//
// The complete list of contributors can be found at:
// - https://github.com/hapijs/bourne/graphs/contributors
// - https://github.com/fastify/secure-json-parse/graphs/contributors
// - https://github.com/Effect-TS/effect/commits/main/packages/ai/ai/src/Tool.ts
//
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

const suspectProtoRx = /"__proto__"\s*:/
const suspectConstructorRx = /"constructor"\s*:/

function _parse(text: string) {
  // Parse normally
  const obj = JSON.parse(text)

  // Ignore null and non-objects
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (
    suspectProtoRx.test(text) === false &&
    suspectConstructorRx.test(text) === false
  ) {
    return obj
  }

  // Scan result for proto keys
  return filter(obj)
}

function filter(obj: any) {
  let next = [obj]

  while (next.length) {
    const nodes = next
    next = []

    for (const node of nodes) {
      if (Object.prototype.hasOwnProperty.call(node, "__proto__")) {
        throw new SyntaxError("Object contains forbidden prototype property")
      }

      if (
        Object.prototype.hasOwnProperty.call(node, "constructor") &&
        Object.prototype.hasOwnProperty.call(node.constructor, "prototype")
      ) {
        throw new SyntaxError("Object contains forbidden prototype property")
      }

      for (const key in node) {
        const value = node[key]
        if (value && typeof value === "object") {
          next.push(value)
        }
      }
    }
  }
  return obj
}

/**
 * **Unsafe**: This function will throw an error if an insecure property is
 * found in the parsed JSON or if the provided JSON text is not parseable.
 *
 * @since 4.0.0
 * @category utilities
 */
export const unsafeSecureJsonParse = (text: string): unknown => {
  // Performance optimization, see https://github.com/fastify/secure-json-parse/pull/90
  const { stackTraceLimit } = Error
  Error.stackTraceLimit = 0
  try {
    return _parse(text)
  } finally {
    Error.stackTraceLimit = stackTraceLimit
  }
}
