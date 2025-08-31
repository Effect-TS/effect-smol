/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Filter from "../../data/Filter.ts"
import * as Option from "../../data/Option.ts"
import type * as Struct from "../../data/Struct.ts"
import * as Effect from "../../Effect.ts"
import * as Exit from "../../Exit.ts"
import * as Fiber from "../../Fiber.ts"
import { constVoid, dual, identity } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import type { Span } from "../../observability/Tracer.ts"
import * as Queue from "../../Queue.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Serializer from "../../schema/Serializer.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import type { Mutable } from "../../types/Types.ts"
import * as Headers from "../http/Headers.ts"
import * as HttpBody from "../http/HttpBody.ts"
import * as HttpClient from "../http/HttpClient.ts"
import * as HttpClientRequest from "../http/HttpClientRequest.ts"
import * as Socket from "../socket/Socket.ts"
import * as Rpc from "./Rpc.ts"
import { RpcClientError } from "./RpcClientError.ts"
import type * as RpcGroup from "./RpcGroup.ts"
import type { FromClient, FromClientEncoded, FromServer, FromServerEncoded, Request } from "./RpcMessage.ts"
import { constPing, RequestId } from "./RpcMessage.ts"
import type * as RpcMiddleware from "./RpcMiddleware.ts"
import * as RpcSchema from "./RpcSchema.ts"
import * as RpcSerialization from "./RpcSerialization.ts"
import { withRun } from "./Utils.ts"

/**
 * @since 4.0.0
 * @category client
 */
export type RpcClient<Rpcs extends Rpc.Any, E = never> = Struct.Simplify<
  & RpcClient.From<RpcClient.NonPrefixed<Rpcs>, E, "">
  & {
    readonly [CurrentPrefix in RpcClient.Prefixes<Rpcs>]: RpcClient.From<
      RpcClient.Prefixed<Rpcs, CurrentPrefix>,
      E,
      CurrentPrefix
    >
  }
>

/**
 * @since 4.0.0
 * @category client
 */
export declare namespace RpcClient {
  /**
   * @since 4.0.0
   * @category client
   */
  export type Prefixes<Rpcs extends Rpc.Any> = Rpcs["_tag"] extends infer Tag
    ? Tag extends `${infer Prefix}.${string}` ? Prefix : never
    : never

  /**
   * @since 4.0.0
   * @category client
   */
  export type NonPrefixed<Rpcs extends Rpc.Any> = Exclude<Rpcs, { readonly _tag: `${string}.${string}` }>

  /**
   * @since 4.0.0
   * @category client
   */
  export type Prefixed<Rpcs extends Rpc.Any, Prefix extends string> = Extract<
    Rpcs,
    { readonly _tag: `${Prefix}.${string}` }
  >

  /**
   * @since 4.0.0
   * @category client
   */
  export type From<Rpcs extends Rpc.Any, E = never, Prefix extends string = ""> = {
    readonly [
      Current in Rpcs as Current["_tag"] extends `${Prefix}.${infer Method}` ? Method
        : Current["_tag"]
    ]: <
      const AsQueue extends boolean = false,
      const Discard = false
    >(
      input: Rpc.PayloadConstructor<Current>,
      options?: Rpc.Success<Current> extends Stream.Stream<infer _A, infer _E, infer _R> ? {
          readonly asQueue?: AsQueue | undefined
          readonly streamBufferSize?: number | undefined
          readonly headers?: Headers.Input | undefined
          readonly context?: ServiceMap.ServiceMap<never> | undefined
        } :
        {
          readonly headers?: Headers.Input | undefined
          readonly context?: ServiceMap.ServiceMap<never> | undefined
          readonly discard?: Discard | undefined
        }
    ) => Current extends Rpc.Rpc<
      infer _Tag,
      infer _Payload,
      infer _Success,
      infer _Error,
      infer _Middleware,
      infer _Requires
    > ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? AsQueue extends true ? Effect.Effect<
            Queue.Dequeue<_A["Type"], _E["Type"] | _Error["Type"] | E | _Middleware["error"]["Type"] | Queue.Done>,
            never,
            | Scope.Scope
            | _Payload["EncodingServices"]
            | _Success["DecodingServices"]
            | _Error["DecodingServices"]
            | _Middleware["error"]["DecodingServices"]
          >
        : Stream.Stream<
          _A["Type"],
          _E["Type"] | _Error["Type"] | E | _Middleware["error"]["Type"],
          | _Payload["EncodingServices"]
          | _Success["DecodingServices"]
          | _Error["DecodingServices"]
          | _Middleware["error"]["DecodingServices"]
        >
      : Effect.Effect<
        Discard extends true ? void : _Success["Type"],
        Discard extends true ? E : _Error["Type"] | E | _Middleware["error"]["Type"],
        | _Payload["EncodingServices"]
        | _Success["DecodingServices"]
        | _Error["DecodingServices"]
        | _Middleware["error"]["DecodingServices"]
      > :
      never
  }

