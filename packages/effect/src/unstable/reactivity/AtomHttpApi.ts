/**
 * @since 4.0.0
 */
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import type { ReadonlyRecord } from "../../Record.ts"
import type { SchemaError } from "../../Schema.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Mutable, Simplify } from "../../Types.ts"
import type * as HttpClient from "../http/HttpClient.ts"
import type * as HttpClientError from "../http/HttpClientError.ts"
import type { HttpClientResponse } from "../http/HttpClientResponse.ts"
import type * as HttpApi from "../httpapi/HttpApi.ts"
import * as HttpApiClient from "../httpapi/HttpApiClient.ts"
import type * as HttpApiEndpoint from "../httpapi/HttpApiEndpoint.ts"
import type * as HttpApiGroup from "../httpapi/HttpApiGroup.ts"
import type * as AsyncResult from "./AsyncResult.ts"
import * as Atom from "./Atom.ts"
import * as Reactivity from "./Reactivity.ts"

/**
 * @since 4.0.0
 * @category Models
 */
export interface AtomHttpApiClient<Self, Id extends string, Groups extends HttpApiGroup.Any>
  extends ServiceMap.Service<Self, Simplify<HttpApiClient.Client<Groups, never, never>>>
{
  new(_: never): ServiceMap.ServiceClass.Shape<Id, Simplify<HttpApiClient.Client<Groups, never, never>>>

  readonly layer: Layer.Layer<Self>
  readonly runtime: Atom.AtomRuntime<Self>

  readonly mutation: <
    GroupName extends HttpApiGroup.Name<Groups>,
    Name extends HttpApiEndpoint.Name<HttpApiGroup.Endpoints<Group>>,
    Group extends HttpApiGroup.Any = HttpApiGroup.WithName<Groups, GroupName>,
    Endpoint extends HttpApiEndpoint.Any = HttpApiEndpoint.WithName<
      HttpApiGroup.Endpoints<Group>,
      Name
    >,
    const WithResponse extends boolean = false
  >(
    group: GroupName,
    endpoint: Name,
    options?: {
      readonly withResponse?: WithResponse | undefined
    }
  ) => [Endpoint] extends [
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
      infer _R,
      infer _RE
    >
  ] ? Atom.AtomResultFn<
      Simplify<
        HttpApiEndpoint.ClientRequest<_PathSchema, _UrlParams, _Payload, _Headers, false> & {
          readonly reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined
        }
      >,
      WithResponse extends true ? [_Success, HttpClientResponse] : _Success,
      _Error | HttpClientError.HttpClientError | SchemaError
    >
    : never

  readonly query: <
    GroupName extends HttpApiGroup.Name<Groups>,
    Name extends HttpApiEndpoint.Name<HttpApiGroup.Endpoints<Group>>,
    Group extends HttpApiGroup.Any = HttpApiGroup.WithName<Groups, GroupName>,
    Endpoint extends HttpApiEndpoint.Any = HttpApiEndpoint.WithName<
      HttpApiGroup.Endpoints<Group>,
      Name
    >,
    const WithResponse extends boolean = false
  >(
    group: GroupName,
    endpoint: Name,
    request: [Endpoint] extends [
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
        infer _R,
        infer _RE
      >
    ] ? Simplify<
        HttpApiEndpoint.ClientRequest<_PathSchema, _UrlParams, _Payload, _Headers, WithResponse> & {
          readonly reactivityKeys?:
            | ReadonlyArray<unknown>
            | ReadonlyRecord<string, ReadonlyArray<unknown>>
            | undefined
          readonly timeToLive?: Duration.DurationInput | undefined
        }
      >
      : never
  ) => [Endpoint] extends [
    HttpApiEndpoint.HttpApiEndpoint<
      infer _Name,
      infer _Method,
      infer _Path,
      infer _UrlParams,
      infer _Payload,
      infer _Headers,
      infer _Success,
      infer _Error,
      infer _R,
      infer _RE
    >
  ] ? Atom.Atom<
      AsyncResult.AsyncResult<
        WithResponse extends true ? [_Success, HttpClientResponse] : _Success,
        _Error | HttpClientError.HttpClientError | SchemaError
      >
    >
    : never
}

