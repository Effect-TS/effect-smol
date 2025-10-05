/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Filter from "../../data/Filter.ts"
import type * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Fiber from "../../Fiber.ts"
import { constant, constTrue, constVoid, identity } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Pull from "../../stream/Pull.ts"
import type * as Sink from "../../stream/Sink.ts"
import * as Stream from "../../stream/Stream.ts"
import * as Tracer from "../../Tracer.ts"
import type * as Types from "../../types/Types.ts"
import * as Headers from "../http/Headers.ts"
import * as HttpRouter from "../http/HttpRouter.ts"
import * as HttpServerRequest from "../http/HttpServerRequest.ts"
import * as HttpServerResponse from "../http/HttpServerResponse.ts"
import type * as Socket from "../socket/Socket.ts"
import * as SocketServer from "../socket/SocketServer.ts"
import * as Rpc from "./Rpc.ts"
import type * as RpcGroup from "./RpcGroup.ts"
import type {
  FromClient,
  FromClientEncoded,
  FromServer,
  FromServerEncoded,
  Request,
  RequestEncoded,
  ResponseExitEncoded
} from "./RpcMessage.ts"
import { constEof, constPong, RequestId, ResponseDefectEncoded } from "./RpcMessage.ts"
import * as RpcSchema from "./RpcSchema.ts"
import * as RpcSerialization from "./RpcSerialization.ts"
import { withRun } from "./Utils.ts"

/**
 * @since 4.0.0
 * @category server
 */
export interface RpcServer<A extends Rpc.Any> {
  readonly write: (clientId: number, message: FromClient<A>) => Effect.Effect<void>
  readonly disconnect: (clientId: number) => Effect.Effect<void>
}

/**
 * @since 4.0.0
 * @category server
 */
