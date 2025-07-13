/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.js"
import * as Exit from "../../Exit.js"
import * as Fiber from "../../Fiber.js"
import { dual } from "../../Function.js"
import * as Layer from "../../Layer.js"
import * as Option from "../../Option.js"
import * as Scope from "../../Scope.js"
import * as ServiceMap from "../../ServiceMap.js"
import * as Stream from "../../Stream.js"
import * as HttpBody from "./HttpBody.js"
import { type HttpMiddleware, tracer } from "./HttpMiddleware.js"
import type { HttpServerError } from "./HttpServerError.js"
import { causeResponse, clientAbortFiberId } from "./HttpServerError.js"
import { HttpServerRequest } from "./HttpServerRequest.js"
import * as Request from "./HttpServerRequest.js"
import type { HttpServerResponse } from "./HttpServerResponse.js"
import * as Response from "./HttpServerResponse.js"

const handledSymbol = Symbol.for("effect/http/HttpEffect/handled")

/**
 * @since 4.0.0
 * @category combinators
 */
export const toHandled = <E, R, EH, RH>(
  self: Effect.Effect<HttpServerResponse, E, R>,
  handleResponse: (
    request: HttpServerRequest,
    response: HttpServerResponse
  ) => Effect.Effect<unknown, EH, RH>,
  middleware?: HttpMiddleware | undefined
): Effect.Effect<void, never, Exclude<R | RH | HttpServerRequest, Scope.Scope>> => {
  const responded = Effect.flatMap(self, (response) => {
    const fiber = Fiber.getCurrent()!
    const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
    const handler = fiber.getRef(PreResponseHandlers)
    if (handler._tag === "None") {
      ;(request as any)[handledSymbol] = true
      return Effect.as(handleResponse(request, response), response)
    }
    return Effect.tap(handler.value(request, response), (response) => {
      ;(request as any)[handledSymbol] = true
      return handleResponse(request, response)
    })
  })

  const withErrorHandling = Effect.catchCause(
    responded,
    (cause) =>
      Effect.flatMap(causeResponse(cause), ([response, cause]) => {
        const fiber = Fiber.getCurrent()!
        const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
        const handler = fiber.getRef(PreResponseHandlers)
        if (handler._tag === "None") {
          ;(request as any)[handledSymbol] = true
          return Effect.flatMap(handleResponse(request, response), () => Effect.failCause(cause))
        }
        return Effect.flatMap(
          Effect.flatMap(handler.value(request, response), (response) => {
            ;(request as any)[handledSymbol] = true
            return handleResponse(request, response)
          }),
          () => Effect.failCause(cause)
        )
      })
  )

  const withMiddleware: Effect.Effect<
    unknown,
    E | EH | HttpServerError,
    HttpServerRequest | R | RH
  > = middleware === undefined ?
    tracer(withErrorHandling) :
    Effect.matchCauseEffect(middleware(tracer(withErrorHandling)), {
      onFailure: (cause): Effect.Effect<void, EH, RH> => {
        const fiber = Fiber.getCurrent()!
        const request = ServiceMap.unsafeGet(fiber.services, HttpServerRequest)
        if (handledSymbol in request) {
          return Effect.void
        }
        return Effect.matchCauseEffect(causeResponse(cause), {
          onFailure: (_cause) => handleResponse(request, Response.empty({ status: 500 })),
          onSuccess: ([response]) => handleResponse(request, response)
        })
      },
      onSuccess: (response): Effect.Effect<void, EH, RH> => {
        const fiber = Fiber.getCurrent()!
        const request = ServiceMap.unsafeGet(fiber.services, Request.HttpServerRequest)
        return handledSymbol in request ? Effect.void : handleResponse(request, response)
      }
    })

  return Effect.uninterruptible(scoped(withMiddleware)) as any
}

/**
 * If you want to finalize the http request scope elsewhere, you can use this
 * function to eject from the default scope closure.
 *
 * @since 4.0.0
 * @category Scope
 */
export const scopeDisableClose = (scope: Scope.Scope): void => {
  ejectedScopes.add(scope)
}

/**
 * @since 4.0.0
 * @category Scope
 */
export const scopeTransferToStream = (
  response: HttpServerResponse
): HttpServerResponse => {
  if (response.body._tag !== "Stream") {
    return response
  }
  const fiber = Fiber.getCurrent()!
  const scope = ServiceMap.unsafeGet(fiber.services, Scope.Scope) as Scope.Scope.Closeable
  scopeDisableClose(scope)
  return Response.setBody(
    response,
    HttpBody.stream(
      Stream.onExit(response.body.stream, (exit) => Scope.close(scope, exit)),
      response.body.contentType,
      response.body.contentLength
    )
  )
}

const ejectedScopes = new WeakSet<Scope.Scope>()

const scoped = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(Scope.make(), (scope) =>
    Effect.onExitInterruptible(Scope.provide(effect, scope), (exit) => {
      if (ejectedScopes.has(scope)) {
        return Effect.void
      }
      return Scope.close(scope, exit)
    }))

