/**
 * The `Toolkit` module allows for creating and implementing a collection of
 * `Tool`s which can be used to enhance the capabilities of a large language
 * model beyond simple text generation.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 * import { Toolkit, Tool } from "effect/unstable/ai"
 *
 * // Create individual tools
 * const GetCurrentTime = Tool.make("GetCurrentTime", {
 *   description: "Get the current timestamp",
 *   success: Schema.Number
 * })
 *
 * const GetWeather = Tool.make("GetWeather", {
 *   description: "Get weather for a location",
 *   parameters: { location: Schema.String },
 *   success: Schema.Struct({
 *     temperature: Schema.Number,
 *     condition: Schema.String
 *   })
 * })
 *
 * // Create a toolkit with multiple tools
 * const MyToolkit = Toolkit.make(GetCurrentTime, GetWeather)
 *
 * const MyToolkitLayer = MyToolkit.toLayer({
 *   GetCurrentTime: () => Effect.succeed(Date.now()),
 *   GetWeather: ({ location }) => Effect.succeed({
 *     temperature: 72,
 *     condition: "sunny"
 *   })
 * })
 * ```
 *
 * @since 1.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import type { Inspectable } from "../../interfaces/Inspectable.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.ts"
import * as Layer from "../../Layer.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as AiError from "./AiError.ts"
import type * as Tool from "./Tool.ts"

const TypeId = "~effect/ai/Toolkit" as const

/**
 * Represents a collection of tools which can be used to enhance the
 * capabilities of a large language model.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Schema } from "effect/schema"
 * import { Toolkit, Tool } from "effect/unstable/ai"
 *
 * // Create individual tools
 * const GetCurrentTime = Tool.make("GetCurrentTime", {
 *   description: "Get the current timestamp",
 *   success: Schema.Number
 * })
 *
 * const GetWeather = Tool.make("GetWeather", {
 *   description: "Get weather for a location",
 *   parameters: { location: Schema.String },
 *   success: Schema.Struct({
 *     temperature: Schema.Number,
 *     condition: Schema.String
 *   })
 * })
 *
 * // Create a toolkit with multiple tools
 * const MyToolkit = Toolkit.make(GetCurrentTime, GetWeather)
 *
 * const MyToolkitLayer = MyToolkit.toLayer({
 *   GetCurrentTime: () => Effect.succeed(Date.now()),
 *   GetWeather: ({ location }) => Effect.succeed({
 *     temperature: 72,
 *     condition: "sunny"
 *   })
 * })
 * ```
 *
 * @since 1.0.0
 * @category models
 */
export interface Toolkit<in out Tools extends Record<string, Tool.Any>> extends
  Effect.Yieldable<
    Toolkit<Tools>,
    WithHandler<Tools>,
    never,
    Tool.HandlersFor<Tools>
  >,
  Inspectable,
  Pipeable
{
  new(_: never): {}

  readonly [TypeId]: typeof TypeId

  /**
   * A record containing all tools in this toolkit.
   */
  readonly tools: Tools

  /**
   * A helper method which can be used for type-safe handler declarations.
   */
  of<Handlers extends HandlersFrom<Tools>>(handlers: Handlers): Handlers

  /**
   * Converts a toolkit into a `ServiceMap` containing handlers for each tool
   * in the toolkit.
   */
  toHandlers<Handlers extends HandlersFrom<Tools>, EX = never, RX = never>(
    build: Handlers | Effect.Effect<Handlers, EX, RX>
  ): Effect.Effect<ServiceMap.ServiceMap<Tool.HandlersFor<Tools>>, EX, RX>

  /**
   * Converts a toolkit into a `Layer` containing handlers for each tool in the
   * toolkit.
   */
  toLayer<Handlers extends HandlersFrom<Tools>, EX = never, RX = never>(
    /**
     * Handler functions or Effect that produces handlers.
     */
    build: Handlers | Effect.Effect<Handlers, EX, RX>
  ): Layer.Layer<Tool.HandlersFor<Tools>, EX, Exclude<RX, Scope.Scope>>
}

