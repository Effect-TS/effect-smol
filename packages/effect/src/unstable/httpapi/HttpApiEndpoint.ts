/**
 * @since 4.0.0
 */
import type { Brand } from "../../data/Brand.ts"
import * as Option from "../../data/Option.ts"
import * as Predicate from "../../data/Predicate.ts"
import type { Simplify } from "../../data/Struct.ts"
import type { Effect } from "../../Effect.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import * as Schema from "../../schema/Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../stream/Stream.ts"
import type * as Types from "../../types/Types.ts"
import type { HttpMethod } from "../http/HttpMethod.ts"
import * as HttpRouter from "../http/HttpRouter.ts"
import type { HttpServerRequest } from "../http/HttpServerRequest.ts"
import type { HttpServerResponse } from "../http/HttpServerResponse.ts"
import type * as Multipart from "../http/Multipart.ts"
import type * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @since 4.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/httpapi/HttpApiEndpoint"

/**
 * @since 4.0.0
 * @category type ids
 */
export type TypeId = "~effect/httpapi/HttpApiEndpoint"

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
  in out Path extends string,
  in out PathSchema extends Schema.Top = never,
  in out UrlParams extends Schema.Top = never,
  in out Payload extends Schema.Top = never,
  in out Headers extends Schema.Top = never,
  in out Success extends Schema.Top = Schema.Void,
  in out Error extends Schema.Top = Schema.Never,
  in out Middleware = never,
  out MiddlewareR = never
