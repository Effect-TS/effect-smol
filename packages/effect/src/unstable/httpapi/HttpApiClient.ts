/**
 * @since 4.0.0
 */
import * as Cause from "../../Cause.ts"
import * as Option from "../../data/Option.ts"
import type * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import type * as AST from "../../schema/AST.ts"
import * as Issue from "../../schema/Issue.ts"
import * as Schema from "../../schema/Schema.ts"
import * as Transformation from "../../schema/Transformation.ts"
import type * as ServiceMap from "../../ServiceMap.ts"
import type { Simplify } from "../../types/Types.ts"
import * as HttpBody from "../http/HttpBody.ts"
import * as HttpClient from "../http/HttpClient.ts"
import * as HttpClientError from "../http/HttpClientError.ts"
import * as HttpClientRequest from "../http/HttpClientRequest.ts"
import * as HttpClientResponse from "../http/HttpClientResponse.ts"
import * as HttpMethod from "../http/HttpMethod.ts"
import * as UrlParams from "../http/UrlParams.ts"
import * as HttpApi from "./HttpApi.ts"
import type * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import type { HttpApiSchemaError } from "./HttpApiError.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiMiddleware from "./HttpApiMiddleware.ts"
import * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @since 4.0.0
 * @category models
 */
export type Client<Groups extends HttpApiGroup.Any, E, R> = Simplify<
  & {
    readonly [Group in Extract<Groups, { readonly topLevel: false }> as HttpApiGroup.Name<Group>]: Client.Group<
      Group,
      Group["identifier"],
      E,
      R
    >
  }
  & {
    readonly [Method in Client.TopLevelMethods<Groups, E, R> as Method[0]]: Method[1]
  }
>

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace Client {
  /**
   * @since 4.0.0
   * @category models
   */
  export type Group<Groups extends HttpApiGroup.Any, GroupName extends Groups["identifier"], E, R> =
    [HttpApiGroup.WithName<Groups, GroupName>] extends [HttpApiGroup.HttpApiGroup<infer _GroupName, infer _Endpoints>] ?
      {
        readonly [Endpoint in _Endpoints as HttpApiEndpoint.Name<Endpoint>]: Method<Endpoint, E, R>
      } :
      never

  /**
   * @since 4.0.0
   * @category models
   */
  export type Method<Endpoint, E, R> = [Endpoint] extends [
    HttpApiEndpoint.HttpApiEndpoint<
      infer _Name,
      infer _Method,
      infer _Path,
      infer _PathSchema,
      infer _UrlParams,
      infer _Payload,
      infer _Headers,
      infer _Success,
      infer _Error,
      infer _Middleware,
      infer _MR
    >
  ] ? <WithResponse extends boolean = false>(
      request: Simplify<HttpApiEndpoint.ClientRequest<_PathSchema, _UrlParams, _Payload, _Headers, WithResponse>>
    ) => Effect.Effect<
      WithResponse extends true ? [_Success["Type"], HttpClientResponse.HttpClientResponse] : _Success["Type"],
      _Error["Type"] | E | HttpClientError.HttpClientError | Schema.SchemaError,
      | R
      | _PathSchema["EncodingServices"]
      | _UrlParams["EncodingServices"]
      | _Payload["EncodingServices"]
      | _Headers["EncodingServices"]
      | _Success["DecodingServices"]
      | _Error["DecodingServices"]
    > :
    never

  /**
   * @since 4.0.0
   * @category models
   */
  export type TopLevelMethods<Groups extends HttpApiGroup.Any, E, R> =
    Extract<Groups, { readonly topLevel: true }> extends
      HttpApiGroup.HttpApiGroup<infer _Id, infer _Endpoints, infer _TopLevel> ?
      _Endpoints extends infer Endpoint ? [HttpApiEndpoint.Name<Endpoint>, Method<Endpoint, E, R>]
      : never :
      never
}