  /**
   * @since 4.0.0
   * @category client
   */
  export type Flat<Rpcs extends Rpc.Any, E = never> = <
    const Tag extends Rpcs["_tag"],
    const AsQueue extends boolean = false,
    const Discard = false
  >(
    tag: Tag,
    payload: Rpc.PayloadConstructor<Rpc.ExtractTag<Rpcs, Tag>>,
    options?: Rpc.Success<Rpc.ExtractTag<Rpcs, Tag>> extends Stream.Stream<infer _A, infer _E, infer _R> ? {
        readonly asQueue?: AsQueue | undefined
        readonly streamBufferSize?: number | undefined
        readonly headers?: Headers.Input | undefined
        readonly context?: ServiceMap.ServiceMap<never> | undefined
      } :
      {
        readonly headers?: Headers.Input | undefined
        readonly context?: ServiceMap.ServiceMap<never> | undefined
        readonly discard?: Discard | undefined
      }
  ) => Rpc.ExtractTag<Rpcs, Tag> extends Rpc.Rpc<
    infer _Tag,
    infer _Payload,
    infer _Success,
    infer _Error,
    infer _Middleware,
    infer _Requires
  > ? [_Success] extends [RpcSchema.Stream<infer _A, infer _E>] ? AsQueue extends true ? Effect.Effect<
          Queue.Dequeue<_A["Type"], _E["Type"] | _Error["Type"] | E | _Middleware["error"]["Type"]>,
          never,
          | Scope.Scope
          | _Payload["EncodingServices"]
          | _Success["DecodingServices"]
          | _Error["DecodingServices"]
          | _Middleware["error"]["DecodingServices"]
        >
      : Stream.Stream<
        _A["Type"],
        _E["Type"] | _Error["Type"] | E | _Middleware["error"]["Type"],
        | _Payload["EncodingServices"]
        | _Success["DecodingServices"]
        | _Error["DecodingServices"]
        | _Middleware["error"]["DecodingServices"]
      >
    : Effect.Effect<
      Discard extends true ? void : _Success["Type"],
      Discard extends true ? E : _Error["Type"] | E | _Middleware["error"]["Type"],
      | _Payload["EncodingServices"]
      | _Success["DecodingServices"]
      | _Error["DecodingServices"]
      | _Middleware["error"]["DecodingServices"]
    > :
    never
}

/**
 * @since 4.0.0
 * @category client
 */
export type FromGroup<Group, E = never> = RpcClient<RpcGroup.Rpcs<Group>, E>

let requestIdCounter = BigInt(0)

/**
 * @since 4.0.0
 * @category client
 */
