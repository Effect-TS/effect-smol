/**
 * @since 1.0.0
 */
import { ServiceMap } from "effect"
import type * as Cause from "effect/Cause"
import * as Config from "effect/config/Config"
import type * as ConfigError from "effect/config/ConfigError"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import type { LazyArg } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as FileSystem from "effect/platform/FileSystem"
import type * as Path from "effect/platform/Path"
import type { ReadonlyRecord } from "effect/Record"
import * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Cookies from "effect/unstable/http/Cookies"
import * as Etag from "effect/unstable/http/Etag"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import type * as Headers from "effect/unstable/http/Headers"
import type { HttpClient } from "effect/unstable/http/HttpClient"
import * as HttpEffect from "effect/unstable/http/HttpEffect"
import * as HttpIncomingMessage from "effect/unstable/http/HttpIncomingMessage"
import type { HttpMethod } from "effect/unstable/http/HttpMethod"
import type * as Middleware from "effect/unstable/http/HttpMiddleware"
import type * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import * as HttpServer from "effect/unstable/http/HttpServer"
import type { HttpServerError } from "effect/unstable/http/HttpServerError"
import {
  causeResponse,
  clientAbortFiberId,
  RequestError,
  ResponseError,
  ServeError
} from "effect/unstable/http/HttpServerError"
import * as Request from "effect/unstable/http/HttpServerRequest"
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest"
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse"
import type * as Multipart from "effect/unstable/http/Multipart"
import * as Socket from "effect/unstable/socket/Socket"
import * as Http from "node:http"
import type * as Net from "node:net"
import type { Duplex } from "node:stream"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { NodeHttpIncomingMessage } from "./NodeHttpIncomingMessage.js"
import * as NodeHttpPlatform from "./NodeHttpPlatform.js"
import * as NodeMultipart from "./NodeMultipart.js"
import * as NodeServices from "./NodeServices.js"
import { NodeWS } from "./NodeSocket.js"

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = Effect.fnUntraced(function*(
  evaluate: LazyArg<Http.Server>,
  options: Net.ListenOptions
) {
  const scope = yield* Effect.scope
  const server = evaluate()
  yield* Scope.addFinalizer(
    scope,
    Effect.callback<void>((resume) => {
      if (!server.listening) {
        return resume(Effect.void)
      }
      server.close((error) => {
        if (error) {
          resume(Effect.die(error))
        } else {
          resume(Effect.void)
        }
      })
    })
  )

  yield* Effect.callback<void, ServeError>((resume) => {
    function onError(cause: Error) {
      resume(Effect.fail(new ServeError({ cause })))
    }
    server.on("error", onError)
    server.listen(options, () => {
      server.off("error", onError)
      resume(Effect.void)
    })
  })

  const address = server.address()!

  const wss = yield* Effect.acquireRelease(
    Effect.sync(() => new NodeWS.WebSocketServer({ noServer: true })),
    (wss) =>
      Effect.callback<void>((resume) => {
        wss.close(() => resume(Effect.void))
      })
  ).pipe(
    Scope.provide(scope),
    Effect.cached
  )

  return HttpServer.make({
    address: typeof address === "string" ?
      {
        _tag: "UnixAddress",
        path: address
      } :
      {
        _tag: "TcpAddress",
        hostname: address.address === "::" ? "0.0.0.0" : address.address,
        port: address.port
      },
    serve: Effect.fnUntraced(function*(httpApp, middleware) {
      const scope = yield* Effect.scope
      const handler = yield* (makeHandler(httpApp, {
        middleware: middleware as any,
        scope
      }) as Effect.Effect<(nodeRequest: Http.IncomingMessage, nodeResponse: Http.ServerResponse) => void>)
      const upgradeHandler = yield* makeUpgradeHandler(wss, httpApp, {
        middleware: middleware as any,
        scope
      })
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          server.off("request", handler)
          server.off("upgrade", upgradeHandler)
        })
      )
      server.on("request", handler)
      server.on("upgrade", upgradeHandler)
    })
  })
})

/**
 * @since 1.0.0
 * @category Handlers
 */
