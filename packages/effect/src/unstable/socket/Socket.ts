/**
 * @since 4.0.0
 */
import type { NonEmptyReadonlyArray } from "../../collections/Array.ts"
import * as Data from "../../data/Data.ts"
import type { DurationInput } from "../../data/Duration.ts"
import * as Exit from "../../data/Exit.ts"
import * as Filter from "../../data/Filter.ts"
import { dual } from "../../data/Function.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Deferred from "../../Deferred.ts"
import * as Effect from "../../Effect.ts"
import * as FiberSet from "../../FiberSet.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Channel from "../../stream/Channel.ts"
import * as Pull from "../../stream/Pull.ts"

/** @internal */
export const TypeId = "~effect/socket/Socket"

/**
 * @since 4.0.0
 * @category guards
 */
export const isSocket = (u: unknown): u is Socket => Predicate.hasProperty(u, TypeId)

/**
 * @since 4.0.0
 * @category tags
 */
export const Socket: ServiceMap.Key<Socket, Socket> = ServiceMap.Key<Socket>("effect/socket/Socket")

/**
 * @since 4.0.0
 * @category models
 */
export interface Socket {
  readonly [TypeId]: typeof TypeId
  readonly run: <_, E = never, R = never>(
    handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void
  ) => Effect.Effect<void, SocketError | E, R>
  readonly runRaw: <_, E = never, R = never>(
    handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void
  ) => Effect.Effect<void, SocketError | E, R>
  readonly writer: Effect.Effect<
    (chunk: Uint8Array | string | CloseEvent) => Effect.Effect<void, SocketError>,
    never,
    Scope.Scope
  >
}

const CloseEventTypeId = "~effect/socket/Socket/CloseEvent"

/**
 * @since 4.0.0
 * @category models
 */
export class CloseEvent {
  /**
   * @since 4.0.0
   */
  readonly [CloseEventTypeId]: typeof CloseEventTypeId
  readonly code: number
  readonly reason?: string | undefined

  constructor(code = 1000, reason?: string) {
    this[CloseEventTypeId] = CloseEventTypeId
    this.code = code
    this.reason = reason
  }
  /**
   * @since 4.0.0
   */
  toString() {
    return this.reason ? `${this.code}: ${this.reason}` : `${this.code}`
  }
}

/**
 * @since 4.0.0
 * @category refinements
 */
export const isCloseEvent = (u: unknown): u is CloseEvent => Predicate.hasProperty(u, CloseEventTypeId)

/**
 * @since 4.0.0
 * @category type ids
 */
export const SocketErrorTypeId: unique symbol = Symbol.for("@effect/platform/Socket/SocketError")

/**
 * @since 4.0.0
 * @category type ids
 */
export type SocketErrorTypeId = typeof SocketErrorTypeId

/**
 * @since 4.0.0
 * @category refinements
 */
export const isSocketError = (u: unknown): u is SocketError => Predicate.hasProperty(u, SocketErrorTypeId)

/**
 * @since 4.0.0
 * @category errors
 */
export type SocketError = SocketGenericError | SocketCloseError

/**
 * @since 4.0.0
 * @category errors
 */
export class SocketGenericError extends Data.TaggedError("SocketError")<{
  readonly reason: "Write" | "Read" | "Open" | "OpenTimeout"
  readonly cause: unknown
}> {
  /**
   * @since 4.0.0
   */
  readonly [SocketErrorTypeId]: SocketErrorTypeId = SocketErrorTypeId

  /**
   * @since 4.0.0
   */
  override get message() {
    return `An error occurred during ${this.reason}`
  }
}

/**
 * @since 4.0.0
 * @category errors
 */
export class SocketCloseError extends Data.TaggedError("SocketError")<{
  readonly code: number
  readonly closeReason?: string | undefined
}> {
  /**
   * @since 4.0.0
   */
  readonly [SocketErrorTypeId]: SocketErrorTypeId = SocketErrorTypeId

  /**
   * @since 4.0.0
   */
  readonly reason: "Close" = "Close" as const

  /**
   * @since 4.0.0
   */
  static is(u: unknown): u is SocketCloseError {
    return isSocketError(u) && u.reason === "Close"
  }

  /**
   * @since 4.0.0
   */
  static isClean(isClean: (code: number) => boolean): <E>(u: E) => SocketCloseError | Filter.fail<E> {
    return function<E>(u: E) {
      return SocketCloseError.is(u) && isClean(u.code) ? u : Filter.fail(u)
    }
  }

  override get message() {
    if (this.closeReason) {
      return `${this.reason}: ${this.code}: ${this.closeReason}`
    }
    return `${this.reason}: ${this.code}`
  }
}

