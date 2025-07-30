/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Filter from "../../data/Filter.ts"
import * as Option from "../../data/Option.ts"
import type { ReadonlyRecord } from "../../data/Record.ts"
import * as Redacted from "../../data/Redacted.ts"
import * as Result from "../../data/Result.ts"
import * as Effect from "../../Effect.ts"
import * as Encoding from "../../encoding/Encoding.ts"
import * as Fiber from "../../Fiber.ts"
import { constFalse, identity } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Layer from "../../Layer.ts"
import type { FileSystem } from "../../platform/FileSystem.ts"
import type { Path } from "../../platform/Path.ts"
import * as AST from "../../schema/AST.ts"
import * as Issue from "../../schema/Issue.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import type { Covariant } from "../../types/Types.ts"
import type * as Etag from "../http/Etag.ts"
import * as HttpMethod from "../http/HttpMethod.ts"
import type { HttpPlatform } from "../http/HttpPlatform.ts"
import * as HttpRouter from "../http/HttpRouter.js"
import * as Request from "../http/HttpServerRequest.js"
import { HttpServerRequest } from "../http/HttpServerRequest.js"
import * as Response from "../http/HttpServerResponse.js"
import type { HttpServerResponse } from "../http/HttpServerResponse.js"
import * as Multipart from "../http/Multipart.ts"
import * as UrlParams from "../http/UrlParams.ts"
import type * as HttpApi from "./HttpApi.ts"
import type * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import { HttpApiDecodeError } from "./HttpApiError.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"
import type * as HttpApiSecurity from "./HttpApiSecurity.ts"
import * as OpenApi from "./OpenApi.ts"

/**
 * Register an `HttpApi` with a `HttpRouter`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const layer = <Id extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<Id, Groups>,
  options?: {
    readonly openapiPath?: `/${string}` | undefined
  }
): Layer.Layer<
  never,
  never,
  | Etag.Generator
  | HttpRouter.HttpRouter
  | FileSystem
  | HttpPlatform
  | Path
  | HttpApiGroup.ToService<Id, Groups>
  | HttpApiGroup.ErrorServicesEncode<Groups>
> => {
  const ApiErrorHandler = HttpRouter.middleware(makeErrorHandler(api)).layer as Layer.Layer<never>
  return HttpRouter.use(Effect.fnUntraced(function*(router) {
    const services = yield* Effect.services<
      | Etag.Generator
      | HttpRouter.HttpRouter
      | FileSystem
      | HttpPlatform
      | Path
    >()
    const routes: Array<HttpRouter.Route<any, any>> = []
    for (const group of Object.values(api.groups)) {
      const groupRoutes = services.unsafeMap.get(group.key) as Array<HttpRouter.Route<any, any>>
      if (groupRoutes === undefined) {
        return yield* Effect.die(`HttpApiGroup "${group.key}" not found`)
      }
      // eslint-disable-next-line no-restricted-syntax
      routes.push(...groupRoutes)
    }
    yield* (router.addAll(routes) as Effect.Effect<void>)
    if (options?.openapiPath) {
      const spec = OpenApi.fromApi(api)
      yield* router.add("GET", options.openapiPath, Effect.succeed(Response.unsafeJson(spec)))
    }
  })).pipe(
    Layer.provide(ApiErrorHandler)
  )
}

/**
 * Create a `Layer` that will implement all the endpoints in an `HttpApi`.
 *
 * An unimplemented `Handlers` instance is passed to the `build` function, which
 * you can use to add handlers to the group.
 *
 * You can implement endpoints using the `handlers.handle` api.
 *
 * @since 4.0.0
 * @category handlers
 */
export const group = <
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
  const Name extends HttpApiGroup.Name<Groups>,
  Return
>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  groupName: Name,
  build: (
    handlers: Handlers.FromGroup<HttpApiGroup.WithName<Groups, Name>>
  ) => Handlers.ValidateReturn<Return>
): Layer.Layer<
  HttpApiGroup.ApiGroup<ApiId, Name>,
  Handlers.Error<Return>,
  Exclude<Handlers.Context<Return>, Scope.Scope>