declare global {
  interface ErrorConstructor {
    stackTraceLimit: number
  }
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const Service = <Self>() =>
<const Id extends string, ApiId extends string, Groups extends HttpApiGroup.Any>(
  id: Id,
  options: {
    readonly api: HttpApi.HttpApi<ApiId, Groups>
    readonly httpClient: Layer.Layer<
      | HttpApiGroup.ClientServices<Groups>
      | HttpClient.HttpClient
    >
    readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
    readonly transformResponse?:
      | ((effect: Effect.Effect<unknown, unknown>) => Effect.Effect<unknown, unknown>)
      | undefined
    readonly baseUrl?: URL | string | undefined
  }
): AtomHttpApiClient<Self, Id, Groups> => {
  const self: Mutable<AtomHttpApiClient<Self, Id, Groups>> = ServiceMap.Service<
    Self,
    HttpApiClient.Client<Groups, never, never>
  >()(id) as any

  self.layer = Layer.effect(
    self,
    HttpApiClient.make(options.api, options)
  ).pipe(Layer.provide(options.httpClient)) as Layer.Layer<Self>
  self.runtime = Atom.runtime(self.layer)

  const mutationFamily = Atom.family(({ endpoint, group, withResponse }: MutationKey) =>
    self.runtime.fn<{
      path: any
      urlParams: any
      headers: any
      payload: any
      reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined
    }>()(
      Effect.fnUntraced(function*(opts) {
        const client = (yield* self) as any
        const effect = client[group][endpoint]({
          ...opts,
          withResponse
        }) as Effect.Effect<any>
        return yield* opts.reactivityKeys
          ? Reactivity.mutation(effect, opts.reactivityKeys)
          : effect
      })
    )
  ) as any

  self.mutation = ((group: string, endpoint: string, options?: {
    readonly withResponse?: boolean | undefined
  }) =>
    mutationFamily({
      group,
      endpoint,
      withResponse: options?.withResponse ?? false
    })) as any

  const queryFamily = Atom.family((opts: QueryKey) => {
    let atom = self.runtime.atom(self.use((client_) => {
      const client = client_ as any
      return client[opts.group][opts.endpoint](opts) as Effect.Effect<any>
    }))
    if (opts.timeToLive) {
      atom = Duration.isFinite(opts.timeToLive)
        ? Atom.setIdleTTL(atom, opts.timeToLive)
        : Atom.keepAlive(atom)
    }
    return opts.reactivityKeys
      ? self.runtime.factory.withReactivity(opts.reactivityKeys)(atom)
      : atom
  })

  self.query = ((
    group: string,
    endpoint: string,
    request: {
      readonly path?: any
      readonly urlParams?: any
      readonly payload?: any
      readonly headers?: any
      readonly withResponse?: boolean
      readonly reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined
      readonly timeToLive?: Duration.DurationInput | undefined
    }
  ) =>
    queryFamily({
      group,
      endpoint,
      path: request.path,
      urlParams: request.urlParams,
      payload: request.payload,
      headers: request.headers,
      withResponse: request.withResponse ?? false,
      reactivityKeys: request.reactivityKeys,
      timeToLive: request.timeToLive
        ? Duration.fromDurationInputUnsafe(request.timeToLive)
        : undefined
    })) as any

  return self as AtomHttpApiClient<Self, Id, Groups>
}

interface MutationKey {
  group: string
  endpoint: string
  withResponse: boolean
}

interface QueryKey {
  group: string
  endpoint: string
  path: any
  urlParams: any
  headers: any
  payload: any
  withResponse: boolean
  reactivityKeys?: ReadonlyArray<unknown> | ReadonlyRecord<string, ReadonlyArray<unknown>> | undefined
  timeToLive?: Duration.Duration | undefined
}