export const makeHandler = <
  R,
  E,
  App extends Effect.Effect<HttpServerResponse, any, any> = Effect.Effect<HttpServerResponse, E, R>
>(
  httpEffect: Effect.Effect<HttpServerResponse, E, R>,
  options: {
    readonly scope: Scope.Scope
    readonly middleware?: Middleware.HttpMiddleware.Applied<App, E, R> | undefined
  }
): Effect.Effect<
  (nodeRequest: Http.IncomingMessage, nodeResponse: Http.ServerResponse) => void,
  never,
  Exclude<Effect.Services<App>, HttpServerRequest | Scope.Scope>
> => {
  const handled = HttpEffect.toHandled(httpEffect, handleResponse, options.middleware as any)
  return Effect.map(Effect.services<any>(), (services) => {
    return function handler(
      nodeRequest: Http.IncomingMessage,
      nodeResponse: Http.ServerResponse
    ) {
      const map = new Map(services.unsafeMap)
      map.set(HttpServerRequest.key, new ServerRequestImpl(nodeRequest, nodeResponse))
      const fiber = Fiber.runIn(Effect.runForkWith(ServiceMap.unsafeMake<any>(map))(handled), options.scope)
      nodeResponse.on("close", () => {
        if (!nodeResponse.writableEnded) {
          fiber.unsafeInterrupt(clientAbortFiberId)
        }
      })
    }
  })
}

/**
 * @since 1.0.0
 * @category Handlers
 */
export const makeUpgradeHandler = <
  R,
  E,
  App extends Effect.Effect<HttpServerResponse, any, any> = Effect.Effect<HttpServerResponse, E, R>
>(
  lazyWss: Effect.Effect<NodeWS.WebSocketServer>,
  httpEffect: Effect.Effect<HttpServerResponse, E, R>,
  options: {
    readonly scope: Scope.Scope
    readonly middleware?: Middleware.HttpMiddleware.Applied<App, E, R> | undefined
  }
): Effect.Effect<
  (nodeRequest: Http.IncomingMessage, socket: Duplex, head: Buffer) => void,
  never,
  Exclude<Effect.Services<App>, HttpServerRequest | Scope.Scope>
> => {
  const handledApp = HttpEffect.toHandled(httpEffect, handleResponse, options.middleware as any)
  return Effect.map(Effect.services<any>(), (services) =>
    function handler(
      nodeRequest: Http.IncomingMessage,
      socket: Duplex,
      head: Buffer
    ) {
      let nodeResponse_: Http.ServerResponse | undefined = undefined
      const nodeResponse = () => {
        if (nodeResponse_ === undefined) {
          nodeResponse_ = new Http.ServerResponse(nodeRequest)
          nodeResponse_.assignSocket(socket as any)
          nodeResponse_.on("finish", () => {
            socket.end()
          })
        }
        return nodeResponse_
      }
      const upgradeEffect = Socket.fromWebSocket(Effect.flatMap(
        lazyWss,
        (wss) =>
          Effect.acquireRelease(
            Effect.callback<globalThis.WebSocket>((resume) =>
              wss.handleUpgrade(nodeRequest, socket, head, (ws) => {
                resume(Effect.succeed(ws as any))
              })
            ),
            (ws) => Effect.sync(() => ws.close())
          )
      ))
      const map = new Map(services.unsafeMap)
      map.set(HttpServerRequest.key, new ServerRequestImpl(nodeRequest, nodeResponse, upgradeEffect))
      const fiber = Fiber.runIn(Effect.runForkWith(ServiceMap.unsafeMake<any>(map))(handledApp), options.scope)
      socket.on("close", () => {
        if (!socket.writableEnded) {
          fiber.unsafeInterrupt(clientAbortFiberId)
        }
      })
    })
}

class ServerRequestImpl extends NodeHttpIncomingMessage<HttpServerError> implements HttpServerRequest {
  readonly [Request.TypeId]: Request.TypeId