> =>
  Layer.effectServices(Effect.gen(function*() {
    const services = yield* Effect.services<any>()
    const group = api.groups[groupName]!
    const result = build(makeHandlers(group))
    const handlers: Handlers<any, any> = Effect.isEffect(result)
      ? (yield* result as Effect.Effect<any, any, any>)
      : result
    const routes: Array<HttpRouter.Route<any, any>> = []
    for (const item of handlers.handlers) {
      routes.push(handlerToRoute(item, services))
    }
    return ServiceMap.unsafeMake(new Map([[group.key, routes]]))
  })) as any

/**
 * @since 4.0.0
 * @category handlers
 */
export const HandlersTypeId: unique symbol = Symbol.for("@effect/platform/HttpApiBuilder/Handlers")

/**
 * @since 4.0.0
 * @category handlers
 */
export type HandlersTypeId = typeof HandlersTypeId

/**
 * Represents a handled `HttpApi`.
 *
 * @since 4.0.0
 * @category handlers
 */
export interface Handlers<
  R,
  Endpoints extends HttpApiEndpoint.Any = never
> extends Pipeable {
  readonly [HandlersTypeId]: {
    _Endpoints: Covariant<Endpoints>
  }
  readonly group: HttpApiGroup.AnyWithProps
  readonly handlers: Set<Handlers.Item<R>>

  /**
   * Add the implementation for an `HttpApiEndpoint` to a `Handlers` group.
   */
  handle<Name extends HttpApiEndpoint.Name<Endpoints>, R1>(
    name: Name,
    handler: HttpApiEndpoint.HandlerWithName<Endpoints, Name, HttpApiEndpoint.ErrorWithName<Endpoints, Name>, R1>,
    options?: { readonly uninterruptible?: boolean | undefined } | undefined
  ): Handlers<
    | R
    | HttpApiEndpoint.MiddlewareWithName<Endpoints, Name>
    | HttpApiEndpoint.ExcludeProvided<
      Endpoints,
      Name,
      R1 | HttpApiEndpoint.ContextWithName<Endpoints, Name>
    >,
    HttpApiEndpoint.ExcludeName<Endpoints, Name>
  >

  /**
   * Add the implementation for an `HttpApiEndpoint` to a `Handlers` group.
   * This version of the api allows you to return the full response object.
   */
  handleRaw<Name extends HttpApiEndpoint.Name<Endpoints>, R1>(
    name: Name,
    handler: HttpApiEndpoint.HandlerRawWithName<Endpoints, Name, HttpApiEndpoint.ErrorWithName<Endpoints, Name>, R1>,
    options?: { readonly uninterruptible?: boolean | undefined } | undefined
  ): Handlers<
    | R
    | HttpApiEndpoint.ExcludeProvided<
      Endpoints,
      Name,
      R1 | HttpApiEndpoint.ContextWithName<Endpoints, Name>
    >,
    HttpApiEndpoint.ExcludeName<Endpoints, Name>
  >
}

/**
 * @since 1.0.0
 * @category handlers
 */
export declare namespace Handlers {
  /**
   * @since 1.0.0
   * @category handlers
   */
  export interface Any {
    readonly [HandlersTypeId]: any
  }

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Item<R> = {
    readonly endpoint: HttpApiEndpoint.AnyWithProps
    readonly handler: HttpApiEndpoint.Handler<any, any, R>
    readonly withFullRequest: boolean
    readonly uninterruptible: boolean
  }

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type FromGroup<Group extends HttpApiGroup.Any> = Handlers<
    never,
    HttpApiGroup.Endpoints<Group>
  >

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type ValidateReturn<A> = A extends (
    | Handlers<
      infer _R,
      infer _Endpoints
    >
    | Effect.Effect<
      Handlers<
        infer _R,
        infer _Endpoints
      >,
      infer _EX,
      infer _RX
    >
  ) ? [_Endpoints] extends [never] ? A
    : `Endpoint not handled: ${HttpApiEndpoint.Name<_Endpoints>}` :
    `Must return the implemented handlers`

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Error<A> = A extends Effect.Effect<
    Handlers<
      infer _R,
      infer _Endpoints
    >,
    infer _EX,
    infer _RX
  > ? _EX :
    never

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Context<A> = A extends Handlers<
    infer _R,
    infer _Endpoints
  > ? _R :
    A extends Effect.Effect<
      Handlers<
        infer _R,
        infer _Endpoints
      >,
      infer _EX,
      infer _RX
    > ? _R | _RX :
    never
}

