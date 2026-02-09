/**
 * @since 4.0.0
 */
import * as Arr from "../../Array.ts"
import type { Brand } from "../../Brand.ts"
import type { Effect } from "../../Effect.ts"
import { type Pipeable, pipeArguments } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import * as AST from "../../SchemaAST.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type * as Stream from "../../Stream.ts"
import type * as Types from "../../Types.ts"
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
 * @since 4.0.0
 * @category models
 */
export type PayloadMap = ReadonlyMap<string, {
  readonly encoding: HttpApiSchema.PayloadEncoding
  readonly schemas: [Schema.Top, ...Array<Schema.Top>]
}>

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
  out Params extends Schema.Top = never,
  out Query extends Schema.Top = never,
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
  readonly "~Params": Params
  readonly "~Query": Query
  readonly "~Headers": Headers
  readonly "~Payload": Payload
  readonly "~Success": Success
  readonly "~Error": Error

  readonly name: Name
  readonly path: Path
  readonly method: Method
  readonly params: Schema.Struct.Fields | undefined
  readonly query: Schema.Struct.Fields | undefined
  readonly headers: Schema.Struct.Fields | undefined
  readonly payload: PayloadMap
  readonly success: ReadonlySet<Schema.Top>
  readonly error: ReadonlySet<Schema.Top>
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
    Params,
    Query,
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
    Params,
    Query,
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
    Params,
    Query,
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
    Params,
    Query,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareR
  >
}

/** @internal */
export function getParamsSchema(endpoint: AnyWithProps): Schema.Top | undefined {
  return endpoint.params ? Schema.Struct(endpoint.params) : undefined
}

/** @internal */
export function getQuerySchema(endpoint: AnyWithProps): Schema.Top | undefined {
  return endpoint.query ? Schema.Struct(endpoint.query) : undefined
}

/** @internal */
export function getHeadersSchema(endpoint: AnyWithProps): Schema.Top | undefined {
  return endpoint.headers ? Schema.Struct(endpoint.headers) : undefined
}

/** @internal */
export function getPayloadSchemas(endpoint: AnyWithProps): Array<Schema.Top> {
  const result: Array<Schema.Top> = []
  for (const { schemas } of endpoint.payload.values()) {
    result.push(...schemas)
  }
  return result
}

/** @internal */
export function getSuccessSchemas(endpoint: AnyWithProps): [Schema.Top, ...Array<Schema.Top>] {
  const schemas = Array.from(endpoint.success)
  return Arr.isArrayNonEmpty(schemas) ? schemas : [HttpApiSchema.NoContent]
}

/** @internal */
export function getErrorSchemas(endpoint: AnyWithProps): [Schema.Top, ...Array<Schema.Top>] {
  const schemas = new Set<Schema.Top>(endpoint.error)
  for (const middleware of endpoint.middlewares) {
    const key = middleware as any as HttpApiMiddleware.AnyKey
    if (key.error !== HttpApiSchemaError && !AST.isNever(key.error.ast)) {
      schemas.add(key.error)
    }
  }
  return Arr.append(Array.from(schemas), HttpApiSchemaError)
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Any extends Pipeable {
  readonly [TypeId]: any
  readonly name: string
  readonly ["~Success"]: Schema.Top
  readonly ["~Error"]: Schema.Top
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
  infer _Params,
  infer _Query,
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
export type Success<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
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
export type Error<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
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
export type Params<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Params
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Query<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? _Query
  : never

/**
 * @since 4.0.0
 * @category models
 */
export type Payload<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
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
export type Headers<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
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
  infer _Params,
  infer _Query,
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
export type Errors<Endpoint extends Any> = Endpoint extends HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _Params,
  infer _Query,
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
  infer _Params,
  infer _Query,
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
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    & ([_Params["Type"]] extends [never] ? {} : { readonly params: _Params["Type"] })
    & ([_Query["Type"]] extends [never] ? {} : { readonly query: _Query["Type"] })
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
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    & ([_Params["Type"]] extends [never] ? {} : { readonly params: _Params["Type"] })
    & ([_Query["Type"]] extends [never] ? {} : { readonly query: _Query["Type"] })
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
  Params extends Schema.Top,
  Query extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  WithResponse extends boolean
> = (
  & ([Params["Type"]] extends [never] ? {} : { readonly params: Params["Type"] })
  & ([Query["Type"]] extends [never] ? {} : { readonly query: Query["Type"] })
  & ([Headers["Type"]] extends [never] ? {} : { readonly headers: Headers["Type"] })
  & ([Payload["Type"]] extends [never] ? {}
    : Payload["Type"] extends infer P ?
      P extends Brand<HttpApiSchema.MultipartTypeId> | Brand<HttpApiSchema.MultipartStreamTypeId>
        ? { readonly payload: FormData }
      : { readonly payload: Payload["Type"] }
    : { readonly payload: Payload["Type"] })
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
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    | _Params["DecodingServices"]
    | _Query["DecodingServices"]
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
  infer _Params,
  infer _Query,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ?
    | _Params["EncodingServices"]
    | _Query["EncodingServices"]
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
  infer _Params,
  infer _Query,
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
  infer _Params,
  infer _Query,
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
) => Effect<Endpoint["~Success"]["Type"] | HttpServerResponse, Endpoint["~Error"]["Type"] | E, R>

/**
 * @since 4.0.0
 * @category models
 */
export type HandlerRaw<Endpoint extends Any, E, R> = (
  request: Types.Simplify<RequestRaw<Endpoint>>
) => Effect<Endpoint["~Success"]["Type"] | HttpServerResponse, Endpoint["~Error"]["Type"] | E, R>

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
export type SuccessWithName<Endpoints extends Any, Name extends string> = Success<
  WithName<Endpoints, Name>
>["Type"]

/**
 * @since 4.0.0
 * @category models
 */
export type ErrorsWithName<Endpoints extends Any, Name extends string> = Errors<WithName<Endpoints, Name>>

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
  infer _Params,
  infer _Query,
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
    _Params,
    _Query,
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
  infer _Params,
  infer _Query,
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
    _Params,
    _Query,
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
  infer _Params,
  infer _Query,
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
    _Params,
    _Query,
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
  Params extends Schema.Top,
  Query extends Schema.Top,
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
  readonly params: Schema.Struct.Fields | undefined
  readonly query: Schema.Struct.Fields | undefined
  readonly headers: Schema.Struct.Fields | undefined
  readonly payload: PayloadMap
  readonly success: ReadonlySet<Schema.Top>
  readonly error: ReadonlySet<Schema.Top>
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly middlewares: ReadonlySet<ServiceMap.Service<Middleware, any>>
}): HttpApiEndpoint<
  Name,
  Method,
  Path,
  Params,
  Query,
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
 * Params come from the router as `string` (optional params as `undefined`) and
 * must be encodable back into the URL path.
 *
 * We accept "struct fields" (`Record<string, Codec<...>>`) so we can both enforce
 * `Encoded` = `string | undefined` per field and reliably generate OpenAPI
 * `in: path` parameters by iterating object properties.
 *
 * @since 4.0.0
 * @category constraints
 */