export const makeNoSerialization: <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options: {
    readonly onFromServer: (response: FromServer<Rpcs>) => Effect.Effect<void>
    readonly disableTracing?: boolean | undefined
    readonly disableSpanPropagation?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly disableClientAcks?: boolean | undefined
    readonly concurrency?: number | "unbounded" | undefined
    readonly disableFatalDefects?: boolean | undefined
  }
) => Effect.Effect<
  RpcServer<Rpcs>,
  never,
  Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs> | Scope.Scope
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options: {
    readonly onFromServer: (response: FromServer<Rpcs>) => Effect.Effect<void>
    readonly disableTracing?: boolean | undefined
    readonly disableSpanPropagation?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly disableClientAcks?: boolean | undefined
    readonly concurrency?: number | "unbounded" | undefined
    readonly disableFatalDefects?: boolean | undefined
  }
) {
  const enableTracing = options.disableTracing !== true
  const enableSpanPropagation = options.disableSpanPropagation !== true
  const supportsAck = options.disableClientAcks !== true
  const spanPrefix = options.spanPrefix ?? "RpcServer"
  const concurrency = options.concurrency ?? "unbounded"
  const disableFatalDefects = options.disableFatalDefects ?? false
  const services = yield* Effect.services<Rpc.ToHandler<Rpcs> | Scope.Scope>()
  const scope = ServiceMap.get(services, Scope.Scope)
  const trackFiber = Fiber.runIn(Scope.forkUnsafe(scope, "parallel"))
  const concurrencySemaphore = concurrency === "unbounded"
    ? undefined
    : yield* Effect.makeSemaphore(concurrency)

  type Client = {
    readonly id: number
    readonly latches: Map<RequestId, Effect.Latch>
    readonly fibers: Map<RequestId, Fiber.Fiber<unknown, any>>
    ended: boolean
  }

  const clients = new Map<number, Client>()
  let isShutdown = false
  const shutdownLatch = Effect.makeLatchUnsafe(false)
  yield* Scope.addFinalizer(
    scope,
    Effect.withFiber((parent) => {
      isShutdown = true
      for (const client of clients.values()) {
        client.ended = true
        if (client.fibers.size === 0) {
          trackFiber(Effect.runForkWith(services)(endClient(client)))
          continue
        }
        for (const fiber of client.fibers.values()) {
          fiber.interruptUnsafe(parent.id)
        }
      }
      if (clients.size === 0) {
        return Effect.void
      }
      return shutdownLatch.await
    })
  )

  const disconnect = (clientId: number) =>
    Effect.withFiber((parent) => {
      const client = clients.get(clientId)
      if (!client) return Effect.void
      for (const fiber of client.fibers.values()) {
        fiber.interruptUnsafe(parent.id)
      }
      clients.delete(clientId)
      return Effect.void
    })

  const write = (clientId: number, message: FromClient<Rpcs>): Effect.Effect<void> =>
    Effect.catchDefect(
      Effect.withFiber((requestFiber) => {
        if (isShutdown) return Effect.interrupt
        let client = clients.get(clientId)
        if (!client) {
          client = {
            id: clientId,
            latches: new Map(),
            fibers: new Map(),
            ended: false
          }
          clients.set(clientId, client)
        } else if (client.ended) {
          return Effect.interrupt
        }

        switch (message._tag) {
          case "Request": {
            return handleRequest(requestFiber, client, message)
          }
          case "Ack": {
            const latch = client.latches.get(message.requestId)
            return latch ? latch.open : Effect.void
          }
          case "Interrupt": {
            const fiber = client.fibers.get(message.requestId)
            return fiber ?
              Effect.forkDaemon(Fiber.interruptAs(fiber, fiberIdClientInterrupt), { startImmediately: true }) :
              options.onFromServer({
                _tag: "Exit",
                clientId,
                requestId: message.requestId,
                exit: Exit.interrupt()
              })
          }
          case "Eof": {
            client.ended = true
            if (client.fibers.size > 0) return Effect.void
            return endClient(client)
          }
          default: {
            return sendDefect(client, `Unknown request tag: ${(message as any)._tag}`)
          }
        }
      }),
      (defect) => sendDefect(clients.get(clientId)!, defect)
    )

  const endClient = (client: Client) => {
    clients.delete(client.id)
    const write = options.onFromServer({
      _tag: "ClientEnd",
      clientId: client.id
    })
    if (isShutdown && clients.size === 0) {
      return Effect.andThen(write, shutdownLatch.open)
    }
    return write
  }

  const handleRequest = (
    requestFiber: Fiber.Fiber<any, any>,
    client: Client,
    request: Request<Rpcs>
  ): Effect.Effect<void> => {
    if (client.fibers.has(request.id)) {
      return Effect.interrupt
    }
    const rpc = group.requests.get(request.tag) as any as Rpc.AnyWithProps
    const entry = services.mapUnsafe.get(rpc?.key) as Rpc.Handler<Rpcs["_tag"]>
    if (!rpc || !entry) {
      const write = Effect.catchDefect(
        options.onFromServer({
          _tag: "Exit",
          clientId: client.id,
          requestId: request.id,
          exit: Exit.die(`Unknown request tag: ${request.tag}`)
        }),
        (defect) => sendDefect(client, defect)
      )
      if (!client.ended || client.fibers.size > 0) return write
      return Effect.ensuring(write, endClient(client))
    }
    const isStream = RpcSchema.isStreamSchema(rpc.successSchema)
    const metadata = {
      rpc,
      clientId: client.id,
      requestId: request.id,
      headers: request.headers,
      payload: request.payload
    }
    const result = entry.handler(request.payload, metadata)

    // if the handler requested forking, then we skip the concurrency control
    const isWrapper = Rpc.isWrapper(result)
    const isFork = isWrapper && result.fork
    const isUninterruptible = isWrapper && result.uninterruptible
    // unwrap the fork data type
    const streamOrEffect = isWrapper ? result.value : result
    const handler = isStream
      ? streamEffect(client, request, streamOrEffect) as Effect.Effect<any>
      : streamOrEffect as Effect.Effect<any>

    const withMiddleware = rpc.middlewares.size > 0 ?
      applyMiddleware(services, handler, metadata) :
      handler
    let responded = false
    const scope = Scope.makeUnsafe()
    let effect = Effect.onExit(withMiddleware, (exit) => {
      responded = true
      const close = Scope.closeUnsafe(scope, exit)
      const write = exit._tag === "Failure" && !disableFatalDefects && Cause.hasDie(exit.cause) &&
          !Cause.hasInterrupt(exit.cause) ?
        sendDefect(client, Cause.squash(exit.cause)) :
        options.onFromServer({
          _tag: "Exit",
          clientId: client.id,
          requestId: request.id,
          exit
        })
      return close ? Effect.ensuring(write, close) : write
    })
    if (enableTracing) {
      const parentSpan = requestFiber.services.mapUnsafe.get(Tracer.ParentSpan.key) as Tracer.AnySpan | undefined
      effect = Effect.withSpan(effect, `${spanPrefix}.${request.tag}`, {
        captureStackTrace: false,
        attributes: options.spanAttributes,
        parent: enableSpanPropagation && request.spanId ?
          {
            _tag: "ExternalSpan",
            traceId: request.traceId!,
            spanId: request.spanId,
            sampled: request.sampled!,
            context: ServiceMap.empty()
          } :
          undefined,
        links: enableSpanPropagation && parentSpan ?
          [{
            span: parentSpan,
            attributes: {}
          }] :
          undefined
      })
    }
    if (!isFork && concurrencySemaphore) {
      effect = concurrencySemaphore.withPermits(1)(effect)
    }
    const serviceMap = new Map(entry.services.mapUnsafe)
    serviceMap.forEach((value, key) => serviceMap.set(key, value))
    serviceMap.set(Scope.Scope.key, scope)
    const runFork = Effect.runForkWith(ServiceMap.makeUnsafe(serviceMap))
    const fiber = trackFiber(runFork(effect, isUninterruptible ? { uninterruptible: true } : undefined))
    client.fibers.set(request.id, fiber)
    fiber.addObserver((exit) => {
      if (!responded && exit._tag === "Failure") {
        trackFiber(runFork(options.onFromServer({
          _tag: "Exit",
          clientId: client.id,
          requestId: request.id,
          exit: Exit.interrupt()
        })))
      }
      client.fibers.delete(request.id)
      client.latches.delete(request.id)
      if (client.ended && client.fibers.size === 0) {
        trackFiber(runFork(endClient(client)))
      }
    })
    return Effect.void
  }

  const streamEffect = (
    client: Client,
    request: Request<Rpcs>,
    stream: Stream.Stream<any, any> | Effect.Effect<Queue.Dequeue<any, any>, any, Scope.Scope>
  ) => {
    let latch = client.latches.get(request.id)
    if (supportsAck && !latch) {
      latch = Effect.makeLatchUnsafe(false)
      client.latches.set(request.id, latch)
    }
    if (Effect.isEffect(stream)) {
      return stream.pipe(
        Effect.flatMap((queue) =>
          Effect.whileLoop({
            while: constTrue,
            body: constant(Effect.flatMap(Queue.takeAll(queue), (values) => {
              const write = options.onFromServer({
                _tag: "Chunk",
                clientId: client.id,
                requestId: request.id,
                values
              })
              if (!latch) return write
              latch.closeUnsafe()
              return Effect.flatMap(write, () => latch.await)
            })),
            step: constVoid
          })
        ),
        Pull.catchHalt(() => Effect.void),
        Effect.scoped
      )
    }
    return Stream.runForEachArray(stream, (values) => {
      const write = options.onFromServer({
        _tag: "Chunk",
        clientId: client.id,
        requestId: request.id,
        values
      })
      if (!latch) return write
      latch.closeUnsafe()
      return Effect.andThen(write, latch.await)
    })
  }

  const sendDefect = (client: Client, defect: unknown) =>
    Effect.suspend(() => {
      const shouldEnd = client.ended && client.fibers.size === 0
      const write = options.onFromServer({
        _tag: "Defect",
        clientId: client.id,
        defect
      })
      if (!shouldEnd) return write
      return Effect.andThen(write, endClient(client))
    })

  return identity<RpcServer<Rpcs>>({
    write,
    disconnect
  })
})