/**
 * @since 4.0.0
 * @category Pre-response handlers
 */
export type PreResponseHandler = (
  request: HttpServerRequest,
  response: HttpServerResponse
) => Effect.Effect<HttpServerResponse, HttpServerError>

/**
 * @since 4.0.0
 * @category Pre-response handlers
 */
export const PreResponseHandlers = ServiceMap.Reference<Option.Option<PreResponseHandler>>(
  "effect/http/HttpEffect/PreResponseHandlers",
  { defaultValue: Option.none }
)

/**
 * @since 4.0.0
 * @category fiber refs
 */
export const appendPreResponseHandler = (handler: PreResponseHandler): Effect.Effect<void> =>
  Effect.withFiber((fiber) => {
    const o = Option.match(fiber.getRef(PreResponseHandlers), {
      onNone: () => Option.some(handler),
      onSome: (prev) =>
        Option.some<PreResponseHandler>((request, response) =>
          Effect.flatMap(prev(request, response), (response) => handler(request, response))
        )
    })
    fiber.setServices(ServiceMap.add(fiber.services, PreResponseHandlers, o))
    return Effect.void
  })

/**
 * @since 4.0.0
 * @category fiber refs
 */
export const withPreResponseHandler: {
  (handler: PreResponseHandler): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, handler: PreResponseHandler): Effect.Effect<A, E, R>
} = dual<
  (handler: PreResponseHandler) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(self: Effect.Effect<A, E, R>, handler: PreResponseHandler) => Effect.Effect<A, E, R>
>(2, (self, handler) =>
  Effect.updateService(
    self,
    PreResponseHandlers,
    Option.match({
      onNone: () => Option.some(handler),
      onSome: (prev) =>
        Option.some((request, response) =>
          Effect.flatMap(prev(request, response), (response) => handler(request, response))
        )
    })
  ))

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWebHandlerWith = <R>(services: ServiceMap.ServiceMap<R>) => {
  return <E>(
    self: Effect.Effect<HttpServerResponse, E, R | HttpServerRequest | Scope.Scope>,
    middleware?: HttpMiddleware | undefined
  ): (request: Request, services?: ServiceMap.ServiceMap<never> | undefined) => Promise<globalThis.Response> => {
    const resolveSymbol = Symbol.for("@effect/platform/HttpApp/resolve")
    const httpApp = toHandled(self, (request, response) => {
      response = scopeTransferToStream(response)
      ;(request as any)[resolveSymbol](
        Response.toWeb(response, { withoutBody: request.method === "HEAD", services })
      )
      return Effect.void
    }, middleware)
    return (request: Request, reqServices?: ServiceMap.ServiceMap<never> | undefined): Promise<globalThis.Response> =>
      new Promise((resolve) => {
        const contextMap = new Map<string, any>(services.unsafeMap)
        if (ServiceMap.isServiceMap(reqServices)) {
          for (const [key, value] of reqServices.unsafeMap) {
            contextMap.set(key, value)
          }
        }
        const httpServerRequest = Request.fromWeb(request)
        contextMap.set(HttpServerRequest.key, httpServerRequest)
        ;(httpServerRequest as any)[resolveSymbol] = resolve
        const fiber = Effect.runForkWith(ServiceMap.unsafeMake(contextMap))(httpApp as any)
        request.signal?.addEventListener("abort", () => {
          fiber.unsafeInterrupt(clientAbortFiberId)
        }, { once: true })
      })
  }
}

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWebHandler: <E>(
  self: Effect.Effect<HttpServerResponse, E, HttpServerRequest | Scope.Scope>,
  middleware?: HttpMiddleware | undefined
) => (request: Request, services?: ServiceMap.ServiceMap<never> | undefined) => Promise<globalThis.Response> =
  toWebHandlerWith(ServiceMap.empty())

/**
 * @since 4.0.0
 * @category conversions
 */
export const toWebHandlerLayer = <E, R, RE>(
  self: Effect.Effect<HttpServerResponse, E, R | HttpServerRequest | Scope.Scope>,
  layer: Layer.Layer<R, RE>,
  middleware?: HttpMiddleware | undefined
): {
  readonly close: () => Promise<void>
  readonly handler: (request: Request, context?: ServiceMap.ServiceMap<never> | undefined) => Promise<Response>
} => {
  const scope = Effect.runSync(Scope.make())
  const close = () => Effect.runPromise(Scope.close(scope, Exit.void))
  const build = Effect.map(Layer.build(layer), (_) => toWebHandlerWith(_)(self, middleware))
  const runner = Effect.runPromise(Scope.provide(build, scope))
  const handler = (request: Request, context?: ServiceMap.ServiceMap<never> | undefined): Promise<Response> =>
    runner.then((handler) => handler(request, context))
  return { close, handler } as const
}