  constructor(
    readonly source: Http.IncomingMessage,
    readonly response: Http.ServerResponse | LazyArg<Http.ServerResponse>,
    private upgradeEffect?: Effect.Effect<Socket.Socket, HttpServerError>,
    readonly url = source.url!,
    private headersOverride?: Headers.Headers,
    remoteAddressOverride?: string
  ) {
    super(source, (cause) =>
      new RequestError({
        request: this,
        reason: "RequestParseError",
        cause
      }), remoteAddressOverride)
    this[Request.TypeId] = Request.TypeId
  }

  private cachedCookies: ReadonlyRecord<string, string> | undefined
  get cookies() {
    if (this.cachedCookies) {
      return this.cachedCookies
    }
    return this.cachedCookies = Cookies.parseHeader(this.headers.cookie ?? "")
  }

  get resolvedResponse(): Http.ServerResponse {
    return typeof this.response === "function" ? this.response() : this.response
  }

  modify(
    options: {
      readonly url?: string | undefined
      readonly headers?: Headers.Headers | undefined
      readonly remoteAddress?: string | undefined
    }
  ) {
    return new ServerRequestImpl(
      this.source,
      this.response,
      this.upgradeEffect,
      options.url ?? this.url,
      options.headers ?? this.headersOverride,
      options.remoteAddress ?? this.remoteAddressOverride
    )
  }

  get originalUrl(): string {
    return this.source.url!
  }

  get method(): HttpMethod {
    return this.source.method!.toUpperCase() as HttpMethod
  }

  get headers(): Headers.Headers {
    this.headersOverride ??= this.source.headers as Headers.Headers
    return this.headersOverride
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
      NodeMultipart.persisted(this.source, this.source.headers)
    ))
    return this.multipartEffect
  }

  get multipartStream(): Stream.Stream<Multipart.Part, Multipart.MultipartError> {
    return NodeMultipart.stream(this.source, this.source.headers)
  }

  get upgrade(): Effect.Effect<Socket.Socket, HttpServerError> {
    return this.upgradeEffect ?? Effect.fail(
      new RequestError({
        request: this,
        reason: "RequestParseError",
        description: "not an upgradeable ServerRequest"
      })
    )
  }

  toString(): string {
    return `ServerRequest(${this.method} ${this.url})`
  }

  toJSON(): unknown {
    return HttpIncomingMessage.inspect(this, {
      _id: "HttpServerRequest",
      method: this.method,
      url: this.originalUrl
    })
  }
}

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerServer = (
  evaluate: LazyArg<Http.Server>,
  options: Net.ListenOptions
): Layer.Layer<HttpServer.HttpServer, ServeError> => Layer.effect(HttpServer.HttpServer, make(evaluate, options))

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerHttpServices: Layer.Layer<
  FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | Etag.Generator
> = Layer.mergeAll(
  NodeHttpPlatform.layer,
  Etag.layerWeak,
  NodeServices.layer
)

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = (
  evaluate: LazyArg<Http.Server>,
  options: Net.ListenOptions
): Layer.Layer<
  HttpServer.HttpServer | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | Etag.Generator,
  ServeError
> =>
  Layer.mergeAll(
    layerServer(evaluate, options),
    layerHttpServices
  )

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerConfig = (
  evaluate: LazyArg<Http.Server>,
  options: Config.Wrap<Net.ListenOptions>
): Layer.Layer<
  HttpServer.HttpServer | FileSystem.FileSystem | Path.Path | HttpPlatform.HttpPlatform | Etag.Generator,
  ServeError | ConfigError.ConfigError
> =>
  Layer.mergeAll(
    Layer.effect(
      HttpServer.HttpServer,
      Effect.flatMap(Config.unwrap(options).asEffect(), (options) => make(evaluate, options))
    ),
    layerHttpServices
  )

/**
 * @since 1.0.0
 * @category Testing
 */
export const layerTest: Layer.Layer<
  | HttpServer.HttpServer
  | FileSystem.FileSystem
  | Path.Path
  | HttpPlatform.HttpPlatform
  | Etag.Generator
  | HttpClient,
  ServeError,
  never
> = HttpServer.layerTestClient.pipe(
  Layer.provide(
    Layer.fresh(FetchHttpClient.layer).pipe(
      Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { keepalive: false }))
    )
  ),
  Layer.provideMerge(layer(Http.createServer, { port: 0 }))
)

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

