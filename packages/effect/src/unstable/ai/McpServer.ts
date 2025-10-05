/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Arr from "../../collections/Array.ts"
import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import * as RcMap from "../../RcMap.ts"
import * as SchemaAnnotations from "../../schema/Annotations.ts"
import * as AST from "../../schema/AST.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.ts"
import * as JsonSchema from "../../schema/ToJsonSchema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Sink } from "../../stream/Sink.ts"
import type { Stream } from "../../stream/Stream.ts"
import type * as Types from "../../types/Types.ts"
import * as FindMyWay from "../http/FindMyWay.ts"
import * as Headers from "../http/Headers.ts"
import type * as HttpRouter from "../http/HttpRouter.ts"
import type * as Rpc from "../rpc/Rpc.ts"
import * as RpcClient from "../rpc/RpcClient.ts"
import type * as RpcGroup from "../rpc/RpcGroup.ts"
import * as RpcMessage from "../rpc/RpcMessage.ts"
import * as RpcSerialization from "../rpc/RpcSerialization.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import * as AiTool from "./AiTool.ts"
import type * as AiToolkit from "./AiToolkit.ts"
import {
  CallToolResult,
  ClientNotificationRpcs,
  ClientRpcs,
  CompleteResult,
  Elicit,
  ElicitationDeclined,
  GetPromptResult,
  InternalError,
  InvalidParams,
  isParam,
  ListPromptsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ListToolsResult,
  McpServerClient,
  McpServerClientMiddleware,
  Prompt,
  Resource,
  ResourceTemplate,
  ServerNotificationRpcs,
  ServerRequestRpcs,
  TextContent,
  Tool
} from "./McpSchema.ts"
import type {
  Annotations,
  CallTool,
  Complete,
  GetPrompt,
  Param,
  PromptArgument,
  PromptMessage,
  ReadResourceResult,
  ServerCapabilities
} from "./McpSchema.ts"

/**
 * @since 4.0.0
 * @category McpServer
 */
export class McpServer extends ServiceMap.Key<
  McpServer,
  {
    readonly notifications: RpcClient.RpcClient<RpcGroup.Rpcs<typeof ServerNotificationRpcs>>
    readonly notificationsQueue: Queue.Dequeue<RpcMessage.Request<any>>
    readonly initializedClients: Set<number>

    readonly tools: ReadonlyArray<Tool>
    readonly addTool: (options: {
      readonly tool: Tool
      readonly handle: (payload: any) => Effect.Effect<CallToolResult, never, McpServerClient>
    }) => Effect.Effect<void>
    readonly callTool: (
      requests: typeof CallTool.payloadSchema.Type
    ) => Effect.Effect<CallToolResult, InternalError | InvalidParams, McpServerClient>

    readonly resources: ReadonlyArray<Resource>
    readonly addResource: (
      resource: Resource,
      handle: Effect.Effect<typeof ReadResourceResult.Type, InternalError, McpServerClient>
    ) => Effect.Effect<void>

    readonly resourceTemplates: ReadonlyArray<ResourceTemplate>
    readonly addResourceTemplate: (
      options: {
        readonly template: ResourceTemplate
        readonly routerPath: string
        readonly completions: Record<string, (input: string) => Effect.Effect<CompleteResult, InternalError>>
        readonly handle: (
          uri: string,
          params: Array<string>
        ) => Effect.Effect<typeof ReadResourceResult.Type, InvalidParams | InternalError, McpServerClient>
      }
    ) => Effect.Effect<void>

    readonly findResource: (
      uri: string
    ) => Effect.Effect<typeof ReadResourceResult.Type, InvalidParams | InternalError, McpServerClient>

    readonly prompts: ReadonlyArray<Prompt>
    readonly addPrompt: (options: {
      readonly prompt: Prompt
      readonly completions: Record<
        string,
        (input: string) => Effect.Effect<CompleteResult, InternalError, McpServerClient>
      >
      readonly handle: (
        params: Record<string, string>
      ) => Effect.Effect<GetPromptResult, InternalError | InvalidParams, McpServerClient>
    }) => Effect.Effect<void>
    readonly getPromptResult: (
      request: typeof GetPrompt.payloadSchema.Type
    ) => Effect.Effect<GetPromptResult, InternalError | InvalidParams, McpServerClient>

    readonly completion: (
      complete: typeof Complete.payloadSchema.Type
    ) => Effect.Effect<CompleteResult, InternalError, McpServerClient>
  }