export const makeNoSerialization: <Rpcs extends Rpc.Any, E, const Flatten extends boolean = false>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options: {
    readonly onFromClient: (
      options: {
        readonly message: FromClient<Rpcs>
        readonly context: ServiceMap.ServiceMap<never>
        readonly discard: boolean
      }
    ) => Effect.Effect<void, E>
    readonly supportsAck?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly generateRequestId?: (() => RequestId) | undefined
    readonly disableTracing?: boolean | undefined
    readonly flatten?: Flatten | undefined
  }
) => Effect.Effect<
  {
    readonly client: Flatten extends true ? RpcClient.Flat<Rpcs, E> : RpcClient<Rpcs, E>
    readonly write: (message: FromServer<Rpcs>) => Effect.Effect<void>
  },
  never,
  Scope.Scope | Rpc.MiddlewareClient<Rpcs>
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any, E, const Flatten extends boolean = false>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options: {
    readonly onFromClient: (
      options: {
        readonly message: FromClient<Rpcs>
        readonly context: ServiceMap.ServiceMap<never>
        readonly discard: boolean
      }
    ) => Effect.Effect<void, E>
    readonly supportsAck?: boolean | undefined
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly generateRequestId?: (() => RequestId) | undefined
    readonly disableTracing?: boolean | undefined
    readonly flatten?: Flatten | undefined
  }
) {
  const spanPrefix = options?.spanPrefix ?? "RpcClient"
  const supportsAck = options?.supportsAck ?? true
  const disableTracing = options?.disableTracing ?? false
  const generateRequestId = options?.generateRequestId ?? (() => requestIdCounter++ as RequestId)

  const services = yield* Effect.services<Rpc.MiddlewareClient<Rpcs> | Scope.Scope>()
  const scope = ServiceMap.get(services, Scope.Scope)

  type ClientEntry = {
    readonly _tag: "Effect"
    readonly rpc: Rpc.AnyWithProps
    readonly context: ServiceMap.ServiceMap<never>
    resume: (_: Exit.Exit<any, any>) => void
  } | {
    readonly _tag: "Queue"
    readonly rpc: Rpc.AnyWithProps
    readonly queue: Queue.Queue<any, any>
    readonly scope: Scope.Scope
    readonly context: ServiceMap.ServiceMap<never>
  }
  const entries = new Map<RequestId, ClientEntry>()

  let isShutdown = false
  yield* Scope.addFinalizer(
    scope,
    Effect.withFiber((parent) => {
      isShutdown = true
      return clearEntries(Exit.interrupt(parent.id))
    })
  )

  const clearEntries = Effect.fnUntraced(function*(exit: Exit.Exit<never>) {
    for (const [id, entry] of entries) {
      entries.delete(id)
      if (entry._tag === "Queue") {
        yield* Queue.done(entry.queue, exit)
      } else {
        entry.resume(exit)
      }
    }
  })

  const onRequest = (rpc: Rpc.AnyWithProps) => {
    const isStream = RpcSchema.isStreamSchema(rpc.successSchema)
    const middleware = getRpcClientMiddleware(rpc)
    return (payload: any, opts?: {
      readonly asQueue?: boolean | undefined
      readonly streamBufferSize?: number | undefined
      readonly headers?: Headers.Input | undefined
      readonly context?: ServiceMap.ServiceMap<never> | undefined
      readonly discard?: boolean | undefined
    }) => {
      const headers = opts?.headers ? Headers.fromInput(opts.headers) : Headers.empty
      const context = opts?.context ?? ServiceMap.empty()
      if (!isStream) {
        const onRequest = (span: Span | undefined) =>
          onEffectRequest(
            rpc,
            middleware,
            span,
            rpc.payloadSchema.makeSync(payload),
            headers,
            context,
            opts?.discard ?? false
          )
        return disableTracing ? onRequest(undefined) : Effect.useSpan(
          `${spanPrefix}.${rpc._tag}`,
          { captureStackTrace: false, attributes: options.spanAttributes },
          onRequest
        )
      }
      const queue = onStreamRequest(
        rpc,
        middleware,
        rpc.payloadSchema.makeSync(payload),
        headers,
        opts?.streamBufferSize ?? 16,
        context
      )
      if (opts?.asQueue) return queue
      return Stream.unwrap(Effect.map(queue, Stream.fromQueue))
    }
  }

  const onEffectRequest = (
    rpc: Rpc.AnyWithProps,
    middleware: (
      send: (request: Request<Rpcs>) => Effect.Effect<any, E>,
      request: Request<Rpcs>
    ) => Effect.Effect<any, E>,
    span: Span | undefined,
    payload: any,
    headers: Headers.Headers,
    context: ServiceMap.ServiceMap<never>,
    discard: boolean
  ) =>
    Effect.withFiber<any, any, any>((parentFiber) => {
      if (isShutdown) {
        return Effect.interrupt
      }
      const id = generateRequestId()
      const send = middleware(
        (message) =>
          options.onFromClient({
            message,
            context,
            discard
          }),
        {
          _tag: "Request",
          id,
          tag: rpc._tag as Rpc.Tag<Rpcs>,
          payload,
          ...(span ?
            {
              traceId: span.traceId,
              spanId: span.spanId,
              sampled: span.sampled
            } :
            {}),
          headers: Headers.merge(parentFiber.getRef(CurrentHeaders), headers)
        }
      )
      if (discard) {
        return send
      }
      let fiber: Fiber.Fiber<any, any>
      return Effect.onInterrupt(
        Effect.callback<any, any>((resume) => {
          const entry: ClientEntry = {
            _tag: "Effect",
            rpc,
            context,
            resume(exit) {
              resume(exit)
              if (fiber && !fiber.pollUnsafe()) {
                parentFiber.currentScheduler.scheduleTask(() => {
                  fiber.interruptUnsafe(parentFiber.id)
                }, 0)
              }
            }
          }
          entries.set(id, entry)
          fiber = send.pipe(
            span ? Effect.withParentSpan(span) : identity,
            Effect.runForkWith(parentFiber.services)
          )
          fiber.addObserver((exit) => {
            if (exit._tag === "Failure") {
              return resume(exit)
            }
          })
        }),
        (interruptors) => {
          entries.delete(id)
          return Effect.andThen(
            Fiber.interrupt(fiber),
            sendInterrupt(id, Array.from(interruptors), context)
          )
        }
      )
    })

  const onStreamRequest = Effect.fnUntraced(function*(
    rpc: Rpc.AnyWithProps,
    middleware: (
      send: (request: Request<Rpcs>) => Effect.Effect<any, E>,
      request: Request<Rpcs>
    ) => Effect.Effect<any, E>,
    payload: any,
    headers: Headers.Headers,
    streamBufferSize: number,
    context: ServiceMap.ServiceMap<never>
  ) {
    if (isShutdown) {
      return yield* Effect.interrupt
    }

    const span = disableTracing ? undefined : yield* Effect.makeSpanScoped(`${spanPrefix}.${rpc._tag}`, {
      captureStackTrace: false,
      attributes: options.spanAttributes
    })
    const fiber = Fiber.getCurrent()!
    const id = generateRequestId()

    const scope = ServiceMap.getUnsafe(fiber.services, Scope.Scope)
    yield* Scope.addFinalizerExit(
      scope,
      (exit) => {
        if (!entries.has(id)) return Effect.void
        entries.delete(id)
        return sendInterrupt(
          id,
          Exit.isFailure(exit) ?
            Array.from(Cause.interruptors(exit.cause))
            : [],
          context
        )
      }
    )

    const queue = yield* Queue.bounded<any, any>(streamBufferSize)
    entries.set(id, {
      _tag: "Queue",
      rpc,
      queue,
      scope,
      context
    })

    yield* middleware(
      (message) =>
        options.onFromClient({
          message,
          context,
          discard: false
        }),
      {
        _tag: "Request",
        id,
        tag: rpc._tag as Rpc.Tag<Rpcs>,
        payload,
        ...(span ?
          {
            traceId: span.traceId,
            spanId: span.spanId,
            sampled: span.sampled
          } :
          {}),
        headers: Headers.merge(fiber.getRef(CurrentHeaders), headers)
      }
    ).pipe(
      span ? Effect.withParentSpan(span) : identity,
      Effect.catchCause((error) => Queue.failCause(queue, error)),
      Effect.interruptible,
      Effect.forkIn(scope, { startImmediately: true })
    )

    return queue
  })

  const getRpcClientMiddleware = (
    rpc: Rpc.AnyWithProps
  ): (
    send: (request: Request<Rpcs>) => Effect.Effect<any, E>,
    request: Request<Rpcs>
  ) => Effect.Effect<any, E> => {
    const middlewares: Array<RpcMiddleware.RpcMiddlewareClient> = []
    for (const tag of rpc.middlewares.values()) {
      const middleware = services.mapUnsafe.get(`${tag.key}/Client`)
      if (!middleware) continue
      middlewares.push(middleware)
    }

    if (middlewares.length === 0) {
      return (send, request) => send(request)
    }

    return function loop(
      send: (request: Request<Rpcs>) => Effect.Effect<any, E>,
      request: Request<Rpcs>,
      index = middlewares.length - 1
    ): Effect.Effect<any, E> {
      if (index === -1) {
        return send(request)
      }
      return middlewares[index]({
        rpc,
        request,
        next(request) {
          return loop(send, request, index - 1) as any
        }
      }) as Effect.Effect<any, E>
    }
  }

  const sendInterrupt = (
    requestId: RequestId,
    interruptors: ReadonlyArray<number>,
    context: ServiceMap.ServiceMap<never>
  ): Effect.Effect<void> =>
    Effect.callback<void>((resume) => {
      const parentFiber = Fiber.getCurrent()!
      const fiber = options.onFromClient({
        message: { _tag: "Interrupt", requestId, interruptors },
        context,
        discard: false
      }).pipe(
        Effect.timeout(1000),
        Effect.runForkWith(parentFiber.services)
      )
      fiber.addObserver(() => {
        resume(Effect.void)
      })
    })

  const write = (message: FromServer<Rpcs>): Effect.Effect<void> => {
    switch (message._tag) {
      case "Chunk": {
        const requestId = message.requestId
        const entry = entries.get(requestId)
        if (!entry || entry._tag !== "Queue") return Effect.void
        return Queue.offerAll(entry.queue, message.values).pipe(
          supportsAck
            ? Effect.flatMap(() =>
              options.onFromClient({
                message: { _tag: "Ack", requestId: message.requestId },
                context: entry.context,
                discard: false
              })
            )
            : identity,
          Effect.catchCause((cause) => Queue.done(entry.queue, Exit.failCause(cause)))
        )
      }
      case "Exit": {
        const requestId = message.requestId
        const entry = entries.get(requestId)
        if (!entry) return Effect.void
        entries.delete(requestId)
        if (entry._tag === "Effect") {
          entry.resume(message.exit)
          return Effect.void
        }
        return Queue.done(entry.queue, Exit.asVoid(message.exit))
      }
      case "Defect": {
        return clearEntries(Exit.die(message.defect))
      }
      case "ClientEnd": {
        return Effect.void
      }
    }
  }

  let client: any
  if (options.flatten) {
    const fns = new Map<string, any>()
    client = function client(tag: string, payload: any, options?: {}) {
      let fn = fns.get(tag)
      if (!fn) {
        fn = onRequest(group.requests.get(tag)! as any)
        fns.set(tag, fn)
      }
      return fn(payload, options)
    }
  } else {
    client = {}
    for (const rpc of group.requests.values()) {
      const dot = rpc._tag.indexOf(".")
      const prefix = dot === -1 ? undefined : rpc._tag.slice(0, dot)
      if (prefix !== undefined && !(prefix in client)) {
        ;(client as any)[prefix] = {} as Mutable<RpcClient.Prefixed<Rpcs, typeof prefix>>
      }
      const target = prefix !== undefined ? (client as any)[prefix] : client
      const tag = prefix !== undefined ? rpc._tag.slice(dot + 1) : rpc._tag
      target[tag] = onRequest(rpc as any)
    }
  }

  return { client, write } as const
})