const handleResponse = (
  request: HttpServerRequest,
  response: HttpServerResponse
): Effect.Effect<void, HttpServerError> => {
  const nodeResponse = (request as ServerRequestImpl).resolvedResponse
  if (nodeResponse.writableEnded) {
    return Effect.void
  }

  let headers: Record<string, string | Array<string>> = response.headers
  if (!Cookies.isEmpty(response.cookies)) {
    headers = { ...headers }
    const toSet = Cookies.toSetCookieHeaders(response.cookies)
    if (headers["set-cookie"] !== undefined) {
      toSet.push(headers["set-cookie"] as string)
    }
    headers["set-cookie"] = toSet
  }

  if (request.method === "HEAD") {
    nodeResponse.writeHead(response.status, headers)
    return Effect.callback<void>((resume) => {
      nodeResponse.end(() => resume(Effect.void))
    })
  }
  const body = response.body
  switch (body._tag) {
    case "Empty": {
      nodeResponse.writeHead(response.status, headers)
      nodeResponse.end()
      return Effect.void
    }
    case "Raw": {
      nodeResponse.writeHead(response.status, headers)
      if (
        typeof body.body === "object" && body.body !== null && "pipe" in body.body &&
        typeof body.body.pipe === "function"
      ) {
        return Effect.tryPromise({
          try: (signal) => pipeline(body.body as any, nodeResponse, { signal, end: true }),
          catch: (cause) =>
            new ResponseError({
              request,
              response,
              description: "Error writing raw response",
              cause
            })
        }).pipe(
          Effect.interruptible,
          Effect.tapCause(handleCause(nodeResponse))
        )
      }
      return Effect.callback<void>((resume) => {
        nodeResponse.end(body.body, () => resume(Effect.void))
      })
    }
    case "Uint8Array": {
      nodeResponse.writeHead(response.status, headers)
      // If the body is less than 1MB, we skip the callback
      if (body.body.length < 1024 * 1024) {
        nodeResponse.end(body.body)
        return Effect.void
      }
      return Effect.callback<void>((resume) => {
        nodeResponse.end(body.body, () => resume(Effect.void))
      })
    }
    case "FormData": {
      return Effect.suspend(() => {
        const r = new globalThis.Response(body.formData)
        nodeResponse.writeHead(response.status, {
          ...headers,
          ...Object.fromEntries(r.headers)
        })
        return Effect.callback<void, HttpServerError>((resume, signal) => {
          Readable.fromWeb(r.body as any, { signal })
            .pipe(nodeResponse)
            .on("error", (cause) => {
              resume(Effect.fail(
                new ResponseError({
                  request,
                  response,
                  description: "Error writing FormData response",
                  cause
                })
              ))
            })
            .once("finish", () => {
              resume(Effect.void)
            })
        }).pipe(
          Effect.interruptible,
          Effect.tapCause(handleCause(nodeResponse))
        )
      })
    }
    case "Stream": {
      nodeResponse.writeHead(response.status, headers)
      return body.stream.pipe(
        Stream.orDie,
        Stream.runForEachChunk((array) =>
          Effect.callback<void>((resume) => {
            for (let i = 0; i < array.length - 1; i++) {
              nodeResponse.write(array[i])
            }
            nodeResponse.write(array[array.length - 1], () => resume(Effect.void))
          })
        ),
        Effect.interruptible,
        Effect.matchCauseEffect({
          onSuccess: () => Effect.sync(() => nodeResponse.end()),
          onFailure: handleCause(nodeResponse)
        })
      )
    }
  }
}

const handleCause = (nodeResponse: Http.ServerResponse) => <E>(cause: Cause.Cause<E>) =>
  causeResponse(cause).pipe(
    Effect.flatMap(([response, cause]) => {
      if (!nodeResponse.headersSent) {
        nodeResponse.writeHead(response.status)
      }
      if (!nodeResponse.writableEnded) {
        nodeResponse.end()
      }
      return Effect.failCause(cause)
    })
  )
