/**
 * @since 4.0.0
 */
import type { Brand } from "../../Brand.ts"
import type { Effect } from "../../Effect.ts"
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../Stream.ts"
import type * as Types from "../../Types.ts"
import * as UndefinedOr from "../../UndefinedOr.ts"
import type { HttpMethod } from "../http/HttpMethod.ts"
import * as HttpRouter from "../http/HttpRouter.ts"
import type { HttpServerRequest } from "../http/HttpServerRequest.ts"
import type { HttpServerResponse } from "../http/HttpServerResponse.ts"
import type * as Multipart from "../http/Multipart.ts"
import { HttpApiSchemaError } from "./HttpApiError.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

const TypeId = "~effect/httpapi/HttpApiEndpoint"

/**
 * @since 4.0.0
 * @category guards
 */
export const isHttpApiEndpoint = (u: unknown): u is HttpApiEndpoint<any, any, any> => Predicate.hasProperty(u, TypeId)

/**
 * Represents an API endpoint. An API endpoint is mapped to a single route on
 * the underlying `HttpRouter`.
 *
 * @since 4.0.0
 * @category models
 */
export interface HttpApiEndpoint<
  out Name extends string,
  out Method extends HttpMethod,
  out Path extends string,
  out PathSchema extends Schema.Top = never,
  out UrlParams extends Schema.Top = never,
  out Payload extends Schema.Top = never,
  out Headers extends Schema.Top = never,
  out Success extends Schema.Top = typeof HttpApiSchema.NoContent,
  out Error extends Schema.Top = typeof HttpApiSchemaError,
  in out Middleware = never,
  out MiddlewareR = never