/**
 * @since 4.0.0
 * @category client
 */
export const make: <Rpcs extends Rpc.Any, const Flatten extends boolean = false>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly generateRequestId?: (() => RequestId) | undefined
    readonly disableTracing?: boolean | undefined
    readonly flatten?: Flatten | undefined
  } | undefined
) => Effect.Effect<
  Flatten extends true ? RpcClient.Flat<Rpcs, RpcClientError> : RpcClient<Rpcs, RpcClientError>,
  never,
  Protocol | Rpc.MiddlewareClient<Rpcs> | Scope.Scope
> = Effect.fnUntraced(function*<Rpcs extends Rpc.Any, const Flatten extends boolean = false>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?: {
    readonly spanPrefix?: string | undefined
    readonly spanAttributes?: Record<string, unknown> | undefined
    readonly generateRequestId?: (() => RequestId) | undefined
    readonly disableTracing?: boolean | undefined
    readonly flatten?: Flatten | undefined
  } | undefined
) {
  const { run, send, supportsAck } = yield* Protocol

  type ClientEntry = {
    readonly rpc: Rpc.AnyWithProps
    readonly context: ServiceMap.ServiceMap<never>
    readonly schemas: RpcSchemas
  }
  const entries = new Map<RequestId, ClientEntry>()

  const { client, write } = yield* makeNoSerialization(group, {
    ...options,
    supportsAck,
    onFromClient({ message }) {
      switch (message._tag) {
        case "Request": {
          const rpc = group.requests.get(message.tag)! as any as Rpc.AnyWithProps
          // const collector = supportsTransferables ? Transferable.makeCollectorUnsafe() : undefined

          const fiber = Fiber.getCurrent()!

          const entry: ClientEntry = {
            rpc,
            context: fiber.services,
            schemas: rpcSchemas(rpc)
          }
          entries.set(message.id, entry)

          return entry.schemas.encodePayload(message.payload).pipe(
            Effect.provideServices(entry.context),
            Effect.orDie,
            Effect.flatMap((payload) =>
              send({
                ...message,
                id: String(message.id),
                payload,
                headers: Object.entries(message.headers)
              })
            )
          ) as Effect.Effect<void, RpcClientError>
        }
        case "Ack": {
          const entry = entries.get(message.requestId)
          if (!entry) return Effect.void
          return send({
            _tag: "Ack",
            requestId: String(message.requestId)
          }) as Effect.Effect<void, RpcClientError>
        }
        case "Interrupt": {
          const entry = entries.get(message.requestId)
          if (!entry) return Effect.void
          entries.delete(message.requestId)
          return send({
            _tag: "Interrupt",
            requestId: String(message.requestId)
          }) as Effect.Effect<void, RpcClientError>
        }
        case "Eof": {
          return Effect.void
        }
      }
    }
  })

  yield* run((message) => {
    switch (message._tag) {
      case "Chunk": {
        const requestId = RequestId(message.requestId)
        const entry = entries.get(requestId)
        if (!entry || !entry.schemas.decodeChunk) return Effect.void
        return entry.schemas.decodeChunk(message.values).pipe(
          Effect.provideServices(entry.context),
          Effect.orDie,
          Effect.flatMap((chunk) =>
            write({ _tag: "Chunk", clientId: 0, requestId: RequestId(message.requestId), values: chunk })
          ),
          Effect.onError((cause) =>
            write({
              _tag: "Exit",
              clientId: 0,
              requestId: RequestId(message.requestId),
              exit: Exit.failCause(cause)
            })
          )
        ) as Effect.Effect<void>
      }
      case "Exit": {
        const requestId = RequestId(message.requestId)
        const entry = entries.get(requestId)
        if (!entry) return Effect.void
        entries.delete(requestId)
        return entry.schemas.decodeExit(message.exit).pipe(
          Effect.provideServices(entry.context),
          Effect.orDie,
          Effect.matchCauseEffect({
            onSuccess: (exit) => write({ _tag: "Exit", clientId: 0, requestId, exit }),
            onFailure: (cause) => write({ _tag: "Exit", clientId: 0, requestId, exit: Exit.failCause(cause) })
          })
        ) as Effect.Effect<void>
      }
      case "Defect": {
        return write({ _tag: "Defect", clientId: 0, defect: decodeDefect(message.defect as any) })
      }
      case "ClientProtocolError": {
        const exit = Exit.fail(message.error)
        return Effect.forEach(
          entries.keys(),
          (requestId) => write({ _tag: "Exit", clientId: 0, requestId, exit: exit as any })
        )
      }
      default: {
        return Effect.void
      }
    }
  }).pipe(
    Effect.catchCause(Effect.logError),
    Effect.interruptible,
    Effect.forkScoped
  )

  return client
})