const applyMiddleware = <A, E, R>(
  context: ServiceMap.ServiceMap<never>,
  handler: Effect.Effect<A, E, R>,
  options: {
    readonly rpc: Rpc.AnyWithProps
    readonly clientId: number
    readonly requestId: RequestId
    readonly headers: Headers.Headers
    readonly payload: A
  }
) => {
  for (const tag of options.rpc.middlewares) {
    const middleware = ServiceMap.getUnsafe(context, tag)
    handler = middleware(handler as any, options) as any
  }

  return handler
}

/**
 * @since 4.0.0
 * @category server
 */
export const make: <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?:
    | {
      readonly disableTracing?: boolean | undefined
      readonly spanPrefix?: string | undefined
      readonly spanAttributes?: Record<string, unknown> | undefined
      readonly concurrency?: number | "unbounded" | undefined
      readonly disableFatalDefects?: boolean | undefined
    }
    | undefined
) => Effect.Effect<
  never,
  never,
  Protocol | Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs>
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly concurrency?: number | "unbounded" | undefined
    readonly disableFatalDefects?: boolean | undefined
  }
) {
  const { disconnects, end, run, send, supportsAck, supportsSpanPropagation, supportsStructuredClone } = yield* Protocol
  const services = yield* Effect.services<Rpc.ToHandler<Rpcs> | Rpc.Middleware<Rpcs>>()
  const scope = yield* Scope.make()

  const server = yield* makeNoSerialization(group, {
    ...options,
    disableClientAcks: !supportsAck,
    disableSpanPropagation: !supportsSpanPropagation,
    onFromServer(response): Effect.Effect<void> {
      const client = clients.get(response.clientId)
      if (!client) return Effect.void
      switch (response._tag) {
        case "Chunk": {
          const schemas = client.schemas.get(response.requestId)
          if (!schemas) return Effect.void
          return handleEncode(
            client,
            response.requestId,
            Effect.provideServices(schemas.encodeChunk(response.values), schemas.services),
            (values) => ({ _tag: "Chunk", requestId: String(response.requestId), values })
          )
        }
        case "Exit": {
          const schemas = client.schemas.get(response.requestId)
          if (!schemas) return Effect.void
          client.schemas.delete(response.requestId)
          return handleEncode(
            client,
            response.requestId,
            Effect.provideServices(schemas.encodeExit(response.exit), schemas.services),
            (exit) => ({ _tag: "Exit", requestId: String(response.requestId), exit })
          )
        }
        case "Defect": {
          return sendDefect(client, response.defect)
        }
        case "ClientEnd": {
          clients.delete(response.clientId)
          return end(response.clientId)
        }
      }
    }
  }).pipe(Scope.provide(scope))

  // handle disconnects
  yield* Effect.fork(Effect.whileLoop({
    while: constTrue,
    body: constant(Effect.flatMap(Queue.take(disconnects), (clientId) => {
      clients.delete(clientId)
      return server.disconnect(clientId)
    })),
    step: constVoid
  }))

  type Schemas = {
    readonly decode: (u: unknown) => Effect.Effect<Rpc.Payload<Rpcs>, Schema.SchemaError>
    readonly encodeChunk: (
      u: ReadonlyArray<unknown>
    ) => Effect.Effect<NonEmptyReadonlyArray<unknown>, Schema.SchemaError>
    readonly encodeExit: (u: unknown) => Effect.Effect<ResponseExitEncoded["exit"], Schema.SchemaError>
    readonly services: ServiceMap.ServiceMap<never>
    // readonly collector?: Transferable.CollectorService | undefined
  }

  const schemasCache = new WeakMap<any, Schemas>()
  const serializer = supportsStructuredClone ? identity : Serializer.json
  const getSchemas = (rpc: Rpc.AnyWithProps) => {
    let schemas = schemasCache.get(rpc)
    if (!schemas) {
      const entry = services.mapUnsafe.get(rpc.key) as Rpc.Handler<Rpcs["_tag"]>
      const streamSchemas = RpcSchema.getStreamSchemas(rpc.successSchema)
      schemas = {
        decode: Schema.decodeUnknownEffect(serializer(rpc.payloadSchema as any)),
        encodeChunk: Schema.encodeUnknownEffect(
          serializer(Schema.Array(streamSchemas ? streamSchemas.success : Schema.Any))
        ) as any,
        encodeExit: Schema.encodeUnknownEffect(serializer(Rpc.exitSchema(rpc as any))) as any,
        services: entry.services
      }
      schemasCache.set(rpc, schemas)
    }
    return schemas
  }

  type Client = {
    readonly id: number
    readonly schemas: Map<RequestId, Schemas>
  }
  const clients = new Map<number, Client>()

  const handleEncode = <A, R>(
    client: Client,
    requestId: RequestId,
    // collector: Transferable.CollectorService | undefined,
    effect: Effect.Effect<A, Schema.SchemaError, R>,
    onSuccess: (a: A) => FromServerEncoded
  ) =>
    effect.pipe(
      Effect.flatMap((a) => send(client.id, onSuccess(a))),
      Effect.catchCause((cause) => {
        client.schemas.delete(requestId)
        const defect = Cause.squash(Cause.map(cause, (e) => e.issue.toString()))
        return Effect.andThen(
          sendRequestDefect(client, requestId, defect),
          server.write(client.id, { _tag: "Interrupt", requestId, interruptors: [] })
        )
      })
    )

  const sendRequestDefect = (client: Client, requestId: RequestId, defect: unknown) =>
    Effect.catchCause(
      send(client.id, {
        _tag: "Exit",
        requestId: String(requestId),
        exit: {
          _tag: "Failure",
          cause: [{
            _tag: "Die",
            defect
          }]
        }
      }),
      (cause) => sendDefect(client, Cause.squash(cause))
    )

  const sendDefect = (client: Client, defect: unknown) =>
    Effect.catchCause(
      send(client.id, { _tag: "Defect", defect }),
      (cause) =>
        Effect.annotateLogs(Effect.logDebug(cause), {
          module: "RpcServer",
          method: "sendDefect"
        })
    )

  // main server loop
  return yield* run((clientId, request) => {
    let client = clients.get(clientId)
    if (!client) {
      client = {
        id: clientId,
        schemas: new Map()
      }
      clients.set(clientId, client)
    }

    switch (request._tag) {
      case "Request": {
        const tag = Predicate.hasProperty(request, "tag") ? request.tag as string : ""
        const rpc = group.requests.get(tag)
        if (!rpc) {
          return sendDefect(client, `Unknown request tag: ${tag}`)
        }
        let requestId: RequestId
        switch (typeof request.id) {
          case "bigint":
          case "string": {
            requestId = RequestId(request.id)
            break
          }
          default: {
            return sendDefect(client, `Invalid request id: ${request.id}`)
          }
        }
        const schemas = getSchemas(rpc as any)
        return Effect.matchEffect(
          Effect.provideServices(schemas.decode(request.payload), schemas.services),
          {
            onFailure: (error) => sendRequestDefect(client, requestId, error.issue.toString()),
            onSuccess: (payload) => {
              client.schemas.set(requestId, schemas)
              return server.write(clientId, {
                ...request,
                id: requestId,
                payload,
                headers: Headers.fromInput(request.headers)
              } as any)
            }
          }
        )
      }
      case "Ping": {
        return Effect.catchCause(
          send(client.id, constPong),
          (cause) => sendDefect(client, Cause.squash(cause))
        )
      }
      case "Eof": {
        return server.write(clientId, request)
      }
      case "Ack": {
        return server.write(clientId, {
          ...request,
          requestId: RequestId(request.requestId)
        })
      }
      case "Interrupt": {
        return server.write(clientId, {
          ...request,
          requestId: RequestId(request.requestId),
          interruptors: []
        })
      }
      default: {
        return sendDefect(client, `Unknown request tag: ${(request as any)._tag}`)
      }
    }
  }).pipe(
    Effect.tapCause((cause) => Effect.logFatal("BUG: RpcServer protocol crashed", cause)),
    Effect.onExit((exit) => Scope.close(scope, exit))
  )
})