>()("effect/ai/McpServer") {
  /**
   * @since 4.0.0
   */
  static readonly make = Effect.gen(function*() {
    const matcher = makeUriMatcher<
      {
        readonly _tag: "ResourceTemplate"
        readonly handle: (
          uri: string,
          params: Array<string>
        ) => Effect.Effect<typeof ReadResourceResult.Type, InternalError | InvalidParams, McpServerClient>
      } | {
        readonly _tag: "Resource"
        readonly effect: Effect.Effect<typeof ReadResourceResult.Type, InternalError, McpServerClient>
      }
    >()
    const tools = Arr.empty<Tool>()
    const toolMap = new Map<string, (payload: any) => Effect.Effect<CallToolResult, InternalError, McpServerClient>>()
    const resources: Array<Resource> = []
    const resourceTemplates: Array<ResourceTemplate> = []
    const prompts: Array<Prompt> = []
    const promptMap = new Map<
      string,
      (params: Record<string, string>) => Effect.Effect<GetPromptResult, InternalError | InvalidParams, McpServerClient>
    >()
    const completionsMap = new Map<
      string,
      (input: string) => Effect.Effect<CompleteResult, InternalError, McpServerClient>
    >()
    const notificationsQueue = yield* Queue.make<RpcMessage.Request<any>>()
    const listChangedHandles = new Map<string, any>()
    const notifications = yield* RpcClient.makeNoSerialization(ServerNotificationRpcs, {
      spanPrefix: "McpServer/Notifications",
      onFromClient: (options) =>
        Effect.suspend((): Effect.Effect<void> => {
          const message = options.message
          if (message._tag !== "Request") {
            return Effect.void
          }
          if (message.tag.includes("list_changed")) {
            if (!listChangedHandles.has(message.tag)) {
              listChangedHandles.set(
                message.tag,
                setTimeout(() => {
                  Queue.offerUnsafe(notificationsQueue, message)
                  listChangedHandles.delete(message.tag)
                }, 0)
              )
            }
          } else {
            Queue.offerUnsafe(notificationsQueue, message)
          }
          return notifications.write({
            clientId: 0,
            requestId: message.id,
            _tag: "Exit",
            exit: Exit.void as any
          })
        })
    })

    return McpServer.of({
      notifications: notifications.client,
      notificationsQueue,
      initializedClients: new Set<number>(),
      get tools() {
        return tools
      },
      addTool: (options) =>
        Effect.suspend(() => {
          tools.push(options.tool)
          toolMap.set(options.tool.name, options.handle)
          return notifications.client["notifications/tools/list_changed"]({})
        }),
      callTool: (request) =>
        Effect.suspend((): Effect.Effect<CallToolResult, InternalError | InvalidParams, McpServerClient> => {
          const handle = toolMap.get(request.name)
          if (!handle) {
            return Effect.fail(new InvalidParams({ message: `Tool '${request.name}' not found` }))
          }
          return handle(request.arguments)
        }),
      get resources() {
        return resources
      },
      get resourceTemplates() {
        return resourceTemplates
      },
      addResource: (resource, effect) =>
        Effect.suspend(() => {
          resources.push(resource)
          matcher.add(resource.uri, { _tag: "Resource", effect })
          return notifications.client["notifications/resources/list_changed"]({})
        }),
      addResourceTemplate: ({ completions, handle, routerPath, template }) =>
        Effect.suspend(() => {
          resourceTemplates.push(template)
          matcher.add(routerPath, { _tag: "ResourceTemplate", handle })
          for (const [param, handle] of Object.entries(completions)) {
            completionsMap.set(`ref/resource/${template.uriTemplate}/${param}`, handle)
          }
          return notifications.client["notifications/resources/list_changed"]({})
        }),
      findResource: (uri) =>
        Effect.suspend(() => {
          const match = matcher.find(uri)
          if (!match) {
            return Effect.succeed({ contents: [] })
          } else if (match.handler._tag === "Resource") {
            return match.handler.effect
          }
          const params: Array<string> = []
          for (const key of Object.keys(match.params)) {
            params[Number(key)] = match.params[key]!
          }
          return match.handler.handle(uri, params)
        }),
      get prompts() {
        return prompts
      },
      addPrompt: (options) =>
        Effect.suspend(() => {
          prompts.push(options.prompt)
          promptMap.set(options.prompt.name, options.handle)
          for (const [param, handle] of Object.entries(options.completions)) {
            completionsMap.set(`ref/prompt/${options.prompt.name}/${param}`, handle)
          }
          return notifications.client["notifications/prompts/list_changed"]({})
        }),
      getPromptResult: Effect.fnUntraced(function*({ arguments: params, name }) {
        const handler = promptMap.get(name)
        if (!handler) {
          return yield* new InvalidParams({ message: `Prompt '${name}' not found` })
        }
        return yield* handler(params ?? {})
      }),
      completion: Effect.fnUntraced(function*(complete) {
        const ref = complete.ref
        const key = ref.type === "ref/resource"
          ? `ref/resource/${ref.uri}/${complete.argument.name}`
          : `ref/prompt/${ref.name}/${complete.argument.name}`
        const handler = completionsMap.get(key)
        return handler ? yield* handler(complete.argument.value) : CompleteResult.empty
      })
    })
  })

  /**
   * @since 4.0.0
   */
  static readonly layer: Layer.Layer<McpServer | McpServerClient> = Layer.effect(McpServer)(McpServer.make) as any
}