interface RpcSchemas {
  readonly decodeChunk:
    | ((chunk: ReadonlyArray<unknown>) => Effect.Effect<NonEmptyReadonlyArray<any>, Schema.SchemaError, unknown>)
    | undefined
  readonly encodePayload: (payload: any) => Effect.Effect<any, Schema.SchemaError, unknown>
  readonly decodeExit: (encoded: unknown) => Effect.Effect<Exit.Exit<any, any>, Schema.SchemaError, unknown>
}
const rpcSchemasCache = new WeakMap<Rpc.AnyWithProps, RpcSchemas>()
const rpcSchemas = (rpc: Rpc.AnyWithProps) => {
  if (rpcSchemasCache.has(rpc)) {
    return rpcSchemasCache.get(rpc)!
  }
  const streamSchemas = RpcSchema.getStreamSchemas(rpc.successSchema.ast)
  const entry: RpcSchemas = {
    decodeChunk: Option.isSome(streamSchemas) ?
      Schema.decodeUnknownEffect(Serializer.json(Schema.NonEmptyArray(streamSchemas.value.success))) :
      undefined,
    encodePayload: Schema.encodeEffect(Serializer.json(rpc.payloadSchema)),
    decodeExit: Schema.decodeUnknownEffect(Serializer.json(Rpc.exitSchema(rpc as any)))
  }
  rpcSchemasCache.set(rpc, entry)
  return entry
}