> extends Pipeable {
  readonly [TypeId]: {
    readonly _MiddlewareR: Types.Covariant<MiddlewareR>
  }
  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly pathSchema: PathSchema | undefined
  readonly urlParamsSchema: UrlParams | undefined
  readonly payloadSchema: Payload | undefined
  readonly headersSchema: Headers | undefined
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<ServiceMap.Service<Middleware, any>>

  /**
   * Add a prefix to the path of the endpoint.
   */
  prefix<const Prefix extends HttpRouter.PathInput>(
    prefix: Prefix
  ): HttpApiEndpoint<
    Name,
    Method,
    `${Prefix}${Path}`,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >

  /**
   * Add an `HttpApiMiddleware` to the endpoint.
   */
  middleware<I extends HttpApiMiddleware.AnyId, S>(middleware: ServiceMap.Service<I, S>): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    Middleware | I,
    HttpApiMiddleware.ApplyServices<I, MiddlewareR>
  >

  /**
   * Add an annotation on the endpoint.
   */
  annotate<I, S>(
    key: ServiceMap.Service<I, S>,
    value: Types.NoInfer<S>
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >

  /**
   * Merge the annotations of the endpoint with the provided service map.
   */
  annotateMerge<I>(
    annotations: ServiceMap.ServiceMap<I>
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any extends Pipeable {
  readonly [TypeId]: any
  readonly name: string
  readonly successSchema: Schema.Top
  readonly errorSchema: Schema.Top
}

/**
 * @since 4.0.0
 * @category models
 */
export interface AnyWithProps
  extends HttpApiEndpoint<string, HttpMethod, string, Schema.Top, Schema.Top, Schema.Top, Schema.Top, any, any>
{}

/**
 * @since 4.0.0
 * @category models
 */
export type Name<Endpoint> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Name
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Success
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Error
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type PathSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _PathSchema
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type UrlParamsSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _UrlParams
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type PayloadSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Payload
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type HeadersSchema<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Headers
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Middleware<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _M
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareProvides<Endpoint extends Any> = HttpApiMiddleware.Provides<Middleware<Endpoint>>

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareError<Endpoint extends Any> = HttpApiMiddleware.Error<Middleware<Endpoint>>

/**
 * @since 4.0.0
 * @category models
 */
export type Error<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Error["Type"] | HttpApiMiddleware.Error<Middleware<Endpoint>>
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorServicesEncode<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Error["EncodingServices"] | HttpApiMiddleware.ErrorServicesEncode<Middleware<Endpoint>>
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Request<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    & ([_PathSchema["Type"]] extends [never] ? {} : { readonly path: _PathSchema["Type"] })
    & ([_UrlParams["Type"]] extends [never] ? {} : { readonly urlParams: _UrlParams["Type"] })
    & ([_Payload["Type"]] extends [never] ? {}
      : _Payload["Type"] extends Brand<HttpApiSchema.MultipartStreamTypeId> ?
        { readonly payload: Stream.Stream<Multipart.Part, Multipart.MultipartError> }
      : { readonly payload: _Payload["Type"] })
    & ([_Headers] extends [never] ? {} : { readonly headers: _Headers["Type"] })
    & {
      readonly request: HttpServerRequest
      readonly endpoint: Endpoint
      readonly group: HttpApiGroup.AnyWithProps
    }
  : {}

/**
 * @since 4.0.0
 * @category models
 */
export type RequestRaw<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    & ([_PathSchema["Type"]] extends [never] ? {} : { readonly path: _PathSchema["Type"] })
    & ([_UrlParams["Type"]] extends [never] ? {} : { readonly urlParams: _UrlParams["Type"] })
    & ([_Headers["Type"]] extends [never] ? {} : { readonly headers: _Headers["Type"] })
    & {
      readonly request: HttpServerRequest
      readonly endpoint: Endpoint
      readonly group: HttpApiGroup.AnyWithProps
    }
  : {}

/**
 * @since 4.0.0
 * @category models
 */
export type ClientRequest<
  PathSchema extends Schema.Top,
  UrlParams extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  WithResponse extends boolean
> = (
  & ([PathSchema["Type"]] extends [void] ? {} : { readonly path: PathSchema["Type"] })
  & ([UrlParams["Type"]] extends [never] ? {} : { readonly urlParams: UrlParams["Type"] })
  & ([Headers["Type"]] extends [never] ? {} : { readonly headers: Headers["Type"] })
  & ([Payload["Type"]] extends [never] ? {}
    : Payload["Type"] extends infer P ?
      P extends Brand<HttpApiSchema.MultipartTypeId> | Brand<HttpApiSchema.MultipartStreamTypeId>
        ? { readonly payload: FormData }
      : { readonly payload: Schema.Schema.Type<Payload> }
    : { readonly payload: Payload })
) extends infer Req ? keyof Req extends never ? (void | { readonly withResponse?: WithResponse }) :
  Req & { readonly withResponse?: WithResponse } :
  void

/**
 * @since 4.0.0
 * @category models
 */
export type ServerServices<Endpoint> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    | _PathSchema["DecodingServices"]
    | _UrlParams["DecodingServices"]
    | _Payload["DecodingServices"]
    | _Headers["DecodingServices"]
    | _Success["EncodingServices"]
  // Error services are handled globally
  // | _Error["EncodingServices"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ClientServices<Endpoint> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    | _PathSchema["EncodingServices"]
    | _UrlParams["EncodingServices"]
    | _Payload["EncodingServices"]
    | _Headers["EncodingServices"]
    | _Success["DecodingServices"]
    | _Error["DecodingServices"]
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareServices<Endpoint> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _MR
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorServicesDecode<Endpoint> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Error["DecodingServices"] | HttpApiMiddleware.ErrorServicesDecode<Middleware<Endpoint>>
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Handler<Endpoint extends Any, E, R> = (
  request: Types.Simplify<Request<Endpoint>>
) => Effect<Endpoint["successSchema"]["Type"] | HttpServerResponse, Endpoint["errorSchema"]["Type"] | E, R>

/**
 * @since 4.0.0
 * @category models
 */
export type HandlerRaw<Endpoint extends Any, E, R> = (
  request: Types.Simplify<RequestRaw<Endpoint>>
) => Effect<Endpoint["successSchema"]["Type"] | HttpServerResponse, Endpoint["errorSchema"]["Type"] | E, R>

/**
 * @since 4.0.0
 * @category models
 */
export type WithName<Endpoints extends Any, Name extends string> = Extract<Endpoints, { readonly name: Name }>

/**
 * @since 4.0.0
 * @category models
 */
export type ExcludeName<Endpoints extends Any, Name extends string> = Exclude<Endpoints, { readonly name: Name }>

/**
 * @since 4.0.0
 * @category models
 */
export type HandlerWithName<Endpoints extends Any, Name extends string, E, R> = Handler<
  WithName<Endpoints, Name>,
  E,
  R
>

/**
 * @since 4.0.0
 * @category models
 */
export type HandlerRawWithName<Endpoints extends Any, Name extends string, E, R> = HandlerRaw<
  WithName<Endpoints, Name>,
  E,
  R
>

/**
 * @since 4.0.0
 * @category models
 */
export type SuccessWithName<Endpoints extends Any, Name extends string> = SuccessSchema<
  WithName<Endpoints, Name>
>["Type"]

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorWithName<Endpoints extends Any, Name extends string> = Error<WithName<Endpoints, Name>>

/**
 * @since 4.0.0
 * @category models
 */
export type ServerServicesWithName<Endpoints extends Any, Name extends string> = ServerServices<
  WithName<Endpoints, Name>
>

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareWithName<Endpoints extends Any, Name extends string> = Middleware<WithName<Endpoints, Name>>

/**
 * @since 4.0.0
 * @category models
 */
export type MiddlewareServicesWithName<Endpoints extends Any, Name extends string> = MiddlewareServices<
  WithName<Endpoints, Name>
>

/**
 * @since 4.0.0
 * @category models
 */
export type ExcludeProvided<Endpoints extends Any, Name extends string, R> = Exclude<
  R,
  | HttpRouter.Provided
  | HttpApiMiddleware.Provides<MiddlewareWithName<Endpoints, Name>>
>

/**
 * @since 4.0.0
 * @category models
 */
export type AddPrefix<Endpoint extends Any, Prefix extends HttpRouter.PathInput> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? HttpApiEndpoint<
    _Name,
    _Method,
    `${Prefix}${_Path}`,
    _PathSchema,
    _UrlParams,
    _Payload,
    _Headers,
    _Success,
    _Error,
    _M,
    _MR
  > :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type AddError<Endpoint extends Any, E extends Schema.Top> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? HttpApiEndpoint<
    _Name,
    _Method,
    _Path,
    _PathSchema,
    _UrlParams,
    _Payload,
    _Headers,
    _Success,
    _Error | E,
    _M,
    _MR
  > :
  never

/**
 * @since 4.0.0
 * @category models
 */
export type AddMiddleware<Endpoint extends Any, M extends HttpApiMiddleware.AnyId> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? HttpApiEndpoint<
    _Name,
    _Method,
    _Path,
    _PathSchema,
    _UrlParams,
    _Payload,
    _Headers,
    _Success,
    _Error,
    _M | M,
    HttpApiMiddleware.ApplyServices<M, _MR>
  > :
  never

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  prefix(this: AnyWithProps, prefix: HttpRouter.PathInput) {
    return makeProto({
      ...this,
      path: HttpRouter.prefixPath(this.path, prefix)
    })
  },
  middleware(this: AnyWithProps, middleware: HttpApiMiddleware.AnyKey) {
    return makeProto({
      ...this,
      middlewares: new Set([...this.middlewares, middleware as any])
    })
  },
  annotate(this: AnyWithProps, key: ServiceMap.Service<any, any>, value: any) {
    return makeProto({
      ...this,
      annotations: ServiceMap.add(this.annotations, key, value)
    })
  },
  annotateMerge(this: AnyWithProps, annotations: ServiceMap.ServiceMap<any>) {
    return makeProto({
      ...this,
      annotations: ServiceMap.merge(this.annotations, annotations)
    })
  }
}

function makeProto<
  Name extends string,
  Method extends HttpMethod,
  const Path extends string,
  PathSchema extends Schema.Top,
  UrlParams extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  Success extends Schema.Top,
  Error extends Schema.Top,
  Middleware,
  MiddlewareR
>(options: {
  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly pathSchema: PathSchema | undefined
  readonly urlParamsSchema: UrlParams | undefined
  readonly payloadSchema: Payload | undefined
  readonly headersSchema: Headers | undefined
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<ServiceMap.Service<Middleware, any>>
}): HttpApiEndpoint<
  Name,
  Method,
  Path,
  PathSchema,
  UrlParams,
  Payload,
  Headers,
  Success,
  Error,
  Middleware,
  MiddlewareR
> {
  return Object.assign(Object.create(Proto), options)
}

/**
 * Path params come from the router as `string` (optional params as `undefined`) and
 * must be encodable back into the URL path.
 *
 * We accept "struct fields" (`Record<string, Codec<...>>`) so we can both enforce
 * `Encoded` = `string | undefined` per field and reliably generate OpenAPI
 * `in: path` parameters by iterating object properties.
 *
 * @since 4.0.0
 * @category constraints
 */
export type PathSchemaContraint = Record<string, Schema.Codec<unknown, string | undefined, unknown, unknown>>

/**
 * URL search params can be repeated, so fields may encode to `string` or
 * `ReadonlyArray<string>` (or be missing).
 *
 * Kept as "struct fields" so OpenAPI can safely expand properties into
 * `in: query` parameters.
 *
 * @since 4.0.0
 * @category constraints
 */
export type UrlParamsSchemaContraint = Record<
  string,
  Schema.Codec<unknown, string | ReadonlyArray<string> | undefined, unknown, unknown>
>

/**
 * Payload schema depends on the HTTP method:
 * - for no-body methods, payload is modeled as query params, so each field must
 *   encode to `string | ReadonlyArray<string> | undefined` and OpenAPI can expand
 *   it into `in: query` parameters
 * - for body methods, payload may be any `Schema.Top` (or content-type keyed
 *   schemas) and OpenAPI uses `requestBody` instead of `parameters`
 *
 * @since 4.0.0
 * @category constraints
 */
export type PayloadSchemaContraint<Method extends HttpMethod> = Method extends HttpMethod.NoBody ? Record<
    string,
    Schema.Codec<unknown, string | ReadonlyArray<string> | undefined, unknown, unknown>
  > :
  SuccessSchemaContraint

/**
 * HTTP headers are string-valued (or missing).
 *
 * Kept as "struct fields" so OpenAPI can safely expand properties into
 * `in: header` parameters.
 *
 * @since 4.0.0
 * @category constraints
 */
export type HeadersSchemaContraint = Record<string, Schema.Codec<unknown, string | undefined, unknown, unknown>>

/**
 * @since 4.0.0
 * @category constraints
 */
export type SuccessSchemaContraint = Schema.Top | ReadonlyArray<Schema.Top>

/**
 * @since 4.0.0
 * @category constraints
 */
export type ErrorSchemaContraint = Schema.Top | ReadonlyArray<Schema.Top>

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <Method extends HttpMethod>(method: Method) =>
<
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<Method> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  }
): HttpApiEndpoint<
  Name,
  Method,
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> => {
  const successSchema: any = options?.success ?
    fieldsToSchema(options.success) :
    HttpApiSchema.NoContent

  const errorSchema: any = options?.error ?
    Array.isArray(options.error) ?
      HttpApiSchema.makeHttpApiContainer([...options.error, HttpApiSchemaError]) :
      HttpApiSchema.makeHttpApiContainer([options.error as Schema.Top, HttpApiSchemaError]) :
    HttpApiSchemaError

  const payloadSchema: any = UndefinedOr.map(
    options?.payload,
    (schema) => Array.isArray(schema) ? HttpApiSchema.makeHttpApiContainer(schema) : fieldsToSchema(schema)
  )

  return makeProto({
    name,
    path,
    method,
    pathSchema: UndefinedOr.map(options?.path, fieldsToSchema),
    urlParamsSchema: UndefinedOr.map(options?.urlParams, fieldsToSchema),
    payloadSchema,
    headersSchema: UndefinedOr.map(options?.headers, fieldsToSchema),
    successSchema,
    errorSchema,
    annotations: ServiceMap.empty(),
    middlewares: new Set()
  })
}