/**
 * @since 4.0.0
 * @category server
 */
export const layer = <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly concurrency?: number | "unbounded" | undefined
    readonly disableFatalDefects?: boolean | undefined
  }
): Layer.Layer<
  never,
  never,
  | Protocol
  | Rpc.ToHandler<Rpcs>
  | Rpc.Middleware<Rpcs>
> => Layer.effectDiscard(Effect.forkScoped(make(group, options)))

/**
 * Create a RPC server that registers a HTTP route with a `HttpRouter`.
 *
 * It defaults to using websockets for communication, but can be configured to
 * use HTTP.
 *
 * @since 4.0.0
 * @category protocol
 */
export const layerHttp = <Rpcs extends Rpc.Any>(options: {
  readonly group: RpcGroup.RpcGroup<Rpcs>
  readonly path: HttpRouter.PathInput
  readonly protocol?: "http" | "websocket" | undefined
  readonly disableTracing?: boolean | undefined
  readonly spanPrefix?: string | undefined
  readonly spanAttributes?: Record<string, unknown> | undefined
  readonly concurrency?: number | "unbounded" | undefined
}): Layer.Layer<
  never,
  never,
  | RpcSerialization.RpcSerialization
  | HttpRouter.HttpRouter
  | Rpc.ToHandler<Rpcs>
  | Rpc.Middleware<Rpcs>