const LATEST_PROTOCOL_VERSION = "2025-06-18"
const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2025-03-26",
  "2024-11-05",
  "2024-10-07"
]

/**
 * @since 4.0.0
 * @category Constructors
 */
export const run: (
  options: { readonly name: string; readonly version: string }
) => Effect.Effect<
  never,
  never,
  McpServer | RpcServer.Protocol
> = Effect.fnUntraced(function*(options: {
  readonly name: string
  readonly version: string
}) {
  const protocol = yield* RpcServer.Protocol
  const handlers = yield* Layer.build(layerHandlers(options))
  const server = yield* McpServer

  const clients = yield* RcMap.make({
    lookup: Effect.fnUntraced(function*(clientId: number) {
      let write!: (message: RpcMessage.FromServerEncoded) => Effect.Effect<void>
      const client = yield* RpcClient.make(ServerRequestRpcs, {
        spanPrefix: "McpServer/Client"
      }).pipe(
        Effect.provideServiceEffect(
          RpcClient.Protocol,
          RpcClient.Protocol.make(Effect.fnUntraced(function*(writeResponse) {
            write = writeResponse
            return {
              send(request, _transferables) {
                return protocol.send(clientId, {
                  ...request,
                  headers: undefined,
                  traceId: undefined,
                  spanId: undefined,
                  sampled: undefined
                } as any)
              },
              supportsAck: true,
              supportsTransferables: false,
              supportsStructuredClone: false
            }
          }))
        )
      )

      return { client, write } as const
    }),
    idleTimeToLive: 10000
  })

  const clientMiddleware = McpServerClientMiddleware.of((effect, { clientId }) =>
    Effect.provideService(
      effect,
      McpServerClient,
      McpServerClient.of({
        clientId,
        getClient: RcMap.get(clients, clientId).pipe(
          Effect.map(({ client }) => client)
        )
      })
    )
  )

  const patchedProtocol = RpcServer.Protocol.of({
    ...protocol,
    run: (f) =>
      protocol.run((clientId, request_) => {
        const request = request_ as any as
          | RpcMessage.FromServerEncoded
          | RpcMessage.FromClientEncoded
        switch (request._tag) {
          case "Request": {
            const rpc = ClientNotificationRpcs.requests.get(request.tag)
            if (rpc) {
              if (request.tag === "notifications/cancelled") {
                return f(clientId, {
                  _tag: "Interrupt",
                  requestId: String((request.payload as any).requestId)
                })
              }
              const handler = handlers.mapUnsafe.get(request.tag) as Rpc.Handler<string>
              return handler
                ? handler.handler(request.payload, {
                  rpc,
                  requestId: RpcMessage.RequestId(request.id),
                  clientId,
                  headers: Headers.fromInput(request.headers)
                }) as Effect.Effect<void>
                : Effect.void
            }
            return f(clientId, request)
          }
          case "Ping":
          case "Ack":
          case "Interrupt":
          case "Eof":
            return f(clientId, request)
          case "Pong":
          case "Exit":
          case "Chunk":
          case "ClientProtocolError":
          case "Defect":
            return RcMap.get(clients, clientId).pipe(
              Effect.flatMap(({ write }) => write(request)),
              Effect.scoped
            )
        }
      })
  })

  const encodeNotification = Schema.encodeUnknownEffect(
    Serializer.json(Schema.Union(Array.from(ServerNotificationRpcs.requests.values(), (rpc) => rpc.payloadSchema)))
  )
  yield* Queue.take(server.notificationsQueue).pipe(
    Effect.flatMap(Effect.fnUntraced(function*(request) {
      const encoded = yield* encodeNotification(request.payload)
      const message: RpcMessage.RequestEncoded = {
        _tag: "Request",
        tag: request.tag,
        payload: encoded
      } as any
      const clientIds = yield* patchedProtocol.clientIds
      for (const clientId of server.initializedClients) {
        if (!clientIds.has(clientId)) {
          server.initializedClients.delete(clientId)
          continue
        }
        yield* patchedProtocol.send(clientId, message as any)
      }
    })),
    Effect.catchCause(() => Effect.void),
    Effect.forever,
    Effect.forkScoped
  )

  return yield* RpcServer.make(ClientRpcs, {
    spanPrefix: "McpServer",
    disableFatalDefects: true
  }).pipe(
    Effect.provideService(RpcServer.Protocol, patchedProtocol),
    Effect.provideService(McpServerClientMiddleware, clientMiddleware),
    Effect.provide(handlers)
  )
}, Effect.scoped)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer = (options: {
  readonly name: string
  readonly version: string
}): Layer.Layer<McpServer | McpServerClient, never, RpcServer.Protocol> =>
  Layer.effectDiscard(Effect.forkScoped(run(options))).pipe(
    Layer.provideMerge(McpServer.layer)
  )