/**
 * A utility type which structurally represents any toolkit instance.
 *
 * @since 1.0.0
 * @category utility types
 */
export interface Any {
  readonly [TypeId]: typeof TypeId
  readonly tools: Record<string, Tool.Any>
}

/**
 * A utility type which can be used to extract the tool definitions from a
 * toolkit.
 *
 * @since 1.0.0
 * @category utility types
 */
export type Tools<T> = T extends Toolkit<infer Tools> ? Tools : never

/**
 * A utility type which can transforms either a record or an array of tools into
 * a record where keys are tool names and values are the tool instances.
 *
 * @since 1.0.0
 * @category utility types
 */
export type ToolsByName<Tools> = Tools extends Record<string, Tool.Any> ?
  { readonly [Name in keyof Tools]: Tools[Name] }
  : Tools extends ReadonlyArray<Tool.Any> ? { readonly [Tool in Tools[number] as Tool["name"]]: Tool }
  : never

/**
 * A utility type that maps tool names to their required handler functions.
 *
 * @since 1.0.0
 * @category utility types
 */
export type HandlersFrom<Tools extends Record<string, Tool.Any>> = {
  readonly [Name in keyof Tools as Tool.RequiresHandler<Tools[Name]> extends true ? Name : never]: (
    params: Tool.Parameters<Tools[Name]>
  ) => Effect.Effect<
    Tool.Success<Tools[Name]>,
    Tool.Failure<Tools[Name]>,
    Tool.HandlerServices<Tools[Name]>
  >
}

/**
 * A toolkit instance with registered handlers ready for tool execution.
 *
 * @since 1.0.0
 * @category models
 */
export interface WithHandler<in out Tools extends Record<string, Tool.Any>> {
  /**
   * The tools available in this toolkit instance.
   */
  readonly tools: Tools

  /**
   * Handler function for executing tool calls.
   *
   * Receives a tool name and parameters, validates the input, executes the
   * corresponding handler, and returns both the typed result and encoded result.
   */
  readonly handle: <Name extends keyof Tools>(
    /**
     * The name of the tool to execute.
     */
    name: Name,
    /**
     * Parameters to pass to the tool handler.
     */
    params: Tool.Parameters<Tools[Name]>
  ) => Effect.Effect<
    Tool.HandlerResult<Tools[Name]>,
    Tool.HandlerError<Tools[Name]>,
    Tool.HandlerServices<Tools[Name]>
  >
}

/**
 * A utility type which can be used to extract the tools from a toolkit with
 * handlers.
 *
 * @since 1.0.0
 * @category Utility Types
 */
export type WithHandlerTools<T> = T extends WithHandler<infer Tools> ? Tools : never