> =>
  layer(options.group, options).pipe(
    Layer.provide(
      options.protocol === "http"
        ? layerProtocolHttp(options)
        : layerProtocolWebsocket(options)
    )
  )

/**
 * @since 4.0.0
 * @category protocol
 */
export class Protocol extends ServiceMap.Key<Protocol, {
  readonly run: (
    f: (clientId: number, data: FromClientEncoded) => Effect.Effect<void>
  ) => Effect.Effect<never>
  readonly disconnects: Queue.Dequeue<number>
  readonly send: (
    clientId: number,
    response: FromServerEncoded,
    transferables?: ReadonlyArray<globalThis.Transferable>
  ) => Effect.Effect<void>
  readonly end: (clientId: number) => Effect.Effect<void>
  readonly clientIds: Effect.Effect<ReadonlySet<number>>
  readonly initialMessage: Effect.Effect<Option.Option<unknown>>
  readonly supportsAck: boolean
  readonly supportsTransferables: boolean
  readonly supportsSpanPropagation: boolean
  readonly supportsStructuredClone: boolean
}>()("effect/rpc/RpcServer/Protocol") {
  /**
   * @since 4.0.0
   */
  static make = withRun<Protocol["Service"]>()
}

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolSocketServer = Effect.gen(function*() {
  const server = yield* SocketServer.SocketServer
  const { onSocket, protocol } = yield* makeSocketProtocol
  yield* Effect.forkScoped(server.run(Effect.fnUntraced(onSocket, Effect.scoped)))
  return protocol
})