/**
 * @since 1.0.0
 * @category security
 */
export const securityDecode = <Security extends HttpApiSecurity.HttpApiSecurity>(
  self: Security
): Effect.Effect<
  HttpApiSecurity.HttpApiSecurity.Type<Security>,
  never,
  HttpServerRequest | Request.ParsedSearchParams
> => {
  switch (self._tag) {
    case "Bearer": {
      return Effect.map(
        HttpServerRequest.asEffect(),
        (request) => Redacted.make((request.headers.authorization ?? "").slice(bearerLen)) as any
      )
    }
    case "ApiKey": {
      const key = self.in === "header" ? self.key.toLowerCase() : self.key
      const schema = Schema.Struct({
        [key]: Schema.String
      })
      const decode: Effect.Effect<
        { readonly [x: string]: string; readonly [x: number]: string },
        Schema.SchemaError,
        Request.ParsedSearchParams | HttpServerRequest
      > = self.in === "query"
        ? Request.schemaSearchParams(schema)
        : self.in === "cookie"
        ? Request.schemaCookies(schema)
        : Request.schemaHeaders(schema)
      return Effect.match(decode, {
        onFailure: () => Redacted.make("") as any,
        onSuccess: (match) => Redacted.make(match[key])
      })
    }
    case "Basic": {
      const empty: HttpApiSecurity.HttpApiSecurity.Type<Security> = {
        username: "",
        password: Redacted.make("")
      } as any
      return HttpServerRequest.asEffect().pipe(
        Effect.flatMap((request) =>
          Encoding.decodeBase64String((request.headers.authorization ?? "").slice(basicLen)).asEffect()
        ),
        Effect.match({
          onFailure: () => empty,
          onSuccess: (header) => {
            const parts = header.split(":")
            if (parts.length !== 2) {
              return empty
            }
            return {
              username: parts[0],
              password: Redacted.make(parts[1])
            } as any
          }
        })
      )
    }
  }
}

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

const makeErrorHandler: <Id extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<Id, Groups>
) => Effect.Effect<
  (
    effect: Effect.Effect<HttpServerResponse, unknown>
  ) => Effect.Effect<HttpServerResponse, unknown, never>
> = Effect.fnUntraced(function*<
  Id extends string,
  Groups extends HttpApiGroup.Any
>(
  api: HttpApi.HttpApi<Id, Groups>
) {
  const services = yield* Effect.services<never>()
  const errorSchema = makeErrorSchema(api as any)
  const encodeError = Schema.encodeUnknownEffect(errorSchema)
  return (effect: Effect.Effect<HttpServerResponse, unknown>) =>
    Effect.catchCause(
      effect,
      (cause) =>
        Effect.matchEffect(Effect.provide(encodeError(Cause.squash(cause)), services), {
          onFailure: () => Effect.failCause(cause),
          onSuccess: Effect.succeed
        })
    )
})

const bearerLen = `Bearer `.length
const basicLen = `Basic `.length