/**
 * @since 4.0.0
 * @category headers
 */
export const CurrentHeaders = ServiceMap.Reference<Headers.Headers>("effect/rpc/RpcClient/CurrentHeaders", {
  defaultValue: () => Headers.empty
})

/**
 * @since 4.0.0
 * @category headers
 */
export const withHeaders: {
  (headers: Headers.Input): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(effect: Effect.Effect<A, E, R>, headers: Headers.Input): Effect.Effect<A, E, R>
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, headers: Headers.Input): Effect.Effect<A, E, R> =>
    Effect.updateService(effect, CurrentHeaders, Headers.merge(Headers.fromInput(headers)))
)

/**
 * @since 4.0.0
 * @category protocol
 */
export class Protocol extends ServiceMap.Key<Protocol, {
  readonly run: (
    f: (data: FromServerEncoded) => Effect.Effect<void>
  ) => Effect.Effect<never>
  readonly send: (
    request: FromClientEncoded,
    transferables?: ReadonlyArray<globalThis.Transferable>
  ) => Effect.Effect<void, RpcClientError>
  readonly supportsAck: boolean
  readonly supportsTransferables: boolean
}>()("effect/rpc/RpcClient/Protocol") {
  /**
   * @since 4.0.0
   */
  static make = withRun<Protocol["Service"]>()
}

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolHttp = (client: HttpClient.HttpClient): Effect.Effect<
  Protocol["Service"],
  never,
  RpcSerialization.RpcSerialization