> extends Pipeable {
  readonly [TypeId]: {
    readonly _MiddlewareR: Types.Covariant<MiddlewareR>
  }
  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly pathSchema: Option.Option<PathSchema>
  readonly urlParamsSchema: Option.Option<UrlParams>
  readonly payloadSchema: Option.Option<Payload>
  readonly headersSchema: Option.Option<Headers>
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<ServiceMap.Key<Middleware, any>>

  /**
   * Add a schema for the success response of the endpoint. The status code
   * will be inferred from the schema, otherwise it will default to 200.
   */
  addSuccess<S extends Schema.Top>(
    schema: S,
    annotations?: {
      readonly status?: number | undefined
    }
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Exclude<Success, Schema.Void> | S,
    Error,
    Middleware,
    MiddlewareR
  >

  /**
   * Add an error response schema to the endpoint. The status code
   * will be inferred from the schema, otherwise it will default to 500.
   */
  addError<E extends Schema.Top>(
    schema: E,
    annotations?: {
      readonly status?: number | undefined
    }
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    Headers,
    Success,
    Error | E,
    Middleware,
    MiddlewareR
  >

  /**
   * Set the schema for the request body of the endpoint. The schema will be
   * used to validate the request body before the handler is called.
   *
   * For endpoints with no request body, the payload will use the url search
   * parameters.
   *
   * You can set a multipart schema to handle file uploads by using the
   * `HttpApiSchema.Multipart` combinator.
   */
  setPayload<P extends Schema.Codec<any, PayloadConstraint<Method>, any, any>>(
    schema: P
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    P,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >

  /**
   * Set the schema for the path parameters of the endpoint. The schema will be
   * used to validate the path parameters before the handler is called.
   */
  setPath<PathSchema extends Schema.Codec<any, Readonly<Record<string, string | undefined>>, any, any>>(
    schema: PathSchema
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
   * Set the schema for the url search parameters of the endpoint.
   */
  setUrlParams<
    UrlParams extends Schema.Codec<
      any,
      Readonly<Record<string, string | ReadonlyArray<string> | undefined>>,
      any,
      any
    >
  >(schema: UrlParams): HttpApiEndpoint<
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
   * Set the schema for the headers of the endpoint. The schema will be
   * used to validate the headers before the handler is called.
   */
  setHeaders<H extends Schema.Codec<any, Readonly<Record<string, string | undefined>>, any, any>>(
    schema: H
  ): HttpApiEndpoint<
    Name,
    Method,
    Path,
    PathSchema,
    UrlParams,
    Payload,
    H,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >

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
  middleware<I extends HttpApiMiddleware.AnyId, S>(middleware: ServiceMap.Key<I, S>): HttpApiEndpoint<
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
    key: ServiceMap.Key<I, S>,
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
> ? _Error | HttpApiMiddleware.Error<Middleware<Endpoint>>
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
    & ([_Path] extends [never] ? {} : { readonly path: _PathSchema["Type"] })
    & ([_UrlParams] extends [never] ? {} : { readonly urlParams: _UrlParams["Type"] })
    & ([_Payload] extends [never] ? {}
      : _Payload extends Brand<HttpApiSchema.MultipartId> ?
        { readonly payload: Stream.Stream<Multipart.Part, Multipart.MultipartError> }
      : { readonly payload: _Payload["Type"] })
    & ([_Headers] extends [never] ? {} : { readonly headers: _Headers["Type"] })
    & { readonly request: HttpServerRequest }
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
    & ([_Path] extends [never] ? {} : { readonly path: _PathSchema["Type"] })
    & ([_UrlParams] extends [never] ? {} : { readonly urlParams: _UrlParams["Type"] })
    & ([_Headers] extends [never] ? {} : { readonly headers: _Headers["Type"] })
    & { readonly request: HttpServerRequest }
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
  & ([PathSchema] extends [void] ? {} : { readonly path: PathSchema["Type"] })
  & ([UrlParams] extends [never] ? {} : { readonly urlParams: UrlParams["Type"] })
  & ([Headers] extends [never] ? {} : { readonly headers: Headers["Type"] })
  & ([Payload] extends [never] ? {}
    : Payload extends infer P ?
      P extends Brand<HttpApiSchema.MultipartId> | Brand<HttpApiSchema.MultipartStreamId>
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
export type PayloadConstraint<Method extends HttpMethod> = Method extends HttpMethod.NoBody ?
  Readonly<Record<string, string | ReadonlyArray<string> | undefined>> :
  any

/**
 * @since 4.0.0
 * @category models
 */
export type ValidateParams<
  Schemas extends ReadonlyArray<Schema.Top>,
  Prev extends Schema.Top = never
> = Schemas extends [
  infer Head extends Schema.Top,
  ...infer Tail extends ReadonlyArray<Schema.Top>
] ? [
    Head extends HttpApiSchema.Param<infer _Name, infer _S>
      ? HttpApiSchema.Param<_Name, any> extends Prev ? `Duplicate param: ${_Name}`
      : [Head["Encoded"] & {}] extends [string] ? Head
      : `Must be encodeable to string: ${_Name}` :
      Head,
    ...ValidateParams<Tail, Prev | Head>
  ]
  : Schemas

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

/**
 * @since 4.0.0
 * @category models
 */
export type PathEntries<Schemas extends ReadonlyArray<Schema.Top>> = Extract<keyof Schemas, string> extends infer K ?
  K extends keyof Schemas ? Schemas[K] extends HttpApiSchema.Param<infer _Name, infer _S> ? [_Name, _S] :
    Schemas[K] extends Schema.Top ? [K, Schemas[K]]
    : never
  : never
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type ExtractPath<Schemas extends ReadonlyArray<Schema.Top>> = Simplify<
  & {
    readonly [
      Entry in Extract<PathEntries<Schemas>, [any, { readonly "~type.mutability": "optional" }]> as Entry[0]
    ]?: Entry[1]
  }
  & {
    readonly [
      Entry in Extract<PathEntries<Schemas>, [any, { readonly "~type.mutability": "required" }]> as Entry[0]
    ]: Entry[1]
  }
>

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments)
  },
  addSuccess(
    this: AnyWithProps,
    schema: Schema.Top
  ) {
    return makeProto({
      ...this,
      successSchema: this.successSchema === HttpApiSchema.NoContent ?
        schema :
        HttpApiSchema.UnionUnify(this.successSchema, schema)
    })
  },
  addError(this: AnyWithProps, schema: Schema.Top) {
    return makeProto({
      ...this,
      errorSchema: HttpApiSchema.UnionUnify(this.errorSchema, schema)
    })
  },
  setPayload(this: AnyWithProps, schema: Schema.Top) {
    return makeProto({
      ...this,
      payloadSchema: Option.some(schema)
    })
  },
  setPath(this: AnyWithProps, schema: Schema.Top) {
    return makeProto({
      ...this,
      pathSchema: Option.some(schema)
    })
  },
  setUrlParams(this: AnyWithProps, schema: Schema.Top) {
    return makeProto({
      ...this,
      urlParamsSchema: Option.some(schema)
    })
  },
  setHeaders(this: AnyWithProps, schema: Schema.Top) {
    return makeProto({
      ...this,
      headersSchema: Option.some(schema)
    })
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
  annotate(this: AnyWithProps, key: ServiceMap.Key<any, any>, value: any) {
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

const makeProto = <
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
  readonly pathSchema: Option.Option<PathSchema>
  readonly urlParamsSchema: Option.Option<UrlParams>
  readonly payloadSchema: Option.Option<Payload>
  readonly headersSchema: Option.Option<Headers>
  readonly successSchema: Success
  readonly errorSchema: Error
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<ServiceMap.Key<Middleware, any>>
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
> => Object.assign(Object.create(Proto), options)

/**
 * @since 4.0.0
 * @category constructors
 */
export const make =
  <Method extends HttpMethod>(method: Method) =>
  <const Name extends string, const Path extends HttpRouter.PathInput>(
    name: Name,
    path: Path
  ): HttpApiEndpoint<Name, Method, Path> =>
    makeProto({
      name,
      path,
      method,
      pathSchema: Option.none(),
      urlParamsSchema: Option.none(),
      payloadSchema: Option.none(),
      headersSchema: Option.none(),
      successSchema: HttpApiSchema.NoContent as any,
      errorSchema: Schema.Never,
      annotations: ServiceMap.empty(),
      middlewares: new Set()
    })

/**
 * @since 4.0.0
 * @category constructors
 */
export const get: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "GET", Path> = make("GET")

/**
 * @since 4.0.0
 * @category constructors
 */
export const post: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "POST", Path> = make("POST")

/**
 * @since 4.0.0
 * @category constructors
 */
export const put: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "PUT", Path> = make("PUT")

/**
 * @since 4.0.0
 * @category constructors
 */
export const patch: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "PATCH", Path> = make("PATCH")

/**
 * @since 4.0.0
 * @category constructors
 */
export const del: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "DELETE", Path> = make("DELETE")

/**
 * @since 4.0.0
 * @category constructors
 */
export const head: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "HEAD", Path> = make("HEAD")

/**
 * @since 4.0.0
 * @category constructors
 */
export const options: <const Name extends string, const Path extends HttpRouter.PathInput>(
  name: Name,
  path: Path
) => HttpApiEndpoint<Name, "OPTIONS", Path> = make("OPTIONS")