const makeClient = <ApiId extends string, Groups extends HttpApiGroup.Any, E, R>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options: {
    readonly httpClient: HttpClient.HttpClient.With<E, R>
    readonly predicate?: Predicate.Predicate<{
      readonly endpoint: HttpApiEndpoint.AnyWithProps
      readonly group: HttpApiGroup.AnyWithProps
    }>
    readonly onGroup?: (options: {
      readonly group: HttpApiGroup.AnyWithProps
      readonly mergedAnnotations: ServiceMap.ServiceMap<never>
    }) => void
    readonly onEndpoint: (options: {
      readonly group: HttpApiGroup.AnyWithProps
      readonly endpoint: HttpApiEndpoint.AnyWithProps
      readonly mergedAnnotations: ServiceMap.ServiceMap<never>
      readonly middleware: ReadonlySet<HttpApiMiddleware.AnyKey>
      readonly successes: ReadonlyMap<number, {
        readonly ast: Option.Option<AST.AST>
        readonly description: Option.Option<string>
      }>
      readonly errors: ReadonlyMap<number, {
        readonly ast: Option.Option<AST.AST>
        readonly description: Option.Option<string>
      }>
      readonly endpointFn: Function
    }) => void
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const httpClient = options.httpClient.pipe(
      options?.baseUrl === undefined
        ? identity
        : HttpClient.mapRequest(
          HttpClientRequest.prependUrl(options.baseUrl.toString())
        )
    )
    HttpApi.reflect(api as any, {
      predicate: options?.predicate,
      onGroup(onGroupOptions) {
        options.onGroup?.(onGroupOptions)
      },
      onEndpoint(onEndpointOptions) {
        const { endpoint, errors, successes } = onEndpointOptions
        const makeUrl = compilePath(endpoint.path)
        const decodeMap: Record<
          number | "orElse",
          (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<any, any>
        > = { orElse: statusOrElse }
        const decodeResponse = HttpClientResponse.matchStatus(decodeMap)
        errors.forEach(({ ast }, status) => {
          if (ast._tag === "None") {
            decodeMap[status] = statusCodeError
            return
          }
          const decode = schemaToResponse(ast.value)
          decodeMap[status] = (response) =>
            Effect.flatMap(
              Effect.catchCause(decode(response), (cause) =>
                Effect.failCause(Cause.merge(
                  Cause.fail(
                    new HttpClientError.ResponseError({
                      reason: "StatusCode",
                      request: response.request,
                      response
                    })
                  ),
                  cause
                ))),
              Effect.fail
            )
        })
        successes.forEach(({ ast }, status) => {
          decodeMap[status] = ast._tag === "None" ? responseAsVoid : schemaToResponse(ast.value)
        })
        const encodePath = endpoint.pathSchema.pipe(
          Option.map(Schema.encodeUnknownEffect)
        )
        const encodePayloadBody = endpoint.payloadSchema.pipe(
          Option.map((schema) => {
            if (HttpMethod.hasBody(endpoint.method)) {
              return Schema.encodeUnknownEffect(payloadSchemaBody(schema as any))
            }
            return Schema.encodeUnknownEffect(schema)
          })
        )
        const encodeHeaders = endpoint.headersSchema.pipe(
          Option.map(Schema.encodeUnknownEffect)
        )
        const encodeUrlParams = endpoint.urlParamsSchema.pipe(
          Option.map(Schema.encodeUnknownEffect)
        )
        const endpointFn = Effect.fnUntraced(function*(request: {
          readonly path: any
          readonly urlParams: any
          readonly payload: any
          readonly headers: any
          readonly withResponse?: boolean
        }) {
          let httpRequest = HttpClientRequest.make(endpoint.method)(endpoint.path)
          if (request && request.path) {
            const encodedPathParams = encodePath._tag === "Some"
              ? yield* encodePath.value(request.path)
              : request.path
            httpRequest = HttpClientRequest.setUrl(httpRequest, makeUrl(encodedPathParams))
          }
          if (request && request.payload instanceof FormData) {
            httpRequest = HttpClientRequest.bodyFormData(httpRequest, request.payload)
          } else if (encodePayloadBody._tag === "Some") {
            if (HttpMethod.hasBody(endpoint.method)) {
              const body = (yield* encodePayloadBody.value(request.payload)) as HttpBody.HttpBody
              httpRequest = HttpClientRequest.setBody(httpRequest, body)
            } else {
              const urlParams = (yield* encodePayloadBody.value(request.payload)) as Record<string, string>
              httpRequest = HttpClientRequest.setUrlParams(httpRequest, urlParams)
            }
          }
          if (encodeHeaders._tag === "Some") {
            httpRequest = HttpClientRequest.setHeaders(
              httpRequest,
              (yield* encodeHeaders.value(request.headers)) as any
            )
          }
          if (encodeUrlParams._tag === "Some") {
            httpRequest = HttpClientRequest.appendUrlParams(
              httpRequest,
              (yield* encodeUrlParams.value(request.urlParams)) as any
            )
          }
          const response = yield* httpClient.execute(httpRequest)
          const value = yield* (options.transformResponse === undefined
            ? decodeResponse(response)
            : options.transformResponse(decodeResponse(response)))
          return request?.withResponse === true ? [value, response] : value
        })

        options.onEndpoint({
          ...onEndpointOptions,
          endpointFn
        })
      }
    })
  })

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <ApiId extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options?: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<Simplify<Client<Groups, HttpApiSchemaError, never>>, never, HttpClient.HttpClient> =>
  Effect.flatMap(HttpClient.HttpClient.asEffect(), (httpClient) =>
    makeWith(api, {
      ...options,
      httpClient: options?.transformClient ? options.transformClient(httpClient) : httpClient
    }))