/**
 * @since 4.0.0
 * @category combinators
 */
export const toChannelMap = <IE, A>(
  self: Socket,
  f: (data: Uint8Array | string) => A
): Channel.Channel<
  NonEmptyReadonlyArray<A>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE
> =>
  Channel.fromTransform(Effect.fnUntraced(function*(upstream, scope) {
    const queue = yield* Queue.make<A, SocketError | IE | Queue.Done>()

    const writeScope = yield* Scope.fork(scope)
    const write = yield* Scope.provide(self.writer, writeScope)

    yield* upstream.pipe(
      Effect.flatMap(Effect.forEach(write, { discard: true })),
      Effect.forever({ autoYield: false }),
      Effect.catchCauseFilter(
        Pull.filterNoHalt,
        (cause) => Queue.failCause(queue, cause)
      ),
      Effect.ensuring(Scope.close(writeScope, Exit.void)),
      Effect.forkIn(scope)
    )

    yield* self.runRaw((data) => {
      Queue.offerUnsafe(queue, f(data))
    }).pipe(
      Queue.into(queue),
      Effect.forkIn(scope)
    )

    return Queue.toPullArray(queue)
  }))

/**
 * @since 4.0.0
 * @category combinators
 */
export const toChannel = <IE>(
  self: Socket
): Channel.Channel<
  NonEmptyReadonlyArray<Uint8Array>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE
> => {
  const encoder = new TextEncoder()
  return toChannelMap(self, (data) => typeof data === "string" ? encoder.encode(data) : data)
}

/**
 * @since 4.0.0
 * @category combinators
 */
export const toChannelString: {
  (encoding?: string | undefined): <IE>(self: Socket) => Channel.Channel<
    NonEmptyReadonlyArray<string>,
    SocketError | IE,
    void,
    NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
    IE
  >
  <IE>(
    self: Socket,
    encoding?: string | undefined
  ): Channel.Channel<
    NonEmptyReadonlyArray<string>,
    SocketError | IE,
    void,
    NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
    IE
  >
} = dual((args) => isSocket(args[0]), <IE>(
  self: Socket,
  encoding?: string | undefined
): Channel.Channel<
  NonEmptyReadonlyArray<string>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE
> => {
  const decoder = new TextDecoder(encoding)
  return toChannelMap(self, (data) => typeof data === "string" ? data : decoder.decode(data))
})

/**
 * @since 4.0.0
 * @category combinators
 */
export const toChannelWith = <IE = never>() =>
(
  self: Socket
): Channel.Channel<
  NonEmptyReadonlyArray<Uint8Array>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE
> => toChannel(self)

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeChannel = <IE = never>(): Channel.Channel<
  NonEmptyReadonlyArray<Uint8Array>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE,
  unknown,
  Socket
> => Channel.unwrap(Effect.map(Socket.asEffect(), toChannelWith<IE>()))

/**
 * @since 4.0.0
 */
export const defaultCloseCodeIsError = (code: number) => code !== 1000 && code !== 1006

/**
 * @since 4.0.0
 * @category tags
 */
export class WebSocket extends ServiceMap.Key<WebSocket, globalThis.WebSocket>()("~effect/socket/Socket/WebSocket") {}

/**
 * @since 4.0.0
 * @category tags
 */
export class WebSocketConstructor extends ServiceMap.Key<
  WebSocketConstructor,
  (url: string, protocols?: string | Array<string> | undefined) => globalThis.WebSocket
>()("@effect/platform/Socket/WebSocketConstructor") {}

/**
 * @since 4.0.0
 * @category layers
 */