/**
 * Run the McpServer, using stdio for input and output.
 *
 * ```ts
 * import { McpSchema, McpServer } from "effect/unstable/ai"
 * import { NodeRuntime, NodeSink, NodeStream } from "@effect/platform-node"
 * import { Logger } from "effect"
 * import { Schema } from "effect/schema"
 * import { Effect, Layer } from "effect"
 *
 * const idParam = McpSchema.param("id", Schema.Number)
 *
 * // Define a resource template for a README file
 * const ReadmeTemplate = McpServer.resource`file://readme/${idParam}`({
 *   name: "README Template",
 *   // You can add auto-completion for the ID parameter
 *   completion: {
 *     id: (_) => Effect.succeed([1, 2, 3, 4, 5])
 *   },
 *   content: Effect.fn(function*(_uri, id) {
 *     return `# MCP Server Demo - ID: ${id}`
 *   })
 * })
 *
 * // Define a test prompt with parameters
 * const TestPrompt = McpServer.prompt({
 *   name: "Test Prompt",
 *   description: "A test prompt to demonstrate MCP server capabilities",
 *   parameters: {
 *     flightNumber: Schema.String
 *   },
 *   completion: {
 *     flightNumber: () => Effect.succeed(["FL123", "FL456", "FL789"])
 *   },
 *   content: ({ flightNumber }) => Effect.succeed(`Get the booking details for flight number: ${flightNumber}`)
 * })
 *
 * // Merge all the resources and prompts into a single server layer
 * const ServerLayer = Layer.mergeAll(
 *   ReadmeTemplate,
 *   TestPrompt
 * ).pipe(
 *   // Provide the MCP server implementation
 *   Layer.provide(McpServer.layerStdio({
 *     name: "Demo Server",
 *     version: "1.0.0",
 *     stdin: NodeStream.stdin,
 *     stdout: NodeSink.stdout
 *   })),
 *   Layer.provide(Layer.succeed(Logger.LogToStderr)(true))
 * )
 *
 * Layer.launch(ServerLayer).pipe(NodeRuntime.runMain)
 * ```
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerStdio = <EIn, RIn, EOut, ROut>(options: {
  readonly name: string
  readonly version: string
  readonly stdin: Stream<Uint8Array, EIn, RIn>
  readonly stdout: Sink<void, Uint8Array | string, unknown, EOut, ROut>
}): Layer.Layer<McpServer | McpServerClient, never, RIn | ROut> =>
  layer(options).pipe(
    Layer.provide(RpcServer.layerProtocolStdio({
      stdin: options.stdin,
      stdout: options.stdout
    })),
    Layer.provide(RpcSerialization.layerNdJsonRpc())
  )

/**
 * Run the McpServer, registering a router with a `HttpRouter`
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerHttp = (options: {
  readonly name: string
  readonly version: string
  readonly path: HttpRouter.PathInput
}): Layer.Layer<McpServer | McpServerClient, never, HttpRouter.HttpRouter> =>
  layer(options).pipe(
    Layer.provide(RpcServer.layerProtocolHttp(options)),
    Layer.provide(RpcSerialization.layerJsonRpc())
  )

/**
 * Register an AiToolkit with the McpServer.
 *
 * @since 4.0.0
 * @category Tools
 */
export const registerToolkit: <Tools extends AiTool.Any>(toolkit: AiToolkit.AiToolkit<Tools>) => Effect.Effect<
  void,
  never,
  McpServer | AiTool.ToHandler<Tools> | Exclude<AiTool.Services<Tools>, McpServerClient>
