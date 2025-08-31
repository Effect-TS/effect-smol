/**
 * @since 1.0.0
 */
import type { Server as BunServer, ServerWebSocket } from "bun"
import * as Config from "effect/config/Config"
import type { ConfigError } from "effect/config/Config"
import type * as Record from "effect/data/Record"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberSet from "effect/FiberSet"
import * as Inspectable from "effect/interfaces/Inspectable"
import * as Layer from "effect/Layer"
import type * as FileSystem from "effect/platform/FileSystem"
import type * as Path from "effect/platform/Path"
import type * as Scope from "effect/Scope"
import * as ServiceMap from "effect/ServiceMap"
import * as Stream from "effect/stream/Stream"
import * as Cookies from "effect/unstable/http/Cookies"
import * as Etag from "effect/unstable/http/Etag"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as Headers from "effect/unstable/http/Headers"
import type { HttpClient } from "effect/unstable/http/HttpClient"
import * as HttpEffect from "effect/unstable/http/HttpEffect"
import * as IncomingMessage from "effect/unstable/http/HttpIncomingMessage"
import type { HttpMethod } from "effect/unstable/http/HttpMethod"
import type { HttpPlatform } from "effect/unstable/http/HttpPlatform"
import * as Server from "effect/unstable/http/HttpServer"
import * as Error from "effect/unstable/http/HttpServerError"
import * as ServerRequest from "effect/unstable/http/HttpServerRequest"
import type * as ServerResponse from "effect/unstable/http/HttpServerResponse"
import type * as Multipart from "effect/unstable/http/Multipart"
import * as UrlParams from "effect/unstable/http/UrlParams"
import * as Socket from "effect/unstable/socket/Socket"
import * as Platform from "./BunHttpPlatform.ts"
import * as BunMultipart from "./BunMultipart.ts"
import * as BunServices from "./BunServices.ts"
import * as BunStream from "./BunStream.ts"

/**
 * @since 1.0.0
 * @category Options
 */
export type ServeOptions<R extends { [K in keyof R]: Bun.RouterTypes.RouteValue<Extract<K, string>> }> =
  & (
    | Omit<Bun.ServeOptions, "fetch" | "error">
    | Bun.TLSServeOptions
    | Bun.UnixServeOptions
    | Bun.UnixTLSServeOptions
  )
  & { readonly routes?: R }

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make = Effect.fnUntraced(
  function*<R extends { [K in keyof R]: Bun.RouterTypes.RouteValue<Extract<K, string>> } = {}>(
    options: ServeOptions<R>
  ) {
    const handlerStack: Array<(request: Request, server: BunServer) => Response | Promise<Response>> = [
      function(_request, _server) {
        return new Response("not found", { status: 404 })
      }
    ]
    const server = Bun.serve<WebSocketContext, R>({
      ...options as Bun.WebSocketServeOptions<WebSocketContext>,
      fetch: handlerStack[0],
      websocket: {
        open(ws) {
          Deferred.doneUnsafe(ws.data.deferred, Exit.succeed(ws))
        },
        message(ws, message) {
          ws.data.run(message)
        },
        close(ws, code, closeReason) {
          Deferred.doneUnsafe(
            ws.data.closeDeferred,
            Socket.defaultCloseCodeIsError(code)
              ? Exit.fail(new Socket.SocketCloseError({ code, closeReason }))
              : Exit.void
          )
        }
      }
    })

    yield* Effect.addFinalizer(() => Effect.promise(() => server.stop()))

    return Server.make({
      address: { _tag: "TcpAddress", port: server.port!, hostname: server.hostname! },
      serve: Effect.fnUntraced(function*(httpApp, middleware) {
        const scope = yield* Effect.scope
        const services = yield* Effect.services<never>()
        const httpEffect = HttpEffect.toHandled(httpApp, (request, response) =>
          Effect.sync(() => {
            ;(request as BunServerRequest).resolve(makeResponse(request, response, services, scope))
          }), middleware)

        function handler(request: Request, server: BunServer) {
          return new Promise<Response>((resolve, _reject) => {
            const map = new Map(services.mapUnsafe)
            map.set(
              ServerRequest.HttpServerRequest.key,
              new BunServerRequest(request, resolve, removeHost(request.url), server)
            )
            const fiber = Fiber.runIn(Effect.runForkWith(ServiceMap.makeUnsafe<any>(map))(httpEffect), scope)
            request.signal.addEventListener("abort", () => {
              fiber.interruptUnsafe(Error.clientAbortFiberId)
            }, { once: true })
          })
        }

        yield* Effect.acquireRelease(
          Effect.sync(() => {
            handlerStack.push(handler)
            server.reload({ fetch: handler })
          }),
          () =>
            Effect.sync(() => {
              handlerStack.pop()
              server.reload({ fetch: handlerStack[handlerStack.length - 1] })
            })
        )
      })
    })
  }
)