/**
 * A rpc protocol that uses `SocketServer` for communication.
 *
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolSocketServer: Layer.Layer<
  Protocol,
  never,
  RpcSerialization.RpcSerialization | SocketServer.SocketServer
> = Layer.effect(Protocol)(makeProtocolSocketServer)

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolWithHttpEffectWebsocket: Effect.Effect<
  {
    readonly protocol: Protocol["Service"]
    readonly httpEffect: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      never,
      Scope.Scope | HttpServerRequest.HttpServerRequest
    >
  },
  never,
  RpcSerialization.RpcSerialization
> = Effect.gen(function*() {
  const { onSocket, protocol } = yield* makeSocketProtocol

  const httpEffect: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    Scope.Scope | HttpServerRequest.HttpServerRequest
  > = Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const socket = yield* Effect.orDie(request.upgrade)
    yield* onSocket(socket, Object.entries(request.headers))
    return HttpServerResponse.empty()
  })

  return { protocol, httpEffect } as const
})

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolWebsocket: (
  options: {
    readonly path: HttpRouter.PathInput
  }
) => Effect.Effect<
  Protocol["Service"],
  never,
  RpcSerialization.RpcSerialization | HttpRouter.HttpRouter
> = Effect.fnUntraced(function*(options) {
  const { httpEffect, protocol } = yield* makeProtocolWithHttpEffectWebsocket
  const router = yield* HttpRouter.HttpRouter
  yield* router.add("GET", options.path, httpEffect)
  return protocol
})

/**
 * A rpc protocol that uses websockets for communication.
 *
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolWebsocket = (options: {
  readonly path: HttpRouter.PathInput
}): Layer.Layer<Protocol, never, RpcSerialization.RpcSerialization | HttpRouter.HttpRouter> => {
  return Layer.effect(Protocol)(makeProtocolWebsocket(options))
}

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolWithHttpEffect: Effect.Effect<
  {
    readonly protocol: Protocol["Service"]
    readonly httpEffect: Effect.Effect<
      HttpServerResponse.HttpServerResponse,
      never,
      Scope.Scope | HttpServerRequest.HttpServerRequest
    >
  },
  never,
  RpcSerialization.RpcSerialization
> = Effect.gen(function*() {
  const serialization = yield* RpcSerialization.RpcSerialization
  const includesFraming = serialization.includesFraming
  const isBinary = !serialization.contentType.includes("json")

  const disconnects = yield* Queue.make<number>()
  let writeRequest!: (clientId: number, message: FromClientEncoded) => Effect.Effect<void>

  let clientId = 0

  type Client = {
    readonly write: (bytes: FromServerEncoded) => Effect.Effect<void>
    readonly end: Effect.Effect<void>
  }
  const clients = new Map<number, Client>()
  const clientIds = new Set<number>()

  const encoder = new TextEncoder()

  const httpEffect: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    Scope.Scope | HttpServerRequest.HttpServerRequest
  > = Effect.gen(function*() {
    const fiber = Fiber.getCurrent()!
    const request = ServiceMap.getUnsafe(fiber.services, HttpServerRequest.HttpServerRequest)
    const scope = ServiceMap.getUnsafe(fiber.services, Scope.Scope)
    const requestHeaders = Object.entries(request.headers)
    const data = yield* Effect.orDie<string | Uint8Array, any, never>(
      isBinary ? Effect.map(request.arrayBuffer, (buf) => new Uint8Array(buf)) : request.text
    )
    const id = clientId++
    const queue = yield* Queue.make<Uint8Array | FromServerEncoded, Queue.Done>()
    const parser = serialization.makeUnsafe()

    const offer = (data: Uint8Array | string) =>
      typeof data === "string" ? Queue.offer(queue, encoder.encode(data)) : Queue.offer(queue, data)
    const client: Client = {
      write: !includesFraming ? ((response) => Queue.offer(queue, response)) : (response) => {
        try {
          const encoded = parser.encode(response)
          if (encoded === undefined) return Effect.void
          return offer(encoded)
        } catch (cause) {
          return offer(parser.encode(ResponseDefectEncoded(cause))!)
        }
      },
      end: Queue.end(queue)
    }

    yield* Scope.addFinalizerExit(scope, () => {
      clients.delete(id)
      clientIds.delete(id)
      Queue.offerUnsafe(disconnects, id)
      if (queue.state._tag === "Done") return Effect.void
      return Effect.forEach(
        requestIds,
        (requestId) => writeRequest(id, { _tag: "Interrupt", requestId: String(requestId) }),
        { discard: true }
      )
    })
    clients.set(id, client)
    clientIds.add(id)

    const requestIds: Array<RequestId> = []

    try {
      const decoded = parser.decode(data) as ReadonlyArray<FromClientEncoded>
      for (let i = 0; i < decoded.length; i++) {
        const message = decoded[i]
        if (message._tag === "Request") {
          requestIds.push(RequestId(message.id))
          ;(message as Types.Mutable<RequestEncoded>).headers = requestHeaders.concat(
            message.headers
          )
        }
        yield* writeRequest(id, message)
      }
    } catch (cause) {
      yield* client.write(ResponseDefectEncoded(cause))
    }

    yield* writeRequest(id, constEof)

    if (!includesFraming) {
      const responses = yield* Queue.collect(queue)
      return HttpServerResponse.text(parser.encode(responses) as string, { contentType: serialization.contentType })
    }

    const initialChunk = yield* Queue.takeAll(queue) as any as Effect.Effect<NonEmptyReadonlyArray<Uint8Array>>
    if (queue.state._tag === "Done") {
      return HttpServerResponse.uint8Array(
        mergeUint8Arrays(initialChunk),
        { contentType: serialization.contentType }
      )
    }

    return HttpServerResponse.stream(
      Stream.fromArray(initialChunk).pipe(
        Stream.concat(
          Stream.fromQueue(queue as Queue.Dequeue<Uint8Array, Queue.Done>)
        )
      ),
      { contentType: serialization.contentType }
    )
  })

  const protocol = yield* Protocol.make((writeRequest_) => {
    writeRequest = writeRequest_
    return Effect.succeed({
      disconnects,
      send(clientId, response) {
        const client = clients.get(clientId)
        if (!client) return Effect.void
        return client.write(response)
      },
      end(clientId) {
        const client = clients.get(clientId)
        if (!client) return Effect.void
        return client.end
      },
      clientIds: Effect.sync(() => clientIds),
      initialMessage: Effect.succeedNone,
      supportsAck: false,
      supportsTransferables: false,
      supportsSpanPropagation: false,
      supportsStructuredClone: !serialization.jsonSerialization
    })
  })

  return { protocol, httpEffect } as const
})

const mergeUint8Arrays = (arrays: ReadonlyArray<Uint8Array>) => {
  if (arrays.length === 0) return new Uint8Array(0)
  if (arrays.length === 1) return arrays[0]
  const length = arrays.reduce((acc, arr) => acc + arr.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolHttp: (options: { readonly path: HttpRouter.PathInput }) => Effect.Effect<
  Protocol["Service"],
  never,
  RpcSerialization.RpcSerialization | HttpRouter.HttpRouter
> = Effect.fnUntraced(function*(options) {
  const { httpEffect, protocol } = yield* makeProtocolWithHttpEffect
  const router = yield* HttpRouter.HttpRouter
  yield* router.add("POST", options.path, httpEffect)
  return protocol
})

/**
 * A rpc protocol that uses websockets for communication.
 *
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolHttp = (options: {
  readonly path: HttpRouter.PathInput
}): Layer.Layer<Protocol, never, RpcSerialization.RpcSerialization | HttpRouter.HttpRouter> => {
  return Layer.effect(Protocol)(makeProtocolHttp(options))
}

/**
 * @since 4.0.0
 * @category http app
 */