> = Effect.fnUntraced(function*<Tools extends AiTool.Any>(
  toolkit: AiToolkit.AiToolkit<Tools>
) {
  const registry = yield* McpServer
  const built = yield* (toolkit as any as Effect.Effect<
    AiToolkit.ToHandler<Tools>,
    never,
    Exclude<AiTool.ToHandler<Tools>, McpServerClient>
  >)
  const services = yield* Effect.services<never>()
  for (const tool of built.tools) {
    const mcpTool = new Tool({
      name: tool.name,
      description: tool.description!,
      inputSchema: makeJsonSchema(Serializer.json(tool.parametersSchema)),
      annotations: {
        ...(ServiceMap.getOption(tool.annotations, AiTool.Title).pipe(
          Option.map((title) => ({ title })),
          Option.getOrUndefined
        )),
        readOnlyHint: ServiceMap.get(tool.annotations, AiTool.Readonly),
        destructiveHint: ServiceMap.get(tool.annotations, AiTool.Destructive),
        idempotentHint: ServiceMap.get(tool.annotations, AiTool.Idempotent),
        openWorldHint: ServiceMap.get(tool.annotations, AiTool.OpenWorld)
      }
    })
    yield* registry.addTool({
      tool: mcpTool,
      handle(payload) {
        return built.handle(tool.name as any, payload).pipe(
          Effect.provideServices(services as ServiceMap.ServiceMap<any>),
          Effect.match({
            onFailure: (error) =>
              new CallToolResult({
                isError: true,
                structuredContent: typeof error === "object" ? error : undefined,
                content: [{
                  type: "text",
                  text: JSON.stringify(error)
                }]
              }),
            onSuccess: (result: any) =>
              new CallToolResult({
                isError: false,
                structuredContent: typeof result.encodedResult === "object" ? result.encodedResult : undefined,
                content: [{
                  type: "text",
                  text: JSON.stringify(result.encodedResult)
                }]
              })
          }),
          Effect.tapCause(Effect.log)
        ) as any
      }
    })
  }
})

/**
 * Register an AiToolkit with the McpServer.
 *
 * @since 4.0.0
 * @category Tools
 */
export const toolkit = <Tools extends AiTool.Any>(
  toolkit: AiToolkit.AiToolkit<Tools>
): Layer.Layer<
  never,
  never,
  AiTool.ToHandler<Tools> | Exclude<AiTool.Services<Tools>, McpServerClient>
> =>
  Layer.effectDiscard(registerToolkit(toolkit)).pipe(
    Layer.provide(McpServer.layer)
  )

/**
 * @since 4.0.0
 */
export type ValidateCompletions<Completions, Keys extends string> =
  & Completions
  & {
    readonly [K in keyof Completions]: K extends Keys ? (input: string) => any : never
  }

/**
 * @since 4.0.0
 */
export type ResourceCompletions<Schemas extends ReadonlyArray<Schema.Top>> = {
  readonly [
    K in Extract<keyof Schemas, `${number}`> as Schemas[K] extends Param<infer Id, infer _S> ? Id
      : `param${K}`
  ]: (input: string) => Effect.Effect<Array<Schemas[K]["Type"]>, any, any>
}

/**
 * Register a resource with the McpServer.
 *
 * @since 4.0.0
 * @category Resources
 */
