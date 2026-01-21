/**
 * @since 4.0.0
 */
import type { NoRequiredKeysWith, Simplify } from "../../Types.ts"
import type * as HttpApi from "./HttpApi.ts"
import type * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import type * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiSchema from "./HttpApiSchema.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <
  Api extends HttpApi.Any
>(options?: {
  readonly baseUrl?: string | undefined
  readonly fetch?: typeof fetch | undefined
  readonly defaultHeaders?: HeadersInit | undefined
}): HttpApiClientFetch<Api extends HttpApi.HttpApi<infer _Id, infer Groups> ? EndpointMap<Groups> : never> => {
  const fetchImpl = options?.fetch ?? fetch
  let baseUrl = options?.baseUrl ?? ""
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1)
  }

  return async function(methodAndUrl: string, opts?: {
    readonly path?: Record<string, any> | undefined
    readonly urlParams?: Record<string, any> | undefined
    readonly headers?: Record<string, string> | undefined
    readonly json?: any
    readonly formData?: Record<string, any> | undefined
  }) {
    const headers = new Headers(options?.defaultHeaders)
    if (opts?.headers) {
      for (const [key, value] of Object.entries(opts.headers)) {
        headers.set(key, value)
      }
    }

    const [method, urlTemplate] = methodAndUrl.split(" ")
    let path = urlTemplate
    if (opts?.path) {
      for (const [key, value] of Object.entries(opts.path)) {
        path = path.replace(`:${key}`, encodeURIComponent(String(value)))
      }
    }

    const url = new URL(baseUrl + path, "location" in globalThis ? globalThis.location?.origin : undefined)
    if (opts?.urlParams) {
      for (const [key, value] of Object.entries(opts.urlParams)) {
        url.searchParams.set(key, String(value))
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers
    }
    if (opts?.json !== undefined) {
      headers.set("Content-Type", "application/json")
      fetchOptions.body = JSON.stringify(opts.json)
    } else if (opts?.formData !== undefined) {
      const formData = new FormData()
      for (const [key, value] of Object.entries(opts.formData)) {
        formData.append(key, value)
      }
      fetchOptions.body = formData
    }

    const response = await fetchImpl(url.toString(), fetchOptions)
    return {
      response,
      json() {
        if (response.status === 204) {
          return Promise.resolve(undefined)
        }
        return response.json()
      }
    }
  } as any
}

/**
 * @since 4.0.0
 * @category Models
 */
export type HttpApiClientFetch<
  Endpoints extends Record<string, {
    readonly options: any
    readonly return: any
  }>
> = <
  const MethodAndUrl extends keyof Endpoints
>(
  methodAndUrl: MethodAndUrl,
  ...args: NoRequiredKeysWith<
    Endpoints[MethodAndUrl]["options"],
    [options?: Endpoints[MethodAndUrl]["options"]],
    [options: Endpoints[MethodAndUrl]["options"]]
  >
) => Endpoints[MethodAndUrl]["return"]

/**
 * @since 4.0.0
 * @category Models
 */
export type EndpointMap<Group extends HttpApiGroup.Any> = {
  readonly [Endpoint in HttpApiGroup.Endpoints<Group> as `${Endpoint["method"]} ${Endpoint["path"]}`]: {
    readonly options: EndpointOptions<Endpoint>
    readonly return: Promise<{
      readonly response: Response
      readonly json: () => Promise<
        Endpoint["successSchema"] extends undefined ? void : Endpoint["successSchema"]["Encoded"]
      >
    }>
  }
}

/**
 * @since 4.0.0
 * @category Models
 */
export type EndpointOptions<Endpoint extends HttpApiEndpoint.Any> = Endpoint extends HttpApiEndpoint.HttpApiEndpoint<
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
> ? Simplify<
    & (Endpoint["pathSchema"] extends undefined ? {} :
      NoRequiredKeysWith<_PathSchema["Encoded"], {
        readonly path?: _PathSchema["Encoded"] | undefined
      }, {
        readonly path: _PathSchema["Encoded"]
      }>)
    & (Endpoint["urlParamsSchema"] extends undefined ? {} :
      NoRequiredKeysWith<_UrlParams["Encoded"], {
        readonly urlParams?: _UrlParams["Encoded"] | undefined
      }, {
        readonly urlParams: _UrlParams["Encoded"]
      }>)
    & (Endpoint["headersSchema"] extends undefined ? {} :
      NoRequiredKeysWith<_Headers["Encoded"], {
        readonly headers?: _Headers["Encoded"] | undefined
      }, {
        readonly headers: _Headers["Encoded"]
      }>)
    & (
      Endpoint["payloadSchema"] extends undefined ? {} : _Payload extends HttpApiSchema.Multipart<infer S> ? {
          // TODO: convert to string | Blob | File etc.
          readonly formData: S["Encoded"]
        } :
      {
        readonly json: _Payload["Encoded"]
      }
    )
  > :
  {}