const HandlersProto = {
  [HandlersTypeId]: {
    _Endpoints: identity
  },
  pipe() {
    return pipeArguments(this, arguments)
  },
  handle(
    this: Handlers<any, HttpApiEndpoint.Any>,
    name: string,
    handler: HttpApiEndpoint.Handler<any, any, any>,
    options?: { readonly uninterruptible?: boolean | undefined } | undefined
  ) {
    const endpoint = this.group.endpoints[name]
    this.handlers.add({
      endpoint,
      handler,
      withFullRequest: false,
      uninterruptible: options?.uninterruptible ?? false
    })
    return this
  },
  handleRaw(
    this: Handlers<any, HttpApiEndpoint.Any>,
    name: string,
    handler: HttpApiEndpoint.Handler<any, any, any>,
    options?: { readonly uninterruptible?: boolean | undefined } | undefined
  ) {
    const endpoint = this.group.endpoints[name]
    this.handlers.add({
      endpoint,
      handler,
      withFullRequest: true,
      uninterruptible: options?.uninterruptible ?? false
    })
    return this
  }
}

const makeHandlers = <R, Endpoints extends HttpApiEndpoint.Any>(
  group: HttpApiGroup.Any
): Handlers<R, Endpoints> => {
  const self = Object.create(HandlersProto)
  self.group = group
  self.handlers = new Set<Handlers.Item<R>>()
  return self
}

const handlerToRoute = (
  handler: Handlers.Item<any>,
  services: ServiceMap.ServiceMap<any>
): HttpRouter.Route<any, any> => {
  const endpoint = handler.endpoint
  const isMultipartStream = endpoint.payloadSchema.pipe(
    Option.map(({ ast }) => ast.annotations?.httpApiMultipartStream !== undefined),
    Option.getOrElse(constFalse)
  )
  const multipartLimits = endpoint.payloadSchema.pipe(
    Option.flatMapNullable(({ ast }) => ast.annotations?.httpApiMultipartStream ?? ast.annotations?.httpApiMultipart)
  )
  const decodePath = Option.map(endpoint.pathSchema, Schema.decodeUnknownEffect)
  const decodePayload = handler.withFullRequest || isMultipartStream
    ? Option.none()
    : Option.map(endpoint.payloadSchema, Schema.decodeUnknownEffect)
  const decodeHeaders = Option.map(endpoint.headersSchema, Schema.decodeUnknownEffect)
  const encodeSuccess = Schema.encodeEffect(makeSuccessSchema(endpoint.successSchema))
  return HttpRouter.route(
    endpoint.method,
    endpoint.path as HttpRouter.PathInput,
    applyMiddleware(
      endpoint,
      services,
      Effect.gen(function*() {
        const fiber = Fiber.getCurrent()!
        const services = fiber.services
        const httpRequest = ServiceMap.unsafeGet(services, HttpServerRequest)
        const routeContext = ServiceMap.unsafeGet(services, HttpRouter.RouteContext)
        const urlParams = ServiceMap.unsafeGet(services, Request.ParsedSearchParams)
        const request: any = { request: httpRequest }
        if (decodePath._tag === "Some") {
          request.path = yield* decodePath.value(routeContext.params)
        }
        if (decodePayload._tag === "Some") {
          request.payload = yield* Effect.flatMap(
            requestPayload(httpRequest, urlParams, multipartLimits),
            decodePayload.value
          )
        } else if (isMultipartStream) {
          request.payload = Option.match(multipartLimits, {
            onNone: () => httpRequest.multipartStream,
            onSome: (limits) => Stream.provideServices(httpRequest.multipartStream, Multipart.limitsServices(limits))
          })
        }
        if (decodeHeaders._tag === "Some") {
          request.headers = yield* decodeHeaders.value(httpRequest.headers)
        }
        if (endpoint.urlParamsSchema._tag === "Some") {
          const schema = endpoint.urlParamsSchema.value
          request.urlParams = yield* Schema.decodeUnknownEffect(schema)(normalizeUrlParams(urlParams, schema.ast))
        }
        const response = yield* handler.handler(request)
        return Response.isHttpServerResponse(response) ? response : yield* encodeSuccess(response)
      }).pipe(
        Effect.catchFilter(filterIsSchemaError, HttpApiDecodeError.refailSchemaError)
      )
    ),
    { uninterruptible: handler.uninterruptible }
  )
}

// TODO: Add type id to Schema.SchemaError
const filterIsSchemaError = Filter.instanceOf(Schema.SchemaError)