> =>
  Protocol.make(Effect.fnUntraced(function*(writeResponse) {
    const serialization = yield* RpcSerialization.RpcSerialization
    const isFramed = serialization.includesFraming

    const send = (request: FromClientEncoded): Effect.Effect<void, RpcClientError> => {
      if (request._tag !== "Request") {
        return Effect.void
      }

      const parser = serialization.makeUnsafe()

      const encoded = parser.encode(request)!
      const body = typeof encoded === "string" ?
        HttpBody.text(encoded, serialization.contentType) :
        HttpBody.uint8Array(encoded, serialization.contentType)

      if (!isFramed) {
        return client.post("", { body }).pipe(
          Effect.flatMap((r) => r.text),
          Effect.mapError((cause) =>
            new RpcClientError({
              reason: "Protocol",
              message: "Failed to send HTTP request",
              cause
            })
          ),
          Effect.flatMap((text) => {
            const u = parser.decode(text)
            if (!Array.isArray(u)) {
              return Effect.die(`Expected an array of responses, but got: ${u}`)
            }
            let i = 0
            return Effect.whileLoop({
              while: () => i < u.length,
              body: () => writeResponse(u[i++]),
              step: constVoid
            })
          })
        )
      }

      return client.post("", { body }).pipe(
        Effect.flatMap((r) =>
          Stream.runForEachArray(r.stream, (chunk) => {
            const responses = chunk.flatMap(parser.decode) as Array<FromServerEncoded>
            if (responses.length === 0) return Effect.void
            let i = 0
            return Effect.whileLoop({
              while: () => i < responses.length,
              body: () => writeResponse(responses[i++]),
              step: constVoid
            })
          })
        ),
        Effect.mapError((cause) =>
          new RpcClientError({
            reason: "Protocol",
            message: "Failed to send HTTP request",
            cause
          })
        )
      )
    }

    return {
      send,
      supportsAck: false,
      supportsTransferables: false
    }
  }))