const makeResponse = (
  request: ServerRequest.HttpServerRequest,
  response: ServerResponse.HttpServerResponse,
  services: ServiceMap.ServiceMap<never>,
  scope: Scope.Scope
): Response => {
  const fields: {
    headers: globalThis.Headers
    status?: number
    statusText?: string
  } = {
    headers: new globalThis.Headers(response.headers),
    status: response.status
  }

  if (!Cookies.isEmpty(response.cookies)) {
    for (const header of Cookies.toSetCookieHeaders(response.cookies)) {
      fields.headers.append("set-cookie", header)
    }
  }

  if (response.statusText !== undefined) {
    fields.statusText = response.statusText
  }

  if (request.method === "HEAD") {
    return new Response(undefined, fields)
  }
  response = HttpEffect.scopeTransferToStream(response)
  const body = response.body
  switch (body._tag) {
    case "Empty": {
      return new Response(undefined, fields)
    }
    case "Uint8Array":
    case "Raw": {
      if (body.body instanceof Response) {
        for (const [key, value] of fields.headers.entries()) {
          body.body.headers.set(key, value)
        }
        return body.body
      }
      return new Response(body.body as any, fields)
    }
    case "FormData": {
      return new Response(body.formData as any, fields)
    }
    case "Stream": {
      return new Response(
        Stream.toReadableStreamWith(
          Stream.unwrap(Effect.withFiber((fiber) => {
            Fiber.runIn(fiber, scope)
            return Effect.succeed(body.stream)
          })),
          services
        ),
        fields
      )
    }
  }
}

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerServer: <R extends { [K in keyof R]: Bun.RouterTypes.RouteValue<Extract<K, string>> }>(
  options: ServeOptions<R>
) => Layer.Layer<Server.HttpServer> = Layer.effect(Server.HttpServer)(make)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerHttpServices: Layer.Layer<
  | HttpPlatform
  | FileSystem.FileSystem
  | Etag.Generator
  | Path.Path
> = Layer.mergeAll(
  Platform.layer,
  Etag.layerWeak,
  BunServices.layer
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = <R extends { [K in keyof R]: Bun.RouterTypes.RouteValue<Extract<K, string>> }>(
  options: ServeOptions<R>
): Layer.Layer<
  | Server.HttpServer
  | HttpPlatform
  | FileSystem.FileSystem
  | Etag.Generator
  | Path.Path
> => Layer.mergeAll(layerServer(options), layerHttpServices)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerTest: Layer.Layer<
  Server.HttpServer | HttpPlatform | FileSystem.FileSystem | Etag.Generator | Path.Path | HttpClient
> = Server.layerTestClient.pipe(
  Layer.provide(FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ keepalive: false }))
  )),
  Layer.provideMerge(layer({ port: 0 }))
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerConfig = <R extends { [K in keyof R]: Bun.RouterTypes.RouteValue<Extract<K, string>> }>(
  options: Config.Wrap<ServeOptions<R>>
): Layer.Layer<
  Server.HttpServer | HttpPlatform | FileSystem.FileSystem | Etag.Generator | Path.Path,
  ConfigError