export const registerResource: {
  <E, R>(options: {
    readonly uri: string
    readonly name: string
    readonly description?: string | undefined
    readonly mimeType?: string | undefined
    readonly audience?: ReadonlyArray<"user" | "assistant"> | undefined
    readonly priority?: number | undefined
    readonly content: Effect.Effect<
      typeof ReadResourceResult.Type | string | Uint8Array,
      E,
      R
    >
  }): Effect.Effect<void, never, Exclude<R, McpServerClient> | McpServer>
  <const Schemas extends ReadonlyArray<Schema.Top>>(segments: TemplateStringsArray, ...schemas: Schemas): <
    E,
    R,
    const Completions extends Partial<ResourceCompletions<Schemas>> = {}
  >(options: {
    readonly name: string
    readonly description?: string | undefined
    readonly mimeType?: string | undefined
    readonly audience?: ReadonlyArray<"user" | "assistant"> | undefined
    readonly priority?: number | undefined
    readonly completion?: ValidateCompletions<Completions, keyof ResourceCompletions<Schemas>> | undefined
    readonly content: (uri: string, ...params: { readonly [K in keyof Schemas]: Schemas[K]["Type"] }) => Effect.Effect<
      typeof ReadResourceResult.Type | string | Uint8Array,
      E,
      R
    >
  }) => Effect.Effect<
    void,
    never,
    | Exclude<
      | Schemas[number]["DecodingServices"]
      | Schemas[number]["EncodingServices"]
      | R
      | (Completions[keyof Completions] extends (input: string) => infer Ret ?
        Ret extends Effect.Effect<infer _A, infer _E, infer _R> ? _R : never
        : never),
      McpServerClient
    >
    | McpServer
  >
} = function() {
  if (arguments.length === 1) {
    const options = arguments[0] as Resource & typeof Annotations.Type & {
      readonly content: Effect.Effect<typeof ReadResourceResult.Type | string | Uint8Array>
    }
    return Effect.gen(function*() {
      const services = yield* Effect.services<any>()
      const registry = yield* McpServer
      yield* registry.addResource(
        new Resource({
          ...options,
          annotations: options
        }),
        options.content.pipe(
          Effect.provideServices(services),
          Effect.map((content) => resolveResourceContent(options.uri, content)),
          Effect.catchCause((cause) => {
            const prettyError = Cause.prettyErrors(cause)[0]
            return Effect.fail(new InternalError({ message: prettyError.message }))
          })
        )
      )
    })
  }
  const {
    params,
    routerPath,
    schema,
    uriPath
  } = compileUriTemplate(...(arguments as any as [any, any]))
  return Effect.fnUntraced(function*<E, R>(options: {
    readonly name: string
    readonly description?: string | undefined
    readonly mimeType?: string | undefined
    readonly audience?: ReadonlyArray<"user" | "assistant"> | undefined
    readonly priority?: number | undefined
    readonly completion?: Record<string, (input: string) => Effect.Effect<any>> | undefined
    readonly content: (uri: string, ...params: Array<any>) => Effect.Effect<
      typeof ReadResourceResult.Type | string | Uint8Array,
      E,
      R
    >
  }) {
    const services = yield* Effect.services<any>()
    const registry = yield* McpServer
    const decode = Schema.decodeUnknownEffect(schema)
    const template = new ResourceTemplate({
      ...options,
      uriTemplate: uriPath,
      annotations: options!
    })
    const completions: Record<string, (input: string) => Effect.Effect<CompleteResult, InternalError>> = {}
    for (const [param, handle] of Object.entries(options.completion ?? {})) {
      const encodeArray = Schema.encodeUnknownEffect(Schema.Array(params[param]))
      const handler = (input: string) =>
        handle(input).pipe(
          Effect.flatMap(encodeArray),
          Effect.map((values) => ({
            completion: {
              values: values as Array<string>,
              total: values.length,
              hasMore: false
            }
          })),
          Effect.catchCause((cause) => {
            const prettyError = Cause.prettyErrors(cause)[0]
            return Effect.fail(new InternalError({ message: prettyError.message }))
          }),
          Effect.provideServices(services)
        )
      completions[param] = handler
    }
    yield* registry.addResourceTemplate({
      template,
      routerPath,
      completions,
      handle: (uri, params) =>
        decode(params).pipe(
          Effect.mapError((error) => new InvalidParams({ message: error.message })),
          Effect.flatMap((params: any) =>
            options.content(uri, ...params).pipe(
              Effect.map((content) => resolveResourceContent(uri, content)),
              Effect.catchCause((cause) => {
                const prettyError = Cause.prettyErrors(cause)[0]
                return Effect.fail(new InternalError({ message: prettyError.message }))
              })
            )
          ),
          Effect.provideServices(services)
        )
    })
  })
} as any

/**
 * Register a resource with the McpServer.
 *
 * @since 4.0.0
 * @category Resources
 */
export const resource: {
  <E, R>(options: {
    readonly uri: string
    readonly name: string
    readonly description?: string | undefined
    readonly mimeType?: string | undefined
    readonly audience?: ReadonlyArray<"user" | "assistant"> | undefined
    readonly priority?: number | undefined
    readonly content: Effect.Effect<
      typeof ReadResourceResult.Type | string | Uint8Array,
      E,
      R
    >
  }): Layer.Layer<never, never, Exclude<R, McpServerClient>>
  <const Schemas extends ReadonlyArray<Schema.Top>>(segments: TemplateStringsArray, ...schemas: Schemas): <
    E,
    R,
    const Completions extends Partial<ResourceCompletions<Schemas>> = {}
  >(options: {
    readonly name: string
    readonly description?: string | undefined
    readonly mimeType?: string | undefined
    readonly audience?: ReadonlyArray<"user" | "assistant"> | undefined
    readonly priority?: number | undefined
    readonly completion?: ValidateCompletions<Completions, keyof ResourceCompletions<Schemas>> | undefined
    readonly content: (uri: string, ...params: { readonly [K in keyof Schemas]: Schemas[K]["Type"] }) => Effect.Effect<
      typeof ReadResourceResult.Type | string | Uint8Array,
      E,
      R
    >
  }) => Layer.Layer<
    never,
    never,
    Exclude<
      | R
      | (Completions[keyof Completions] extends (input: string) => infer Ret ?
        Ret extends Effect.Effect<infer _A, infer _E, infer _R> ? _R : never
        : never),
      McpServerClient
    >
  >
} = function() {
  if (arguments.length === 1) {
    return Layer.effectDiscard(registerResource(arguments[0])).pipe(
      Layer.provide(McpServer.layer)
    )
  }
  const register = registerResource(...(arguments as any as [any, any]))
  return (options: any) =>
    Layer.effectDiscard(register(options)).pipe(
      Layer.provide(McpServer.layer)
    )
} as any

/**
 * Register a prompt with the McpServer.
 *
 * @since 4.0.0
 * @category Prompts
 */