export const toHttpEffect: <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
  } | undefined
) => Effect.Effect<
  Effect.Effect<HttpServerResponse.HttpServerResponse, never, Scope.Scope | HttpServerRequest.HttpServerRequest>,
  never,
  | Scope.Scope
  | RpcSerialization.RpcSerialization
  | Rpc.ToHandler<Rpcs>
  | Rpc.Middleware<Rpcs>
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
  }
) {
  const { httpEffect, protocol } = yield* makeProtocolWithHttpEffect
  yield* make(group, options).pipe(
    Effect.provideService(Protocol, protocol),
    Effect.forkScoped
  )
  return httpEffect
})

/**
 * @since 4.0.0
 * @category http app
 */
export const toHttpEffectWebsocket: <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
  } | undefined
) => Effect.Effect<
  Effect.Effect<HttpServerResponse.HttpServerResponse, never, Scope.Scope | HttpServerRequest.HttpServerRequest>,
  never,
  | Scope.Scope
  | RpcSerialization.RpcSerialization
  | Rpc.ToHandler<Rpcs>
  | Rpc.Middleware<Rpcs>
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly disableTracing?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
  }
) {
  const { httpEffect, protocol } = yield* makeProtocolWithHttpEffectWebsocket
  yield* make(group, options).pipe(
    Effect.provideService(Protocol, protocol),
    Effect.forkScoped
  )
  return httpEffect
})