> =>
  Layer.mergeAll(
    Layer.effect(Server.HttpServer)(Effect.flatMap(Config.unwrap(options).asEffect(), make)),
    layerHttpServices
  )

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

interface WebSocketContext {
  readonly deferred: Deferred.Deferred<ServerWebSocket<WebSocketContext>>
  readonly closeDeferred: Deferred.Deferred<void, Socket.SocketError>
  readonly buffer: Array<Uint8Array | string>
  run: (_: Uint8Array | string) => void
}

function wsDefaultRun(this: WebSocketContext, _: Uint8Array | string) {
  this.buffer.push(_)
}

class BunServerRequest extends Inspectable.Class implements ServerRequest.HttpServerRequest {
  readonly [ServerRequest.TypeId]: ServerRequest.TypeId
  readonly [IncomingMessage.TypeId]: IncomingMessage.TypeId
  readonly source: Request
  public resolve: (response: Response) => void
  readonly url: string
  private bunServer: BunServer
  public headersOverride?: Headers.Headers | undefined
  private remoteAddressOverride?: string | undefined

  constructor(
    source: Request,
    resolve: (response: Response) => void,
    url: string,
    bunServer: BunServer,
    headersOverride?: Headers.Headers,
    remoteAddressOverride?: string
  ) {
    super()
    this[ServerRequest.TypeId] = ServerRequest.TypeId
    this[IncomingMessage.TypeId] = IncomingMessage.TypeId
    this.source = source
    this.resolve = resolve
    this.url = url
    this.bunServer = bunServer
    this.headersOverride = headersOverride
    this.remoteAddressOverride = remoteAddressOverride
  }
  toJSON(): unknown {
    return IncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: this.originalUrl
    })
  }
  modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    }
  ) {
    return new BunServerRequest(
      this.source,
      this.resolve,
      options.url ?? this.url,
      this.bunServer,
      options.headers ?? this.headersOverride,
      options.remoteAddress ?? this.remoteAddressOverride
    )
  }
  get method(): HttpMethod {
    return this.source.method.toUpperCase() as HttpMethod
  }
  get originalUrl() {
    return this.source.url
  }
  get remoteAddress(): string | undefined {
    return this.remoteAddressOverride ?? this.bunServer.requestIP(this.source)?.address
  }
  get headers(): Headers.Headers {
    this.headersOverride ??= Headers.fromInput(this.source.headers)
    return this.headersOverride
  }

  private cachedCookies: Record.ReadonlyRecord<string, string> | undefined
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies
    }
    return this.cachedCookies = Cookies.parseHeader(this.headers.cookie ?? "")
  }

  get stream(): Stream.Stream<Uint8Array, Error.RequestError> {
    return this.source.body
      ? BunStream.fromReadableStream({
        evaluate: () => this.source.body as any,
        onError: (cause) =>
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
      : Stream.fail(
        new Error.RequestError({
          request: this,
          reason: "RequestParseError",
          description: "can not create stream from empty body"
        })
      )
  }

  private textEffect: Effect.Effect<string, Error.RequestError> | undefined
  get text(): Effect.Effect<string, Error.RequestError> {
    if (this.textEffect) {
      return this.textEffect
    }
    this.textEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.text(),
        catch: (cause) =>
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
    ))
    return this.textEffect
  }

  get json(): Effect.Effect<unknown, Error.RequestError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => JSON.parse(_) as unknown,
        catch: (cause) =>
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      }))
  }

  get urlParamsBody(): Effect.Effect<UrlParams.UrlParams, Error.RequestError> {
    return Effect.flatMap(this.text, (_) =>
      Effect.try({
        try: () => UrlParams.fromInput(new URLSearchParams(_)),
        catch: (cause) =>
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      }))
  }

  private multipartEffect:
    | Effect.Effect<
      Multipart.Persisted,
      Multipart.MultipartError,
      Scope.Scope | FileSystem.FileSystem | Path.Path
    >
    | undefined
  get multipart(): Effect.Effect<
    Multipart.Persisted,
    Multipart.MultipartError,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  > {
    if (this.multipartEffect) {
      return this.multipartEffect
    }
    this.multipartEffect = Effect.runSync(Effect.cached(
      BunMultipart.persisted(this.source)
    ))
    return this.multipartEffect
  }

  get multipartStream(): Stream.Stream<Multipart.Part, Multipart.MultipartError> {
    return BunMultipart.stream(this.source)
  }

  private arrayBufferEffect: Effect.Effect<ArrayBuffer, Error.RequestError> | undefined
  get arrayBuffer(): Effect.Effect<ArrayBuffer, Error.RequestError> {
    if (this.arrayBufferEffect) {
      return this.arrayBufferEffect
    }
    this.arrayBufferEffect = Effect.runSync(Effect.cached(
      Effect.tryPromise({
        try: () => this.source.arrayBuffer(),
        catch: (cause) =>
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            cause
          })
      })
    ))
    return this.arrayBufferEffect
  }

  get upgrade(): Effect.Effect<Socket.Socket, Error.RequestError> {
    return Effect.callback<Socket.Socket, Error.RequestError>((resume) => {
      const deferred = Deferred.makeUnsafe<ServerWebSocket<WebSocketContext>>()
      const closeDeferred = Deferred.makeUnsafe<void, Socket.SocketError>()
      const semaphore = Effect.makeSemaphoreUnsafe(1)

      const success = this.bunServer.upgrade<WebSocketContext>(this.source, {
        data: {
          deferred,
          closeDeferred,
          buffer: [],
          run: wsDefaultRun
        }
      })
      if (!success) {
        resume(Effect.fail(
          new Error.RequestError({
            request: this,
            reason: "RequestParseError",
            description: "Not an upgradeable ServerRequest"
          })
        ))
        return
      }
      resume(Effect.map(Deferred.await(deferred), (ws) => {
        const write = (chunk: Uint8Array | string | Socket.CloseEvent) =>
          Effect.sync(() => {
            if (typeof chunk === "string") {
              ws.sendText(chunk)
            } else if (Socket.isCloseEvent(chunk)) {
              ws.close(chunk.code, chunk.reason)
            } else {
              ws.sendBinary(chunk)
            }

            return true
          })
        const writer = Effect.succeed(write)
        const runRaw = <R, E, _>(
          handler: (_: Uint8Array | string) => Effect.Effect<_, E, R> | void
        ): Effect.Effect<void, Socket.SocketError | E, R> =>
          FiberSet.make<any, E>().pipe(
            Effect.flatMap((set) =>
              FiberSet.runtime(set)<R>().pipe(
                Effect.flatMap((run) => {
                  function runRaw(data: Uint8Array | string) {
                    const result = handler(data)
                    if (Effect.isEffect(result)) {
                      run(result)
                    }
                  }
                  ws.data.run = runRaw
                  ws.data.buffer.forEach(runRaw)
                  ws.data.buffer.length = 0
                  return FiberSet.join(set)
                })
              )
            ),
            Effect.scoped,
            Effect.onExit((exit) => Effect.sync(() => ws.close(exit._tag === "Success" ? 1000 : 1011))),
            Effect.raceFirst(Deferred.await(closeDeferred)),
            semaphore.withPermits(1)
          )

        const encoder = new TextEncoder()
        const run = <R, E, _>(handler: (_: Uint8Array) => Effect.Effect<_, E, R> | void) =>
          runRaw((data) => typeof data === "string" ? handler(encoder.encode(data)) : handler(data))

        return Socket.Socket.of({
          [Socket.TypeId]: Socket.TypeId,
          run,
          runRaw,
          writer
        })
      }))
    })
  }
}

const removeHost = (url: string) => {
  if (url[0] === "/") {
    return url
  }
  const index = url.indexOf("/", url.indexOf("//") + 2)
  return index === -1 ? "/" : url.slice(index)
}