const requestPayload = (
  request: HttpServerRequest,
  urlParams: ReadonlyRecord<string, string | Array<string>>,
  multipartLimits: Option.Option<Multipart.withLimits.Options>
): Effect.Effect<
  unknown,
  never,
  | FileSystem
  | Path
  | Scope.Scope
> => {
  if (!HttpMethod.hasBody(request.method)) {
    return Effect.succeed(urlParams)
  }
  const contentType = request.headers["content-type"]
    ? request.headers["content-type"].toLowerCase().trim()
    : "application/json"
  if (contentType.includes("application/json")) {
    return Effect.orDie(request.json)
  } else if (contentType.includes("multipart/form-data")) {
    return Effect.orDie(Option.match(multipartLimits, {
      onNone: () => request.multipart,
      onSome: (limits) => Effect.provideServices(request.multipart, Multipart.limitsServices(limits))
    }))
  } else if (contentType.includes("x-www-form-urlencoded")) {
    return Effect.map(Effect.orDie(request.urlParamsBody), UrlParams.toRecord)
  } else if (contentType.startsWith("text/")) {
    return Effect.orDie(request.text)
  }
  return Effect.map(Effect.orDie(request.arrayBuffer), (buffer) => new Uint8Array(buffer))
}

const applyMiddleware = <A extends Effect.Effect<any, any, any>>(
  endpoint: HttpApiEndpoint.AnyWithProps,
  services: ServiceMap.ServiceMap<never>,
  handler: A
) => {
  for (const key_ of endpoint.middlewares) {
    const key = key_ as any as HttpApiMiddleware.AnyKey
    const service = services.unsafeMap.get(key_.key) as HttpApiMiddleware.HttpApiMiddleware<any, any, any>
    const apply = HttpApiMiddleware.SecurityTypeId in key
      ? makeSecurityMiddleware(key as any, service as any)
      : service
    handler = apply(handler) as A
  }
  return handler
}

const securityMiddlewareCache = new WeakMap<
  any,
  (effect: Effect.Effect<any, any, any>) => Effect.Effect<any, any, any>
>()

const makeSecurityMiddleware = (
  key: HttpApiMiddleware.AnyKeySecurity,
  service: HttpApiMiddleware.HttpApiMiddlewareSecurity<any, any, any, any>
): (effect: Effect.Effect<any, any, any>) => Effect.Effect<any, any, any> => {
  if (securityMiddlewareCache.has(key)) {
    return securityMiddlewareCache.get(key)!
  }

  const entries = Object.entries(key.security).map(([key, security]) => ({
    decode: securityDecode(security),
    middleware: service[key]
  }))
  if (entries.length === 0) {
    return identity
  }

  const middleware = Effect.fnUntraced(function*(handler: Effect.Effect<any, any, any>) {
    let lastResult: Result.Result<any, any> | undefined
    for (let i = 0; i < entries.length; i++) {
      const { decode, middleware } = entries[i]
      const result = yield* Effect.result(Effect.flatMap(decode, middleware))
      if (Result.isFailure(result)) {
        lastResult = result
        continue
      } else if (key.provides) {
        return yield* Effect.provideService(handler, key.provides, result.success)
      }
      return yield* handler
    }
    return yield* lastResult!.asEffect()
  })

  securityMiddlewareCache.set(key, middleware)
  return middleware
}

const responseSchema = Schema.declare(Response.isHttpServerResponse)

const makeSuccessSchema = (
  schema: Schema.Schema<any>
): Schema.Codec<unknown, HttpServerResponse> => {
  const schemas = new Set<Schema.Schema<any>>()
  HttpApiSchema.deunionize(schemas, schema)
  return Schema.Union(Array.from(schemas, toResponseSuccess)) as any
}

const makeErrorSchema = (
  api: HttpApi.AnyWithProps
): Schema.Codec<unknown, HttpServerResponse> => {
  const schemas = new Set<Schema.Schema<any>>()
  for (const group of Object.values(api.groups)) {
    for (const endpoint of Object.values(group.endpoints)) {
      HttpApiSchema.deunionize(schemas, endpoint.errorSchema)
      for (const middleware of endpoint.middlewares) {
        const key = middleware as any as HttpApiMiddleware.AnyKey
        HttpApiSchema.deunionize(schemas, key.error)
      }
    }
  }
  return Schema.Union(Array.from(schemas, toResponseError)) as any
}