/**
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolHttp = (options: {
  readonly url: string
  readonly transformClient?: <E, R>(client: HttpClient.HttpClient.With<E, R>) => HttpClient.HttpClient.With<E, R>
}): Layer.Layer<Protocol, never, RpcSerialization.RpcSerialization | HttpClient.HttpClient> =>
  Layer.effect(Protocol)(
    Effect.flatMap(
      HttpClient.HttpClient.asEffect(),
      (client) => {
        client = HttpClient.mapRequest(client, HttpClientRequest.prependUrl(options.url))
        return makeProtocolHttp(options.transformClient ? options.transformClient(client) : client)
      }
    )
  )

/**
 * @since 4.0.0
 * @category protocol
 */
export const makeProtocolSocket = (options?: {
  readonly retryTransientErrors?: boolean | undefined
}): Effect.Effect<
  Protocol["Service"],
  never,
  Scope.Scope | RpcSerialization.RpcSerialization | Socket.Socket
> =>
  Protocol.make(Effect.fnUntraced(function*(writeResponse) {
    const socket = yield* Socket.Socket
    const serialization = yield* RpcSerialization.RpcSerialization

    const write = yield* socket.writer

    let parser = serialization.makeUnsafe()

    const pinger = yield* makePinger(write(parser.encode(constPing)!))

    yield* Effect.suspend(() => {
      parser = serialization.makeUnsafe()
      pinger.reset()
      return socket.runRaw((message) => {
        try {
          const responses = parser.decode(message) as Array<FromServerEncoded>
          if (responses.length === 0) return
          let i = 0
          return Effect.whileLoop({
            while: () => i < responses.length,
            body: () => {
              const response = responses[i++]
              if (response._tag === "Pong") {
                pinger.onPong()
              }
              return writeResponse(response)
            },
            step: constVoid
          })
        } catch (defect) {
          return writeResponse({
            _tag: "ClientProtocolError",
            error: new RpcClientError({
              reason: "Protocol",
              message: "Error decoding message",
              cause: Cause.fail(defect)
            })
          })
        }
      }).pipe(
        Effect.raceFirst(Effect.flatMap(
          pinger.timeout,
          () =>
            Effect.fail(
              new Socket.SocketGenericError({
                reason: "OpenTimeout",
                cause: new Error("ping timeout")
              })
            )
        ))
      )
    }).pipe(
      Effect.flatMap(() => Effect.fail(new Socket.SocketCloseError({ code: 1000 }))),
      Effect.tapCause(
        (cause) => {
          const error = Cause.filterError(cause)
          if (
            options?.retryTransientErrors && Filter.isPass(error) &&
            (error.reason === "Open" || error.reason === "OpenTimeout")
          ) {
            return Effect.void
          }
          return writeResponse({
            _tag: "ClientProtocolError",
            error: new RpcClientError({
              reason: "Protocol",
              message: "Error in socket",
              cause: Cause.squash(cause)
            })
          })
        }
      ),
      Effect.retry(Schedule.spaced(1000)),
      Effect.annotateLogs({
        module: "RpcClient",
        method: "makeProtocolSocket"
      }),
      Effect.interruptible,
      Effect.forkScoped
    )

    return {
      send(request) {
        const encoded = parser.encode(request)
        if (encoded === undefined) return Effect.void
        return Effect.orDie(write(encoded))
      },
      supportsAck: true,
      supportsTransferables: false
    }
  }))

const makePinger = Effect.fnUntraced(function*<A, E, R>(writePing: Effect.Effect<A, E, R>) {
  let recievedPong = true
  const latch = Effect.makeLatchUnsafe()
  const reset = () => {
    recievedPong = true
    latch.closeUnsafe()
  }
  const onPong = () => {
    recievedPong = true
  }
  yield* Effect.suspend((): Effect.Effect<void, E, R> => {
    if (!recievedPong) return latch.open
    recievedPong = false
    return writePing
  }).pipe(
    Effect.delay("10 seconds"),
    Effect.ignore,
    Effect.forever,
    Effect.interruptible,
    Effect.forkScoped
  )
  return { timeout: latch.await, reset, onPong } as const
})

/**
 * @since 4.0.0
 * @category protocol
 */
export const layerProtocolSocket = (options?: {
  readonly retryTransientErrors?: boolean | undefined
}): Layer.Layer<
  Protocol,
  never,
  Socket.Socket | RpcSerialization.RpcSerialization
> => Layer.effect(Protocol)(makeProtocolSocket(options))

// internal

const decodeDefect = Schema.decodeSync(Schema.Defect)