const Proto = {
  ...YieldableProto,
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  of: identity,
  toHandlers(
    this: Toolkit<Record<string, Tool.Any>>,
    build: Record<string, (params: any) => any> | Effect.Effect<Record<string, (params: any) => any>>
  ) {
    return Effect.gen(this, function*() {
      const services = yield* Effect.services<never>()
      const handlers = Effect.isEffect(build) ? yield* build : build
      const serviceMap = new Map<string, unknown>()
      for (const [name, handler] of Object.entries(handlers)) {
        const tool = this.tools[name]!
        serviceMap.set(tool.id, { name, handler, services })
      }
      return ServiceMap.makeUnsafe(serviceMap)
    })
  },
  toLayer(
    this: Toolkit<Record<string, Tool.Any>>,
    build: Record<string, (params: any) => any> | Effect.Effect<Record<string, (params: any) => any>>
  ) {
    return Layer.effectServices(this.toHandlers(build))
  },
  asEffect(this: Toolkit<Record<string, Tool.Any>>) {
    return Effect.gen(this, function*() {
      const tools = this.tools
      const services = yield* Effect.services<never>()
      const schemasCache = new WeakMap<any, {
        readonly services: ServiceMap.ServiceMap<never>
        readonly handler: (params: any) => Effect.Effect<any, any>
        readonly decodeParameters: (u: unknown) => Effect.Effect<Tool.Parameters<any>, Schema.SchemaError>
        readonly decodeResult: (u: unknown) => Effect.Effect<unknown, Schema.SchemaError>
        readonly encodeResult: (u: unknown) => Effect.Effect<unknown, Schema.SchemaError>
      }>()
      const getSchemas = (tool: Tool.Any) => {
        let schemas = schemasCache.get(tool)
        if (Predicate.isUndefined(schemas)) {
          const handler = services.mapUnsafe.get(tool.id)! as Tool.Handler<any>
          const decodeParameters = Schema.decodeUnknownEffect(tool.parametersSchema) as any
          const resultSchema = Schema.Union([tool.successSchema, tool.failureSchema])
          const decodeResult = Schema.decodeUnknownEffect(Schema.typeCodec(resultSchema)) as any
          const encodeResult = Schema.encodeUnknownEffect(resultSchema) as any
          schemas = {
            services: handler.services,
            handler: handler.handler,
            decodeParameters,
            decodeResult,
            encodeResult
          }
          schemasCache.set(tool, schemas)
        }
        return schemas
      }
      const handle = Effect.fnUntraced(function*(name: string, params: unknown) {
        yield* Effect.annotateCurrentSpan({ tool: name, parameters: params })
        const tool = tools[name]
        if (Predicate.isUndefined(tool)) {
          const toolNames = Object.keys(tools).join(",")
          return yield* new AiError.MalformedOutput({
            module: "Toolkit",
            method: `${name}.handle`,
            description: `Failed to find tool with name '${name}' in toolkit - available tools: ${toolNames}`
          })
        }
        const schemas = getSchemas(tool)
        const decodedParams = yield* Effect.mapError(
          schemas.decodeParameters(params),
          (cause) =>
            new AiError.MalformedOutput({
              module: "Toolkit",
              method: `${name}.handle`,
              description: `Failed to decode tool call parameters for tool '${name}' from:\n'${
                JSON.stringify(params, undefined, 2)
              }'`,
              cause
            })
        )
        const { isFailure, result } = yield* schemas.handler(decodedParams).pipe(
          Effect.map((result) => ({ result, isFailure: false })),
          Effect.catch((error) => {
            // AiErrors are always failures
            if (AiError.isAiError(error)) {
              return Effect.fail(error)
            }
            // If the tool handler failed, check the tool's failure mode to
            // determine how the result should be returned to the end user
            return tool.failureMode === "error"
              ? Effect.fail(error)
              : Effect.succeed({ result: error, isFailure: true })
          }),
          Effect.updateServices((input) => ServiceMap.merge(schemas.services, input)),
          Effect.mapError((cause) =>
            cause instanceof Schema.SchemaError
              ? new AiError.MalformedInput({
                module: "Toolkit",
                method: `${name}.handle`,
                description: `Failed to validate tool call result for tool '${name}'`,
                cause
              })
              : cause
          )
        )
        const encodedResult = yield* Effect.mapError(
          schemas.encodeResult(result),
          (cause) =>
            new AiError.MalformedInput({
              module: "Toolkit",
              method: `${name}.handle`,
              description: `Failed to encode tool call result for tool '${name}'`,
              cause
            })
        )
        return {
          isFailure,
          result,
          encodedResult
        } satisfies Tool.HandlerResult<any>
      })
      return {
        tools,
        handle: handle as any
      } satisfies WithHandler<Record<string, any>>
    })
  },
  toJSON(this: Toolkit<any>): unknown {
    return {
      _id: "effect/ai/Toolkit",
      tools: Array.from(Object.values(this.tools)).map((tool) => (tool as Tool.Any).name)
    }
  }
}

const makeProto = <Tools extends Record<string, Tool.Any>>(tools: Tools): Toolkit<Tools> =>
  Object.assign(function() {}, Proto, { tools }) as any

