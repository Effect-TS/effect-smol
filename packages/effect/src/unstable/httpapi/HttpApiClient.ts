/**
 * @since 4.0.0
 */
import * as Arr from "../../Array.ts"
import * as Cause from "../../Cause.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import * as Option from "../../Option.ts"
import * as Predicate from "../../Predicate.ts"
import * as Schema from "../../Schema.ts"
import type * as AST from "../../SchemaAST.ts"
import * as Issue from "../../SchemaIssue.ts"
import * as Transformation from "../../SchemaTransformation.ts"
import type * as ServiceMap from "../../ServiceMap.ts"
import type { Simplify } from "../../Types.ts"
import * as HttpBody from "../http/HttpBody.ts"
import * as HttpClient from "../http/HttpClient.ts"
import * as HttpClientError from "../http/HttpClientError.ts"
import * as HttpClientRequest from "../http/HttpClientRequest.ts"
import * as HttpClientResponse from "../http/HttpClientResponse.ts"
import * as HttpMethod from "../http/HttpMethod.ts"
import * as UrlParams from "../http/UrlParams.ts"
import * as HttpApi from "./HttpApi.ts"
import * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
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
      infer _Params,
      infer _Query,
      infer _Payload,
      infer _Headers,
      infer _Success,
      infer _Error,
      infer _Middleware,
      infer _MR
    >
  ] ? <WithResponse extends boolean = false>(
      request: Simplify<HttpApiEndpoint.ClientRequest<_Params, _Query, _Payload, _Headers, WithResponse>>
    ) => Effect.Effect<
      WithResponse extends true ? [_Success["Type"], HttpClientResponse.HttpClientResponse] : _Success["Type"],
      _Error["Type"] | HttpApiMiddleware.Error<_Middleware> | E | HttpClientError.HttpClientError | Schema.SchemaError,
      | R
      | _Params["EncodingServices"]
      | _Query["EncodingServices"]
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
        readonly content: ReadonlySet<Schema.Top>
        readonly description: string | undefined
      }>
      readonly errors: ReadonlyMap<number, {
        readonly content: ReadonlySet<Schema.Top>
        readonly description: string | undefined
      }>
      readonly endpointFn: Function
    }) => void
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): Effect.Effect<void, unknown, unknown> =>
  Effect.gen(function*() {
    const httpClient = options.httpClient.pipe(
      options?.baseUrl === undefined
        ? identity
        : HttpClient.mapRequest(
          HttpClientRequest.prependUrl(options.baseUrl.toString())
        )
    )
    HttpApi.reflect(api, {
      predicate: options?.predicate,
      onGroup(onGroupOptions) {
        options.onGroup?.(onGroupOptions)
      },
      onEndpoint(onEndpointOptions) {
        const { endpoint, errors, successes } = onEndpointOptions
        const makeUrl = compilePath(endpoint.path)
        const decodeMap: Record<
          number | "orElse",
          (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<unknown, unknown, unknown>
        > = { orElse: statusOrElse }
        const decodeResponse = HttpClientResponse.matchStatus(decodeMap)
        errors.forEach(({ content }, status) => {
          const schemas = Array.from(content)
          // decoders
          if (Arr.isArrayNonEmpty(schemas)) {
            const decode = schemaToResponse(schemas)
            decodeMap[status] = (response) =>
              Effect.flatMap(
                Effect.catchCause(decode(response), (cause) =>
                  Effect.failCause(Cause.merge(
                    Cause.fail(
                      new HttpClientError.HttpClientError({
                        reason: new HttpClientError.StatusCodeError({
                          request: response.request,
                          response
                        })
                      })
                    ),
                    cause
                  ))),
                Effect.fail
              )
          } else {
            // Handle No Content
            decodeMap[status] = statusCodeError
          }
        })
        successes.forEach(({ content }, status) => {
          const schemas = Array.from(content)
          if (Arr.isArrayNonEmpty(schemas)) {
            decodeMap[status] = schemaToResponse(schemas)
          } else {
            // Handle No Content
            decodeMap[status] = responseAsVoid
          }
        })

        // encoders
        const encodePath = Schema.encodeUnknownEffect(
          getEncodeParamsSchema(HttpApiEndpoint.getParamsSchema(endpoint))
        )
        const payloadSchemas = HttpApiEndpoint.getPayloadSchemas(endpoint)
        const encodePayloadBody = Arr.isArrayNonEmpty(payloadSchemas) ?
          HttpMethod.hasBody(endpoint.method)
            ? Schema.encodeUnknownEffect(getEncodePayloadSchema(payloadSchemas))
            : Schema.encodeUnknownEffect(
              HttpApiSchema.Union(payloadSchemas)
            ) :
          undefined

        const encodeHeaders = getEncodeHeadersSchema(HttpApiEndpoint.getHeadersSchema(endpoint)).pipe(
          Schema.encodeUnknownEffect
        )
        const encodeQuery = getEncodeQuerySchema(HttpApiEndpoint.getQuerySchema(endpoint)).pipe(
          Schema.encodeUnknownEffect
        )

        const endpointFn = Effect.fnUntraced(function*(
          request: {
            readonly params: Record<string, string> | undefined
            readonly query: unknown
            readonly payload: unknown
            readonly headers: Record<string, string> | undefined
            readonly withResponse?: boolean
          } | undefined
        ) {
          let httpRequest = HttpClientRequest.make(endpoint.method)(endpoint.path)

          if (request !== undefined) {
            // path
            if (request.params !== undefined) {
              const encodedParams = yield* encodePath(request.params)
              httpRequest = HttpClientRequest.setUrl(httpRequest, makeUrl(encodedParams))
            }

            // payload
            if (encodePayloadBody) {
              if (HttpMethod.hasBody(endpoint.method)) {
                if (request.payload instanceof FormData) {
                  httpRequest = HttpClientRequest.bodyFormData(httpRequest, request.payload)
                } else {
                  const body = (yield* encodePayloadBody(request.payload)) as HttpBody.HttpBody
                  httpRequest = HttpClientRequest.setBody(httpRequest, body)
                }
              } else {
                const urlParams = (yield* encodePayloadBody(request.payload)) as Record<string, string>
                httpRequest = HttpClientRequest.appendUrlParams(httpRequest, urlParams)
              }
            }

            // headers
            if (request.headers !== undefined) {
              httpRequest = HttpClientRequest.setHeaders(
                httpRequest,
                yield* encodeHeaders(request.headers)
              )
            }

            // query
            if (request.query !== undefined) {
              httpRequest = HttpClientRequest.appendUrlParams(
                httpRequest,
                yield* encodeQuery(request.query)
              )
            }
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

function getEncodeParamsSchema(schema: Schema.Top | undefined): Schema.Encoder<Record<string, string>, unknown> {
  return (schema as any) ?? defaultEncodeParamsSchema
}
const defaultEncodeParamsSchema = Schema.Record(Schema.String, Schema.String)

function getEncodeHeadersSchema(schema: Schema.Top | undefined): Schema.Encoder<Record<string, string>, unknown> {
  return (schema as any) ?? defaultEncodeHeadersSchema
}
const defaultEncodeHeadersSchema = Schema.Record(Schema.String, Schema.String)

function getEncodeQuerySchema(schema: Schema.Top | undefined): Schema.Encoder<Record<string, string>, unknown> {
  return (schema as any) ?? defaultEncodeQuerySchema
}
const defaultEncodeQuerySchema = Schema.Record(Schema.String, Schema.String)

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <ApiId extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<ApiId, Groups>,
  options?: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>)
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
      | ((effect: Effect.Effect<unknown, unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>)
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
      | ((effect: Effect.Effect<unknown, unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>)
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
      | ((effect: Effect.Effect<unknown, unknown, unknown>) => Effect.Effect<unknown, unknown, unknown>)
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

const paramsRegExp = /:(\w+)\??/g

const compilePath = (path: string) => {
  const segments = path.split(paramsRegExp)
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

function schemaToResponse(schemas: readonly [Schema.Top, ...Array<Schema.Top>]) {
  const codec = toCodecArrayBuffer(schemas)
  const decode = Schema.decodeEffect(codec)
  return (response: HttpClientResponse.HttpClientResponse) => Effect.flatMap(response.arrayBuffer, decode)
}

const ArrayBuffer = Schema.instanceOf(globalThis.ArrayBuffer, {
  expected: "ArrayBuffer"
})

// _tag: Uint8Array
const Uint8ArrayFromArrayBuffer = ArrayBuffer.pipe(
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

// _tag: Text
const StringFromArrayBuffer = ArrayBuffer.pipe(
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

// _tag: Json
const UnknownFromArrayBuffer = StringFromArrayBuffer.pipe(Schema.decodeTo(
  Schema.Union([
    // Handle No Content
    Schema.Literal("").pipe(Schema.decodeTo(
      Schema.Undefined,
      Transformation.transform({
        decode: () => undefined,
        encode: () => ""
      })
    )),
    Schema.UnknownFromJsonString
  ])
))

function toCodecArrayBuffer(schemas: readonly [Schema.Top, ...Array<Schema.Top>]): Schema.Top {
  switch (schemas.length) {
    case 1:
      return onSchema(schemas[0])
    default:
      return Schema.Union(schemas.map(onSchema))
  }

  function onSchema(schema: Schema.Top) {
    const encoding = HttpApiSchema.getResponseEncoding(schema.ast)
    switch (encoding._tag) {
      case "Json":
        return UnknownFromArrayBuffer.pipe(Schema.decodeTo(schema))
      case "FormUrlEncoded":
        return StringFromArrayBuffer.pipe(
          Schema.decodeTo(UrlParams.schemaRecord),
          Schema.decodeTo(schema)
        )
      case "Uint8Array":
        return Uint8ArrayFromArrayBuffer.pipe(Schema.decodeTo(schema))
      case "Text":
        return StringFromArrayBuffer.pipe(Schema.decodeTo(schema))
    }
  }
}

const statusOrElse = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.DecodeError({
        request: response.request,
        response
      })
    })
  )

const statusCodeError = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.StatusCodeError({
        request: response.request,
        response
      })
    })
  )

const responseAsVoid = (_response: HttpClientResponse.HttpClientResponse) => Effect.void

const HttpBodySchema = Schema.declare(HttpBody.isHttpBody)

function getEncodePayloadSchema(schemas: readonly [Schema.Top, ...Array<Schema.Top>]): Schema.Top {
  return HttpApiSchema.Union(Arr.map(schemas, getEncodePayloadSchemaFromBody))
}

const bodyFromPayloadCache = new WeakMap<AST.AST, Schema.Top>()

function getEncodePayloadSchemaFromBody(
  schema: Schema.Top
): Schema.Top {
  const ast = schema.ast
  const cached = bodyFromPayloadCache.get(ast)
  if (cached !== undefined) {
    return cached
  }
  const encoding = HttpApiSchema.getRequestEncoding(ast)
  const out = HttpBodySchema.pipe(Schema.decodeTo(
    schema,
    Transformation.transformOrFail({
      decode(httpBody) {
        return Effect.fail(new Issue.Forbidden(Option.some(httpBody), { message: "Encode only schema" }))
      },
      encode(t: unknown) {
        switch (encoding._tag) {
          case "Multipart":
            return Effect.fail(new Issue.Forbidden(Option.some(t), { message: "Payload must be a FormData" }))
          case "Json": {
            try {
              const body = JSON.stringify(t)
              return Effect.succeed(HttpBody.text(body, encoding.contentType))
            } catch (error) {
              return Effect.fail(new Issue.InvalidValue(Option.some(t), { message: globalThis.String(error) }))
            }
          }
          case "Text": {
            if (typeof t !== "string") {
              return Effect.fail(
                new Issue.InvalidValue(Option.some(t), { message: "Expected a string" })
              )
            }
            return Effect.succeed(HttpBody.text(t, encoding.contentType))
          }
          case "FormUrlEncoded": {
            if (!Predicate.isObject(t)) {
              return Effect.fail(new Issue.InvalidValue(Option.some(t), { message: "Expected a record" }))
            }
            return Effect.succeed(HttpBody.urlParams(UrlParams.fromInput(t as any)))
          }
          case "Uint8Array": {
            if (!(t instanceof Uint8Array)) {
              return Effect.fail(
                new Issue.InvalidValue(Option.some(t), { message: "Expected a Uint8Array" })
              )
            }
            return Effect.succeed(HttpBody.uint8Array(t, encoding.contentType))
          }
        }
      }
    })
  ))
  bodyFromPayloadCache.set(ast, out)
  return out
}