export const registerPrompt = <
  E,
  R,
  Params extends Schema.Struct.Fields = {},
  const Completions extends {
    readonly [K in keyof Params]?: (input: string) => Effect.Effect<Array<Params[K]>, any, any>
  } = {}
>(
  options: {
    readonly name: string
    readonly description?: string | undefined
    readonly parameters?: Params | undefined
    readonly completion?: ValidateCompletions<Completions, Extract<keyof Params, string>> | undefined
    readonly content: (params: Params) => Effect.Effect<Array<typeof PromptMessage.Type> | string, E, R>
  }
): Effect.Effect<void, never, Exclude<Schema.Struct.DecodingServices<Params> | R, McpServerClient> | McpServer> => {
  const args = Arr.empty<typeof PromptArgument.Type>()
  const props: Record<string, Schema.Top> = options.parameters ?? {}
  for (const [name, prop] of Object.entries(props)) {
    args.push({
      name,
      description: SchemaAnnotations.getDescription(prop.ast),
      required: !AST.isOptional(prop.ast)
    })
  }
  const prompt = new Prompt({
    name: options.name,
    description: options.description,
    arguments: args
  })
  const decode = options.parameters
    ? Schema.decodeEffect(Serializer.json(Schema.Struct(props)))
    : () => Effect.succeed({} as Params)
  const completion: Record<string, (input: string) => Effect.Effect<any>> = options.completion ?? {}
  return Effect.gen(function*() {
    const registry = yield* McpServer
    const services = yield* Effect.services<Exclude<R | Schema.Struct.DecodingServices<Params>, McpServerClient>>()
    const completions: Record<
      string,
      (input: string) => Effect.Effect<CompleteResult, InternalError, McpServerClient>
    > = {}
    for (const [param, handle] of Object.entries(completion)) {
      const encodeArray = Schema.encodeEffect(Schema.Array(props[param]))
      const handler = (input: string) =>
        handle(input).pipe(
          Effect.flatMap(encodeArray),
          Effect.map((values) => ({
            completion: {
              values: values as Array<string>,
              total: values.length,
              hasMore: false
            }
          })),
          Effect.catchCause((cause) => {
            const prettyError = Cause.prettyErrors(cause)[0]
            return Effect.fail(new InternalError({ message: prettyError.message }))
          }),
          Effect.provide(services)
        )
      completions[param] = handler as any
    }
    yield* registry.addPrompt({
      prompt,
      completions,
      handle: (params) =>
        decode(params).pipe(
          Effect.mapError((error) => new InvalidParams({ message: error.message })),
          Effect.flatMap((params) => options.content(params as any)),
          Effect.map((messages) => {
            messages = typeof messages === "string" ?
              [{
                role: "user",
                content: TextContent.makeUnsafe({ text: messages })
              }] :
              messages
            return new GetPromptResult({ messages, description: prompt.description })
          }),
          Effect.catchCause((cause) => {
            const prettyError = Cause.prettyErrors(cause)[0]
            return Effect.fail(new InternalError({ message: prettyError.message }))
          }),
          Effect.provideServices(services as ServiceMap.ServiceMap<unknown>)
        )
    })
  })
}

/**
 * Register a prompt with the McpServer.
 *
 * @since 4.0.0
 * @category Prompts
 */
export const prompt = <
  E,
  R,
  Params extends Schema.Struct.Fields = {},
  const Completions extends {
    readonly [K in keyof Params]?: (input: string) => Effect.Effect<Array<Params[K]["Type"]>, any, any>
  } = {}
>(
  options: {
    readonly name: string
    readonly description?: string | undefined
    readonly parameters?: Params | undefined
    readonly completion?: ValidateCompletions<Completions, Extract<keyof Params, string>> | undefined
    readonly content: (
      params: Schema.Struct.Type<Params>
    ) => Effect.Effect<Array<typeof PromptMessage.Type> | string, E, R>
  }
): Layer.Layer<never, never, Exclude<Schema.Struct.DecodingServices<Params> | R, McpServerClient>> =>
  Layer.effectDiscard(registerPrompt(options)).pipe(
    Layer.provide(McpServer.layer)
  )

/**
 * Create an elicitation request
 *
 * @since 4.0.0
 * @category Elicitation
 */
export const elicit: <S extends Schema.Codec<any, Record<string, unknown>, any, any>>(options: {
  readonly message: string
  readonly schema: S
}) => Effect.Effect<
  S["Type"],
  ElicitationDeclined,
  McpServerClient | S["DecodingServices"]