/**
 * Create a protocol that uses the provided `Stream` and `Sink` for communication.
 *
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolStdio = Effect.fnUntraced(function*<EIn, EOut, RIn, ROut>(options: {
  readonly stdin: Stream.Stream<Uint8Array, EIn, RIn>
  readonly stdout: Sink.Sink<void, Uint8Array | string, unknown, EOut, ROut>
}) {
  const fiber = Fiber.getCurrent()!
  const serialization = yield* RpcSerialization.RpcSerialization

  return yield* Protocol.make(Effect.fnUntraced(function*(writeRequest) {
    const queue = yield* Queue.make<Uint8Array | string, Queue.Done>()
    const parser = serialization.makeUnsafe()

    yield* options.stdin.pipe(
      Stream.runForEach((data) => {
        const decoded = parser.decode(data) as ReadonlyArray<FromClientEncoded>
        if (decoded.length === 0) return Effect.void
        let i = 0
        return Effect.whileLoop({
          while: () => i < decoded.length,
          body: () => writeRequest(0, decoded[i++]),
          step: constVoid
        })
      }),
      Effect.sandbox,
      Effect.tapError(Effect.logError),
      Effect.retry(Schedule.spaced(500)),
      Effect.ensuring(Effect.forkDaemon(Fiber.interrupt(fiber), { startImmediately: true })),
      Effect.forkScoped
    )

    yield* Stream.fromQueue(queue).pipe(
      Stream.run(options.stdout),
      Effect.retry(Schedule.spaced(500)),
      Effect.forkScoped
    )

    return {
      disconnects: yield* Queue.make<number>(),
      send(_clientId, response) {
        const responseEncoded = parser.encode(response)
        if (responseEncoded === undefined) {
          return Effect.void
        }
        return Queue.offer(queue, responseEncoded)
      },
      end(_clientId) {
        return Queue.end(queue)
      },
      clientIds: Effect.succeed(new Set([0])),
      initialMessage: Effect.succeedNone,
      supportsAck: true,
      supportsTransferables: false,
      supportsSpanPropagation: true,
      supportsStructuredClone: !serialization.jsonSerialization
    }
  }))
})

/**
 * Create a protocol that uses the provided `Stream` and `Sink` for communication.
 *
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolStdio = <EIn, EOut, RIn, ROut>(options: {
  readonly stdin: Stream.Stream<Uint8Array, EIn, RIn>
  readonly stdout: Sink.Sink<void, Uint8Array | string, unknown, EOut, ROut>
}): Layer.Layer<Protocol, never, RpcSerialization.RpcSerialization | RIn | ROut> =>
  Layer.effect(Protocol)(makeProtocolStdio(options))

/**
 * Fiber id used to indicate client induced interrupts
 *
 * @since 4.0.0
 * @category Interruption
 */
export const fiberIdClientInterrupt = -499

// internal

const makeSocketProtocol: Effect.Effect<
  {
    readonly protocol: Protocol["Service"]
    readonly onSocket: (
      socket: Socket.Socket,
      headers?: ReadonlyArray<[string, string]>
    ) => Generator<
      | Effect.Effect<void, never, never>
      | Effect.Effect<Scope.Scope, never, Scope.Scope>
      | Effect.Effect<
        (chunk: Uint8Array | string | Socket.CloseEvent) => Effect.Effect<void, Socket.SocketError>,
        never,
        Scope.Scope
      >,
      void,
      any
    >
  },
  never,
  RpcSerialization.RpcSerialization
> = Effect.gen(function*() {
  const serialization = yield* RpcSerialization.RpcSerialization
  const disconnects = yield* Queue.make<number>()

  let clientId = 0
  const clients = new Map<number, {
    readonly write: (bytes: FromServerEncoded) => Effect.Effect<void>
  }>()
  const clientIds = new Set<number>()

  let writeRequest!: (clientId: number, message: FromClientEncoded) => Effect.Effect<void>

  const onSocket = function*(socket: Socket.Socket, headers?: ReadonlyArray<[string, string]>) {
    const scope = yield* Effect.scope
    const parser = serialization.makeUnsafe()
    const id = clientId++
    yield* Scope.addFinalizerExit(scope, () => {
      clients.delete(id)
      clientIds.delete(id)
      return Queue.offer(disconnects, id)
    })

    const writeRaw = yield* socket.writer
    const write = (response: FromServerEncoded) => {
      try {
        const encoded = parser.encode(response)
        if (encoded === undefined) {
          return Effect.void
        }
        return Effect.orDie(writeRaw(encoded))
      } catch (cause) {
        return Effect.orDie(
          writeRaw(parser.encode(ResponseDefectEncoded(cause))!)
        )
      }
    }
    clients.set(id, { write })
    clientIds.add(id)

    yield* socket.runRaw((data) => {
      try {
        const decoded = parser.decode(data) as ReadonlyArray<FromClientEncoded>
        if (decoded.length === 0) return Effect.void
        let i = 0
        return Effect.whileLoop({
          while: () => i < decoded.length,
          body() {
            const message = decoded[i++]
            if (message._tag === "Request" && headers) {
              ;(message as Types.Mutable<RequestEncoded>).headers = headers.concat(message.headers)
            }
            return writeRequest(id, message)
          },
          step: constVoid
        })
      } catch (cause) {
        return writeRaw(parser.encode(ResponseDefectEncoded(cause))!)
      }
    }).pipe(
      Effect.catchFilter((error) => error.reason === "Close" ? error : Filter.fail(error), () => Effect.void),
      Effect.orDie
    )
  }

  const protocol = yield* Protocol.make((writeRequest_) => {
    writeRequest = writeRequest_
    return Effect.succeed({
      disconnects,
      send: (clientId, response) => {
        const client = clients.get(clientId)
        if (!client) return Effect.void
        return Effect.orDie(client.write(response))
      },
      end(_clientId) {
        return Effect.void
      },
      clientIds: Effect.sync(() => clientIds),
      initialMessage: Effect.succeedNone,
      supportsAck: true,
      supportsTransferables: false,
      supportsSpanPropagation: true,
      supportsStructuredClone: !serialization.jsonSerialization
    })
  })

  return { protocol, onSocket } as const
})