export const layerWebSocketConstructorGlobal: Layer.Layer<WebSocketConstructor> = Layer.succeed(WebSocketConstructor)(
  (url, protocols) => new globalThis.WebSocket(url, protocols)
)

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeWebSocket = (url: string | Effect.Effect<string>, options?: {
  readonly closeCodeIsError?: ((code: number) => boolean) | undefined
  readonly openTimeout?: DurationInput | undefined
  readonly protocols?: string | Array<string> | undefined
}): Effect.Effect<Socket, never, WebSocketConstructor> =>
  fromWebSocket(
    Effect.acquireRelease(
      (typeof url === "string" ? Effect.succeed(url) : url).pipe(
        Effect.flatMap((url) => Effect.map(WebSocketConstructor.asEffect(), (f) => f(url, options?.protocols)))
      ),
      (ws) => Effect.sync(() => ws.close(1000))
    ),
    options
  )

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromWebSocket = <RO>(
  acquire: Effect.Effect<globalThis.WebSocket, SocketError, RO>,
  options?: {
    readonly closeCodeIsError?: ((code: number) => boolean) | undefined
    readonly openTimeout?: DurationInput | undefined
  } | undefined
): Effect.Effect<Socket, never, Exclude<RO, Scope.Scope>> =>
  Effect.withFiber((fiber) => {
    let currentWS: globalThis.WebSocket | undefined
    const latch = Effect.makeLatchUnsafe(false)
    const acquireContext = fiber.services as ServiceMap.ServiceMap<RO>
    const closeCodeIsError = options?.closeCodeIsError ?? defaultCloseCodeIsError

    const runRaw = <_, E, R>(handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void) =>
      Effect.scopedWith(Effect.fnUntraced(function*(scope) {
        const fiberSet = yield* FiberSet.make<any, E | SocketError>().pipe(
          Scope.provide(scope)
        )
        const ws = yield* Scope.provide(acquire, scope)
        const run = yield* Effect.provideService(FiberSet.runtime(fiberSet)<R>(), WebSocket, ws)
        let open = false

        function onMessage(event: MessageEvent) {
          if (event.data instanceof Blob) {
            return Effect.promise(() => event.data.arrayBuffer() as Promise<ArrayBuffer>).pipe(
              Effect.andThen((buffer) => handler(new Uint8Array(buffer))),
              run
            )
          }
          const result = handler(event.data)
          if (Effect.isEffect(result)) {
            run(result)
          }
        }
        function onError(cause: Event) {
          ws.removeEventListener("message", onMessage)
          ws.removeEventListener("close", onClose)
          Deferred.doneUnsafe(
            fiberSet.deferred,
            Effect.fail(new SocketGenericError({ reason: open ? "Read" : "Open", cause }))
          )
        }
        function onClose(event: globalThis.CloseEvent) {
          ws.removeEventListener("message", onMessage)
          ws.removeEventListener("error", onError)
          Deferred.doneUnsafe(
            fiberSet.deferred,
            Effect.fail(
              new SocketCloseError({
                code: event.code,
                closeReason: event.reason
              })
            )
          )
        }

        ws.addEventListener("close", onClose, { once: true })
        ws.addEventListener("error", onError, { once: true })
        ws.addEventListener("message", onMessage)

        if (ws.readyState !== 1) {
          const openDeferred = Deferred.makeUnsafe<void>()
          ws.addEventListener("open", () => {
            open = true
            Deferred.doneUnsafe(openDeferred, Effect.void)
          }, { once: true })
          yield* Deferred.await(openDeferred).pipe(
            Effect.timeoutOrElse({
              duration: options?.openTimeout ?? 10000,
              onTimeout: () =>
                Effect.fail(new SocketGenericError({ reason: "OpenTimeout", cause: "timeout waiting for \"open\"" }))
            }),
            Effect.raceFirst(FiberSet.join(fiberSet))
          )
        }
        open = true
        currentWS = ws
        yield* latch.open
        return yield* FiberSet.join(fiberSet).pipe(
          Effect.catchFilter(
            SocketCloseError.isClean((_) => !closeCodeIsError(_)),
            (_) => Effect.void
          )
        )
      })).pipe(
        Effect.updateServices((input: ServiceMap.ServiceMap<R>) => ServiceMap.merge(acquireContext, input)),
        Effect.ensuring(Effect.sync(() => {
          latch.closeUnsafe()
          currentWS = undefined
        }))
      )

    const encoder = new TextEncoder()
    const run = <_, E, R>(handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void) =>
      runRaw((data) =>
        typeof data === "string"
          ? handler(encoder.encode(data))
          : data instanceof Uint8Array
          ? handler(data)
          : handler(new Uint8Array(data))
      )

    const write = (chunk: Uint8Array | string | CloseEvent) =>
      latch.whenOpen(Effect.sync(() => {
        const ws = currentWS!
        if (isCloseEvent(chunk)) {
          ws.close(chunk.code, chunk.reason)
        } else {
          ws.send(chunk)
        }
      }))
    const writer = Effect.succeed(write)

    return Effect.succeed(Socket.of({
      [TypeId]: TypeId,
      run,
      runRaw,
      writer
    }))
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeWebSocketChannel = <IE = never>(
  url: string,
  options?: {
    readonly closeCodeIsError?: (code: number) => boolean
  }
): Channel.Channel<
  NonEmptyReadonlyArray<Uint8Array>,
  SocketError | IE,
  void,
  NonEmptyReadonlyArray<Uint8Array | string | CloseEvent>,
  IE,
  unknown,
  WebSocketConstructor
> =>
  Channel.unwrap(
    Effect.map(makeWebSocket(url, options), toChannelWith<IE>())
  )

/**
 * @since 4.0.0
 * @category layers
 */
export const layerWebSocket: (
  url: string | Effect.Effect<string>,
  options?: {
    readonly closeCodeIsError?: ((code: number) => boolean) | undefined
    readonly openTimeout?: DurationInput | undefined
    readonly protocols?: string | Array<string> | undefined
  } | undefined
) => Layer.Layer<Socket, never, WebSocketConstructor> = Layer.effect(Socket)(makeWebSocket)

/**
 * @since 4.0.0
 * @category fiber refs
 */
export const SendQueueCapacity = ServiceMap.Reference<number>("~effect/socket/Socket/SendQueueCapacity", {
  defaultValue: () => 16
})

/**
 * @since 4.0.0
 * @category models
 */
export interface InputTransformStream {
  readonly readable: ReadableStream<Uint8Array> | ReadableStream<string> | ReadableStream<Uint8Array | string>
  readonly writable: WritableStream<Uint8Array>
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const fromTransformStream = <R>(acquire: Effect.Effect<InputTransformStream, SocketError, R>, options?: {
  readonly closeCodeIsError?: (code: number) => boolean
}): Effect.Effect<Socket, never, Exclude<R, Scope.Scope>> =>
  Effect.withFiber((fiber) => {
    const latch = Effect.makeLatchUnsafe(false)
    let currentStream: {
      readonly stream: InputTransformStream
      readonly fiberSet: FiberSet.FiberSet<any, any>
    } | undefined
    const acquireServices = fiber.services as ServiceMap.ServiceMap<R>
    const closeCodeIsError = options?.closeCodeIsError ?? defaultCloseCodeIsError
    const runRaw = <_, E, R>(handler: (_: string | Uint8Array) => Effect.Effect<_, E, R> | void) =>
      Effect.scopedWith(Effect.fnUntraced(function*(scope) {
        const stream = yield* Scope.provide(acquire, scope)
        const reader = stream.readable.getReader()
        yield* Scope.addFinalizer(scope, Effect.promise(() => reader.cancel()))
        const fiberSet = yield* FiberSet.make<any, E | SocketError>().pipe(
          Scope.provide(scope)
        )
        const runFork = yield* FiberSet.runtime(fiberSet)<R>()

        yield* Effect.tryPromise({
          try: async () => {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                throw new SocketCloseError({ code: 1000 })
              }
              const result = handler(value)
              if (Effect.isEffect(result)) {
                runFork(result)
              }
            }
          },
          catch: (cause) => isSocketError(cause) ? cause : new SocketGenericError({ reason: "Read", cause })
        }).pipe(
          FiberSet.run(fiberSet)
        )

        currentStream = { stream, fiberSet }
        yield* latch.open

        return yield* FiberSet.join(fiberSet).pipe(
          Effect.catchFilter(
            SocketCloseError.isClean((_) => !closeCodeIsError(_)),
            (_) => Effect.void
          )
        )
      })).pipe(
        (_) => _,
        Effect.updateServices((input: ServiceMap.ServiceMap<R>) => ServiceMap.merge(acquireServices, input)),
        Effect.ensuring(Effect.sync(() => {
          latch.closeUnsafe()
          currentStream = undefined
        }))
      )

    const encoder = new TextEncoder()
    const run = <_, E, R>(handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void) =>
      runRaw((data) =>
        typeof data === "string"
          ? handler(encoder.encode(data))
          : handler(data)
      )

    const writers = new WeakMap<InputTransformStream, WritableStreamDefaultWriter<Uint8Array>>()
    const getWriter = (stream: InputTransformStream) => {
      let writer = writers.get(stream)
      if (!writer) {
        writer = stream.writable.getWriter()
        writers.set(stream, writer)
      }
      return writer
    }
    const write = (chunk: Uint8Array | string | CloseEvent) =>
      latch.whenOpen(Effect.suspend(() => {
        const { fiberSet, stream } = currentStream!
        if (isCloseEvent(chunk)) {
          return Deferred.fail(
            fiberSet.deferred,
            new SocketCloseError({ code: chunk.code, closeReason: chunk.reason })
          )
        }
        return Effect.promise(() => getWriter(stream).write(typeof chunk === "string" ? encoder.encode(chunk) : chunk))
      }))
    const writer = Effect.acquireRelease(
      Effect.succeed(write),
      () =>
        Effect.promise(async () => {
          if (!currentStream) return
          await getWriter(currentStream.stream).close()
        })
    )

    return Effect.succeed(Socket.of({
      [TypeId]: TypeId,
      run,
      runRaw,
      writer
    }))
  })