const decodeForbidden = <A>(_: A) =>
  Effect.fail(new Issue.Forbidden(Option.some(_), { description: "Encode only schema" }))

const responseTransformation = <A, I, RD, RE>(
  getStatus: (ast: AST.AST) => number,
  schema: Schema.Codec<A, I, RD, RE>
) =>
  Transformation.transformOrFail({
    decode: decodeForbidden<HttpServerResponse>,
    encode(data: I) {
      const ast = schema.ast
      const isEmpty = HttpApiSchema.isVoid(ast)
      const status = getStatus(ast)
      if (isEmpty) {
        return Effect.succeed(Response.empty({ status }))
      }
      const encoding = HttpApiSchema.getEncoding(ast)
      switch (encoding.kind) {
        case "Json": {
          return Effect.mapError(
            Response.json(data, { status }),
            (error) => new Issue.InvalidType(ast, Option.some(error))
          )
        }
        case "Text": {
          return Effect.succeed(Response.text(data as any, {
            status,
            contentType: encoding.contentType
          }))
        }
        case "Uint8Array": {
          return Effect.succeed(Response.uint8Array(data as any, {
            status,
            contentType: encoding.contentType
          }))
        }
        case "UrlParams": {
          return Effect.succeed(Response.urlParams(data as any, { status }))
        }
      }
    }
  })

const toResponseSchema = (getStatus: (ast: AST.AST) => number) => {
  const cache = new WeakMap<AST.AST, Schema.Schema<any>>()
  return <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>
  ): Schema.Codec<A, HttpServerResponse, RD, RE> => {
    if (cache.has(schema.ast)) {
      return cache.get(schema.ast)! as any
    }
    // TODO: See if we can use the Serializer module here
    // const encoding = HttpApiSchema.getEncoding(schema.ast)
    // const serialized = encoding.kind === "Json"
    //   ? Serializer.json(schema)
    //   : encoding.kind === "UrlParams"
    //   ? Serializer.stringLeafJson(schema)
    //   : schema
    const transform = responseSchema.pipe(
      Schema.decodeTo(schema, responseTransformation(getStatus, schema))
    )
    cache.set(transform.ast, transform)
    return transform
  }
}

const toResponseSuccess = toResponseSchema(HttpApiSchema.getStatusSuccess)
const toResponseError = toResponseSchema(HttpApiSchema.getStatusError)

function isSingleStringType(ast: AST.AST, key?: PropertyKey): boolean {
  switch (ast._tag) {
    case "StringKeyword":
    case "LiteralType":
    case "TemplateLiteral":
    case "Enums":
      return true
    case "TypeLiteral": {
      if (key !== undefined) {
        const ps = ast.propertySignatures.find((ps) => ps.name === key)
        return ps !== undefined
          ? isSingleStringType(ps.type, key)
          : ast.indexSignatures.some((is) =>
            Schema.is(Schema.make(is.parameter) as any)(key) && isSingleStringType(is.type)
          )
      }
      return false
    }
    case "UnionType":
      return ast.types.some((type) => isSingleStringType(type, key))
    case "Suspend":
      return isSingleStringType(ast.thunk(), key)
  }
  return false
}

/**
 * Normalizes the url parameters so that if a key is expected to be an array,
 * a single string value is wrapped in an array.
 *
 * @internal
 */
export function normalizeUrlParams(
  params: ReadonlyRecord<string, string | Array<string>>,
  ast: AST.AST
): ReadonlyRecord<string, string | Array<string>> {
  const encodedAST = AST.encodedAST(ast)
  const out: Record<string, string | Array<string>> = {}
  for (const key in params) {
    const value = params[key]
    out[key] = Array.isArray(value) || isSingleStringType(encodedAST, key) ? value : [value]
  }
  return out
}