> = Effect.fnUntraced(function*<S extends Schema.Codec<any, Record<string, unknown>, any, any>>(options: {
  readonly message: string
  readonly schema: S
}) {
  const { getClient } = yield* McpServerClient
  const client = yield* getClient
  const schema = Serializer.json(options.schema)
  const request = Elicit.payloadSchema.makeUnsafe({
    message: options.message,
    requestedSchema: makeJsonSchema(schema)
  })
  const res = yield* client["elicitation/create"](request).pipe(
    Effect.catchCause((cause) => Effect.fail(new ElicitationDeclined({ cause: Cause.squash(cause), request })))
  )
  switch (res.action) {
    case "accept":
      return yield* Effect.orDie(Schema.decodeUnknownEffect(schema)(res.content))
    case "cancel":
      return yield* Effect.interrupt
    case "decline":
      return yield* Effect.fail(new ElicitationDeclined({ request }))
  }
}, Effect.scoped)

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

const makeUriMatcher = <A>() => {
  const router = FindMyWay.make<A>({
    ignoreTrailingSlash: true,
    ignoreDuplicateSlashes: true,
    caseSensitive: true
  })
  const add = (uri: string, value: A) => {
    router.on("GET", uri as any, value)
  }
  const find = (uri: string) => router.find("GET", uri)

  return { add, find } as const
}

const compileUriTemplate = (segments: TemplateStringsArray, ...schemas: ReadonlyArray<Schema.Top>) => {
  let routerPath = segments[0].replace(":", "::")
  let uriPath = segments[0]
  const params: Record<string, Schema.Top> = {}
  let pathSchema = Schema.Tuple([]) as Schema.Top
  if (schemas.length > 0) {
    const arr: Array<Schema.Top> = []
    for (let i = 0; i < schemas.length; i++) {
      const schema = Serializer.stringPojo(schemas[i])
      const segment = segments[i + 1]
      const key = String(i)
      arr.push(schema)
      routerPath += `:${key}${segment.replace(":", "::")}`
      const paramName = isParam(schema) ? schema.name : `param${key}`
      params[paramName] = schema
      uriPath += `{${paramName}}${segment}`
    }
    pathSchema = Schema.Tuple(arr)
  }
  return {
    routerPath,
    uriPath,
    schema: pathSchema,
    params
  } as const
}

const layerHandlers = (serverInfo: {
  readonly name: string
  readonly version: string
}) =>
  ClientRpcs.toLayer(
    Effect.gen(function*() {
      const server = yield* McpServer

      return ClientRpcs.of({
        // Requests
        ping: () => Effect.succeed({}),
        initialize(params, { clientId }) {
          const requestedVersion = params.protocolVersion
          const capabilities: Types.DeepMutable<typeof ServerCapabilities.Type> = {
            completions: {}
          }
          if (server.tools.length > 0) {
            capabilities.tools = { listChanged: true }
          }
          if (server.resources.length > 0 || server.resourceTemplates.length > 0) {
            capabilities.resources = {
              listChanged: true,
              subscribe: false
            }
          }
          if (server.prompts.length > 0) {
            capabilities.prompts = { listChanged: true }
          }
          server.initializedClients.add(clientId)
          return Effect.succeed({
            capabilities,
            serverInfo,
            protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
              ? requestedVersion
              : LATEST_PROTOCOL_VERSION
          })
        },
        "completion/complete": server.completion,
        "logging/setLevel": () => InternalError.notImplemented.asEffect(),
        "prompts/get": server.getPromptResult,
        "prompts/list": () => Effect.sync(() => new ListPromptsResult({ prompts: server.prompts })),
        "resources/list": () => Effect.sync(() => new ListResourcesResult({ resources: server.resources })),
        "resources/read": ({ uri }) => server.findResource(uri),
        "resources/subscribe": () => InternalError.notImplemented.asEffect(),
        "resources/unsubscribe": () => InternalError.notImplemented.asEffect(),
        "resources/templates/list": () =>
          Effect.sync(() => new ListResourceTemplatesResult({ resourceTemplates: server.resourceTemplates })),
        "tools/call": server.callTool,
        "tools/list": () => Effect.sync(() => new ListToolsResult({ tools: server.tools })),

        // Notifications
        "notifications/cancelled": (_) => Effect.void,
        "notifications/initialized": (_) => Effect.void,
        "notifications/progress": (_) => Effect.void,
        "notifications/roots/list_changed": (_) => Effect.void
      })
    })
  )

const makeJsonSchema = (schema: Schema.Top): JsonSchema.JsonSchema => {
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

const resolveResourceContent = (
  uri: string,
  content: typeof ReadResourceResult.Type | string | Uint8Array
): typeof ReadResourceResult.Type => {
  if (typeof content === "string") {
    return {
      contents: [{
        uri,
        text: content
      }]
    }
  } else if (content instanceof Uint8Array) {
    return {
      contents: [{
        uri,
        blob: content
      }]
    }
  }
  return content
}