export type ParamsContraint = Record<string, Schema.Encoder<string | undefined, unknown>>

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
export type QuerySchemaContraint = Record<
  string,
  Schema.Encoder<string | ReadonlyArray<string> | undefined, unknown>
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
    Schema.Encoder<string | ReadonlyArray<string> | undefined, unknown>
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
export type HeadersSchemaContraint = Record<string, Schema.Encoder<string | undefined, unknown>>

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
  Params extends ParamsContraint = never,
  Query extends QuerySchemaContraint = never,
  Payload extends PayloadSchemaContraint<Method> = never,
  Headers extends HeadersSchemaContraint = never,
  const Success extends SuccessSchemaContraint = typeof HttpApiSchema.NoContent,
  const Error extends ErrorSchemaContraint = typeof HttpApiSchemaError
>(
  name: Name,
  path: Path,
  options?: {
    readonly params?: Params | undefined
    readonly query?: Query | undefined
    readonly headers?: Headers | undefined
    readonly payload?: Payload | undefined
    readonly success?: Success | undefined
    readonly error?: Error | undefined
  }
): HttpApiEndpoint<
  Name,
  Method,
  Path,
  Params extends Schema.Struct.Fields ? Schema.Struct<Params> : Params,
  Query extends Schema.Struct.Fields ? Schema.Struct<Query> : Query,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload>
    : Payload extends ReadonlyArray<Schema.Top> ? Payload[number]
    : Payload,
  Headers extends Schema.Struct.Fields ? Schema.Struct<Headers> : Headers,
  Success extends ReadonlyArray<Schema.Top> ? Success[number] : Success,
  Error extends ReadonlyArray<Schema.Top> ? Error[number] : Error
> => {
  return makeProto({
    name,
    path,
    method,
    params: options?.params,
    query: options?.query,
    headers: options?.headers,
    payload: getPayload(options?.payload),
    success: getSuccess(options?.success),
    error: getError(options?.error),
    annotations: ServiceMap.empty(),
    middlewares: new Set()
  })
}

function getPayload(
  payload: Schema.Top | ReadonlyArray<Schema.Top> | Schema.Struct.Fields | undefined
): PayloadMap {
  const result: Map<string, { encoding: HttpApiSchema.PayloadEncoding; schemas: [Schema.Top, ...Array<Schema.Top>] }> =
    new Map()
  if (payload === undefined) return result
  const schemas: Array<Schema.Top> = Array.isArray(payload)
    ? payload
    : Schema.isSchema(payload)
    ? [payload]
    : [Schema.Struct(payload as any).pipe(HttpApiSchema.asFormUrlEncoded())]
  for (const schema of schemas) {
    const encoding = HttpApiSchema.getPayloadEncoding(schema.ast)
    const existing = result.get(encoding.contentType)
    if (existing) {
      if (existing.encoding._tag !== encoding._tag) {
        throw new Error(`Multiple payload encodings for content-type: ${encoding.contentType}`)
      }
      if (existing.encoding._tag === "Multipart") {
        throw new Error(`Multiple multipart payloads for content-type: ${encoding.contentType}`)
      }
      existing.schemas.push(schema)
    } else {
      result.set(encoding.contentType, { encoding, schemas: [schema] })
    }
  }
  return result
}

function getSuccess(
  success: Schema.Top | ReadonlyArray<Schema.Top> | undefined
): Set<Schema.Top> {
  if (success === undefined) return new Set()
  return new Set(Array.isArray(success) ? success : [success])
}

function getError(error: Schema.Top | ReadonlyArray<Schema.Top> | undefined): Set<Schema.Top> {
  if (error === undefined) return new Set()
  return new Set(Array.isArray(error) ? error : [error])
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const get = make("GET")

/**
 * @since 4.0.0
 * @category constructors
 */
export const post = make("POST")

/**
 * @since 4.0.0
 * @category constructors
 */
export const put = make("PUT")

/**
 * @since 4.0.0
 * @category constructors
 */
export const patch = make("PATCH")

const del = make("DELETE")

export {
  /**
   * @since 4.0.0
   * @category constructors
   */
  del as delete
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const head = make("HEAD")

/**
 * @since 4.0.0
 * @category constructors
 */
export const options = make("OPTIONS")