function fieldsToSchema<S>(schema: S): S extends Schema.Struct.Fields ? Schema.Struct<S> : S {
  return Schema.isSchema(schema) ? schema as any : Schema.Struct(schema as any) as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const get: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"GET"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "GET",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("GET")

/**
 * @since 4.0.0
 * @category constructors
 */
export const post: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"POST"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "POST",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("POST")

/**
 * @since 4.0.0
 * @category constructors
 */
export const put: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"PUT"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "PUT",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("PUT")

/**
 * @since 4.0.0
 * @category constructors
 */
export const patch: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"PATCH"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "PATCH",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("PATCH")

/**
 * @since 4.0.0
 * @category constructors
 */
export const del: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"DELETE"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "DELETE",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("DELETE")

/**
 * @since 4.0.0
 * @category constructors
 */
export const head: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"HEAD"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "HEAD",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("HEAD")

/**
 * @since 4.0.0
 * @category constructors
 */
export const options: <
  const Name extends string,
  const Path extends HttpRouter.PathInput,
  PathSchema extends PathSchemaContraint = never,
  UrlParams extends UrlParamsSchemaContraint = never,
  Payload extends PayloadSchemaContraint<"OPTIONS"> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly path?: PathSchema | undefined
    readonly urlParams?: UrlParams | undefined
    readonly payload?: Payload | undefined
    readonly headers?: Headers | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  } | undefined
) => HttpApiEndpoint<
  Name,
  "OPTIONS",
  Path,
  PathSchema extends Schema.Struct.Fields ? Schema.Struct<PathSchema> : PathSchema,
  UrlParams extends Schema.Struct.Fields ? Schema.Struct<UrlParams> : UrlParams,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> = make("OPTIONS")