/**
 * @since 4.0.0
 * @category constructors
 */
export const makeWith = <ApiId extends string, Groups extends HttpApiGroup.Any, E, R>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options: {
    readonly httpClient: HttpClient.HttpClient.With<E, R>
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<Simplify<Client<Groups, HttpApiSchemaError | E, R>>> => {
  const client: Record<string, Record<string, any>> = {}
  return makeClient(api, {
    ...options,
    onGroup({ group }) {
      if (group.topLevel) return
      client[group.identifier] = {}
    },
    onEndpoint({ endpoint, endpointFn, group }) {
      ;(group.topLevel ? client : client[group.identifier])[endpoint.name] = endpointFn
    }
  }).pipe(Effect.as(client)) as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const group = <
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
  const GroupName extends HttpApiGroup.Name<Groups>,
  E,
  R
>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options: {
    readonly group: GroupName
    readonly httpClient: HttpClient.HttpClient.With<E, R>
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<Client.Group<Groups, GroupName, HttpApiSchemaError | E, R>> => {
  const client: Record<string, any> = {}
  return makeClient(api, {
    ...options,
    predicate: ({ group }) => group.identifier === options.group,
    onEndpoint({ endpoint, endpointFn }) {
      client[endpoint.name] = endpointFn
    }
  }).pipe(Effect.map(() => client)) as any
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const endpoint = <
  ApiId extends string,
  Groups extends HttpApiGroup.Any,
  const GroupName extends HttpApiGroup.Name<Groups>,
  const EndpointName extends HttpApiEndpoint.Name<HttpApiGroup.EndpointsWithName<Groups, GroupName>>,
  E,
  R
>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options: {
    readonly group: GroupName
    readonly endpoint: EndpointName
    readonly httpClient: HttpClient.HttpClient.With<E, R>
    readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<
  Client.Method<
    HttpApiEndpoint.WithName<HttpApiGroup.Endpoints<HttpApiGroup.WithName<Groups, GroupName>>, EndpointName>,
    HttpApiSchemaError | E,
    R
  >
> => {
  let client: any = undefined
  return makeClient(api, {
    ...options,
    predicate: ({ endpoint, group }) => group.identifier === options.group && endpoint.name === options.endpoint,
    onEndpoint({ endpointFn }) {
      client = endpointFn
    }
  }).pipe(Effect.map(() => client)) as any
}

// ----------------------------------------------------------------------------

const paramsRegex = /:(\w+)\??/g

const compilePath = (path: string) => {
  const segments = path.split(paramsRegex)
  const len = segments.length
  if (len === 1) {
    return (_: any) => path
  }
  return (params: Record<string, string>) => {
    let url = segments[0]
    for (let i = 1; i < len; i++) {
      if (i % 2 === 0) {
        url += segments[i]
      } else {
        url += params[segments[i]]
      }
    }
    return url
  }
}

const schemaToResponse = (
  ast: AST.AST
): (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<any, any> => {
  const encoding = HttpApiSchema.getEncoding(ast)
  const decode = Schema.decodeEffect(schemaFromArrayBuffer(ast, encoding))
  return (response) => Effect.flatMap(response.arrayBuffer, decode)
}

// TODO: can this be more precise?
const SchemaArrayBuffer = Schema.Unknown as any as Schema.instanceOf<ArrayBuffer>

const Uint8ArrayFromArrayBuffer = SchemaArrayBuffer.pipe(
  Schema.decodeTo(
    Schema.Uint8Array as Schema.instanceOf<Uint8Array<ArrayBuffer>>,
    Transformation.transform({
      decode(fromA) {
        return new Uint8Array(fromA)
      },
      encode(arr) {
        return arr.byteLength === arr.buffer.byteLength ?
          arr.buffer :
          arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
      }
    })
  )
)

const StringFromArrayBuffer = SchemaArrayBuffer.pipe(
  Schema.decodeTo(
    Schema.String,
    Transformation.transform({
      decode(fromA) {
        return new TextDecoder().decode(fromA)
      },
      encode(toI) {
        const arr = new TextEncoder().encode(toI) as Uint8Array<ArrayBuffer>
        return arr.byteLength === arr.buffer.byteLength ?
          arr.buffer :
          arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
      }
    })
  )
)

const parseJsonOrVoid = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Unknown,
    Transformation.transformOrFail({
      decode(i) {
        if (i === "") return Effect.succeed(void 0)
        try {
          return Effect.succeed(JSON.parse(i))
        } catch {
          return Effect.fail(
            new Issue.InvalidValue(Option.some(i), { message: "Could not parse JSON" })
          )
        }
      },
      encode(a) {
        if (a === undefined) return Effect.succeed("")
        try {
          return Effect.succeed(JSON.stringify(a))
        } catch {
          return Effect.fail(
            new Issue.InvalidValue(Option.some(a), { message: "Could not encode as JSON" })
          )
        }
      }
    })
  )
)

const parseJsonArrayBuffer = StringFromArrayBuffer.pipe(Schema.decodeTo(parseJsonOrVoid))

const schemaFromArrayBuffer = (
  ast: AST.AST,
  encoding: HttpApiSchema.Encoding
): Schema.decodeTo<Schema.Any, Schema.instanceOf<ArrayBuffer>> => {
  if (ast._tag === "UnionType") {
    return Schema.Union(
      ast.types.map((ast) => schemaFromArrayBuffer(ast, HttpApiSchema.getEncoding(ast, encoding)))
    ) as any
  }
  const schema = Schema.make(ast)
  switch (encoding.kind) {
    case "Json": {
      return Schema.decodeTo(schema)(parseJsonArrayBuffer) as any
    }
    case "UrlParams": {
      return StringFromArrayBuffer.pipe(
        Schema.decodeTo(UrlParams.schemaRecord),
        Schema.decodeTo(schema)
      ) as any
    }
    case "Uint8Array": {
      return Uint8ArrayFromArrayBuffer.pipe(
        Schema.decodeTo(schema)
      ) as any
    }
    case "Text": {
      return Schema.decodeTo(schema)(StringFromArrayBuffer) as any
    }
  }
}

const statusOrElse = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.fail(
    new HttpClientError.ResponseError({
      reason: "Decode",
      request: response.request,
      response
    })
  )

const statusCodeError = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.fail(
    new HttpClientError.ResponseError({
      reason: "StatusCode",
      request: response.request,
      response
    })
  )

const responseAsVoid = (_response: HttpClientResponse.HttpClientResponse) => Effect.void

const HttpBodyFromSelf = Schema.declare(HttpBody.isHttpBody)

const payloadSchemaBody = (schema: Schema.Top): Schema.decodeTo<typeof HttpBodyFromSelf, Schema.Any> => {
  const members = schema.ast._tag === "UnionType" ? schema.ast.types : [schema.ast]
  return Schema.Union(members.map(bodyFromPayload)) as any
}

const bodyFromPayloadCache = new WeakMap<AST.AST, Schema.Top>()

const bodyFromPayload = (ast: AST.AST) => {
  if (bodyFromPayloadCache.has(ast)) {
    return bodyFromPayloadCache.get(ast)!
  }
  const schema = Schema.make(ast)
  const encoding = HttpApiSchema.getEncoding(ast)
  const transform = HttpBodyFromSelf.pipe(Schema.decodeTo(
    schema as Schema.Any,
    Transformation.transformOrFail({
      decode(fromA) {
        return Effect.fail(new Issue.Forbidden(Option.some(fromA), { message: "encode only schema" }))
      },
      encode(toI: any) {
        switch (encoding.kind) {
          case "Json": {
            return HttpBody.json(toI).pipe(
              Effect.mapError((error) =>
                new Issue.InvalidValue(Option.some(toI), { message: `Could not encode as JSON: ${error}` })
              )
            )
          }
          case "Text": {
            if (typeof toI !== "string") {
              return Effect.fail(
                new Issue.InvalidValue(Option.some(toI), { message: "Expected a string" })
              )
            }
            return Effect.succeed(HttpBody.text(toI))
          }
          case "UrlParams": {
            return Effect.succeed(HttpBody.urlParams(UrlParams.fromInput(toI as any)))
          }
          case "Uint8Array": {
            if (!(toI instanceof Uint8Array)) {
              return Effect.fail(
                new Issue.InvalidValue(Option.some(toI), { message: "Expected a Uint8Array" })
              )
            }
            return Effect.succeed(HttpBody.uint8Array(toI))
          }
        }
      }
    })
  ))
  bodyFromPayloadCache.set(ast, transform)
  return transform
}
