/**
 * @since 4.0.0
 */
import * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import type { Inspectable } from "../../interfaces/Inspectable.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { PipeInspectableProto, YieldableProto } from "../../internal/core.ts"
import * as Layer from "../../Layer.ts"
import { Serializer } from "../../schema/index.ts"
import * as Schema from "../../schema/Schema.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import { AiError } from "./AiError.ts"
import type * as AiTool from "./AiTool.ts"

const TypeId = "~effect/ai/AiToolkit" as const

/**
 * An `AiToolkit` represents a set of tools that a large language model can
 * use to augment its response.
 *
 * @since 4.0.0
 * @category Models
 */
export interface AiToolkit<in out Tools extends AiTool.Any>
  extends Effect.Yieldable<AiToolkit<Tools>, ToHandler<Tools>, never, AiTool.ToHandler<Tools>>, Inspectable, Pipeable
{
  new(_: never): {}

  readonly [TypeId]: typeof TypeId

  /**
   * A map containing the tools that are part of this toolkit.
   */
  readonly tools: AiTool.ByName<Tools>

  /**
   * Converts this toolkit into a `Context` object containing the handlers for
   * all tools in the toolkit.
   */
  toHandlers<Handlers extends HandlersFrom<Tools>, EX = never, RX = never>(
    build: Handlers | Effect.Effect<Handlers, EX, RX>
  ): Effect.Effect<ServiceMap.ServiceMap<AiTool.ToHandler<Tools>>, EX, RX>

  /**
   * Converts this toolkit into a `Layer` containing the handlers for all tools
   * in the toolkit.
   */
  toLayer<Handlers extends HandlersFrom<Tools>, EX = never, RX = never>(
    build: Handlers | Effect.Effect<Handlers, EX, RX>
  ): Layer.Layer<AiTool.ToHandler<Tools>, EX, Exclude<RX, Scope.Scope>>

  of<Handlers extends HandlersFrom<Tools>>(handlers: Handlers): Handlers
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface Any {
  readonly [TypeId]: typeof TypeId
  readonly tools: Record<string, AiTool.Any>
}

/**
 * Represents an `AiToolkit` which has been augmented with a handler function
 * for resolving tool call requests.
 *
 * @since 4.0.0
 * @category Models
 */
export interface ToHandler<in out Tool extends AiTool.Any> {
  readonly tools: ReadonlyArray<Tool>
  readonly handle: (toolName: AiTool.Name<Tool>, toolParams: AiTool.Parameters<Tool>) => AiTool.HandlerEffect<Tool>
}

/**
 * A utility mapped type which associates tool names with their handlers.
 *
 * @since 4.0.0
 * @category Utility Types
 */
export type HandlersFrom<Tools extends AiTool.Any> = {
  [Tool in Tools as Tool["name"]]: (params: AiTool.Parameters<Tool>) => AiTool.HandlerEffect<Tool>
}

/**
 * A utility type which returns the tools in an `AiToolkit`.
 *
 * @since 4.0.0
 * @category Utility Types
 */
export type Tools<Toolkit> = Toolkit extends AiToolkit<infer Tool> ? string extends Tool["name"] ? never : Tool : never

const Proto = {
  ...YieldableProto,
  ...PipeInspectableProto,
  [TypeId]: TypeId,
  toHandlers(this: AiToolkit<any>, build: Effect.Effect<Record<string, (params: any) => any>>) {
    return Effect.gen(this, function*() {
      const services = yield* Effect.services<never>()
      const handlers = Effect.isEffect(build) ? yield* build : build
      const contextMap = new Map<string, unknown>()
      for (const [name, handler] of Object.entries(handlers)) {
        const tool = this.tools[name]!
        contextMap.set(tool.key, {
          name,
          handler,
          services
        })
      }
      return ServiceMap.makeUnsafe(contextMap)
    })
  },
  toLayer(this: AiToolkit<any>, build: Effect.Effect<Record<string, (params: any) => any>>) {
    return Layer.effectServices(this.toHandlers(build))
  },
  of: identity,
  asEffect(this: AiToolkit<AiTool.Any>) {
    return Effect.gen(this, function*() {
      const services = yield* Effect.services<never>()
      const tools = this.tools
      const schemasCache = new WeakMap<any, {
        readonly services: ServiceMap.ServiceMap<never>
        readonly handler: (params: any) => Effect.Effect<any, any>
        readonly encodeSuccess: (u: unknown) => Effect.Effect<unknown, Schema.SchemaError>
        readonly decodeFailure: (u: unknown) => Effect.Effect<AiTool.Failure<any>, Schema.SchemaError>
        readonly decodeParameters: (u: unknown) => Effect.Effect<AiTool.Parameters<any>, Schema.SchemaError>
      }>()
      const getSchemas = (tool: AiTool.Any) => {
        let schemas = schemasCache.get(tool)
        if (Predicate.isUndefined(schemas)) {
          const handler = services.mapUnsafe.get(tool.key)! as AiTool.Handler<any>
          const encodeSuccess = Schema.encodeUnknownEffect(Serializer.json(tool.successSchema)) as any
          const decodeFailure = Schema.decodeUnknownEffect(Serializer.json(tool.failureSchema)) as any
          const decodeParameters = Schema.decodeUnknownEffect(Serializer.json(tool.parametersSchema)) as any
          schemas = {
            services: handler.services,
            handler: handler.handler,
            encodeSuccess,
            decodeFailure,
            decodeParameters
          }
          schemasCache.set(tool, schemas)
        }
        return schemas
      }
      const handle = Effect.fnUntraced(
        function*(toolName: string, toolParams: unknown) {
          yield* Effect.annotateCurrentSpan({
            tool: toolName,
            parameters: toolParams
          })
          const tool = tools[toolName]!
          const schemas = getSchemas(tool)
          const decodedParams = yield* Effect.mapError(
            schemas.decodeParameters(toolParams),
            (cause) =>
              new AiError({
                module: "AiToolkit",
                method: `${toolName}.handle`,
                description: `Failed to decode tool call parameters for tool '${toolName}' from '${toolParams}'`,
                cause
              })
          )
          const result = yield* schemas.handler(decodedParams).pipe(
            Effect.updateServices((input) => ServiceMap.merge(schemas.services, input)),
            Effect.catch((error) => {
              if (AiError.is(error)) {
                return Effect.fail(error)
              }
              return schemas.decodeFailure(error).pipe(
                Effect.mapError((cause) =>
                  new AiError({
                    module: "AiToolkit",
                    method: `${toolName}.handle`,
                    description: `Failed to decode tool call failure for tool '${toolName}'`,
                    cause
                  })
                ),
                Effect.flatMap(Effect.fail)
              )
            })
          )
          const encodedResult = yield* Effect.mapError(
            schemas.encodeSuccess(result),
            (cause) =>
              new AiError({
                module: "AiToolkit",
                method: `${toolName}.handle`,
                description: `Failed to encode tool call result for tool '${toolName}'`,
                cause
              })
          )
          return {
            result,
            encodedResult
          } satisfies AiTool.HandlerResult<any>
        }
      )
      return {
        tools: Array.from(Object.values(tools)),
        handle
      }
    })
  },
  toJSON(this: AiToolkit<any>): unknown {
    return {
      _id: "@effect/ai/AiToolkit",
      tools: Array.from(Object.values(this.tools)).map((tool) => tool.name)
    }
  }
}

const makeProto = <Tools extends AiTool.Any>(tools: Record<string, Tools>): AiToolkit<Tools> =>
  Object.assign(function() {}, Proto, { tools }) as any

/**
 * Constructs a new `AiToolkit` from the specified tools.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <const Tools extends ReadonlyArray<AiTool.Any>>(
  ...tools: Tools
): AiToolkit<Tools[number]> => makeProto(Object.fromEntries(tools.map((tool) => [tool.name, tool])))

/**
 * Merges this toolkit with one or more other toolkits.
 *
 * @since 4.0.0
 * @category Merging
 */
export const merge = <const Toolkits extends ReadonlyArray<Any>>(
  ...toolkits: Toolkits
): AiToolkit<Tools<Toolkits[number]>> => {
  const tools = {} as Record<string, any>
  for (const toolkit of toolkits) {
    for (const [name, tool] of Object.entries(toolkit.tools)) {
      tools[name] = tool
    }
  }
  return makeProto(tools) as any
}