const resolveInput = <Tools extends ReadonlyArray<Tool.Any>>(
  ...tools: Tools
): Record<string, Tools[number]> => {
  const output = {} as Record<string, Tools[number]>
  for (const tool of tools) {
    output[tool.name] = tool
  }
  return output
}

/**
 * An empty toolkit with no tools.
 *
 * Useful as a starting point for building toolkits or as a default value. Can
 * be extended using the merge function to add tools.
 *
 * @since 1.0.0
 * @category Constructors
 */
export const empty: Toolkit<{}> = makeProto({})

/**
 * Creates a new toolkit from the specified tools.
 *
 * This is the primary constructor for creating toolkits. It accepts multiple tools
 * and organizes them into a toolkit that can be provided to AI language models.
 * Tools can be either Tool instances or TaggedRequest schemas.
 *
 * @example
 * ```ts
 * import { Schema } from "effect/schema"
 * import { Toolkit, Tool } from "effect/unstable/ai"
 *
 * const GetCurrentTime = Tool.make("GetCurrentTime", {
 *   description: "Get the current timestamp",
 *   success: Schema.Number
 * })
 *
 * const GetWeather = Tool.make("get_weather", {
 *   description: "Get weather information",
 *   parameters: { location: Schema.String },
 *   success: Schema.Struct({
 *     temperature: Schema.Number,
 *     condition: Schema.String
 *   })
 * })
 *
 * const toolkit = Toolkit.make(GetCurrentTime, GetWeather)
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = <Tools extends ReadonlyArray<Tool.Any>>(
  ...tools: Tools
): Toolkit<ToolsByName<Tools>> => makeProto(resolveInput(...tools)) as any

/**
 * A utility type which simplifies a record type.
 *
 * @since 1.0.0
 * @category utility types
 */
export type SimplifyRecord<T> = { [K in keyof T]: T[K] } & {}

/**
 * A utility type which merges two records of tools together.
 *
 * @since 1.0.0
 * @category utility types
 */
export type MergeRecords<U> = {
  readonly [K in Extract<U extends unknown ? keyof U : never, string>]: Extract<
    U extends Record<K, infer V> ? V : never,
    Tool.Any
  >
}

/**
 * A utility type which merges the tool calls of two toolkits into a single
 * toolkit.
 *
 * @since 1.0.0
 * @category utility types
 */
export type MergedTools<Toolkits extends ReadonlyArray<Any>> = SimplifyRecord<
  MergeRecords<Tools<Toolkits[number]>>
>

/**
 * Merges multiple toolkits into a single toolkit.
 *
 * Combines all tools from the provided toolkits into one unified toolkit.
 * If there are naming conflicts, tools from later toolkits will override
 * tools from earlier ones.
 *
 * @example
 * ```ts
 * import { Toolkit, Tool } from "effect/unstable/ai"
 *
 * const mathToolkit = Toolkit.make(
 *   Tool.make("add"),
 *   Tool.make("subtract")
 * )
 *
 * const utilityToolkit = Toolkit.make(
 *   Tool.make("get_time"),
 *   Tool.make("get_weather")
 * )
 *
 * const combined = Toolkit.merge(mathToolkit, utilityToolkit)
 * // combined now has: add, subtract, get_time, get_weather
 * ```
 *
 * @example
 * ```ts
 * import { Toolkit, Tool } from "effect/unstable/ai"
 *
 * // Incremental toolkit building
 * const baseToolkit = Toolkit.make(Tool.make("base_tool"))
 * const extendedToolkit = Toolkit.merge(
 *   baseToolkit,
 *   Toolkit.make(Tool.make("additional_tool")),
 *   Toolkit.make(Tool.make("another_tool"))
 * )
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export const merge = <const Toolkits extends ReadonlyArray<Any>>(
  /**
   * The toolkits to merge together.
   */
  ...toolkits: Toolkits
): Toolkit<MergedTools<Toolkits>> => {
  const tools = {} as Record<string, any>
  for (const toolkit of toolkits) {
    for (const [name, tool] of Object.entries(toolkit.tools)) {
      tools[name] = tool
    }
  }
  return makeProto(tools) as any
}
